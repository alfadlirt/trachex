import { mkdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server as HttpServer } from 'node:http';
import process from 'node:process';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { RunAgentFn } from '@trachex/agent';
import { trachexAppDir } from '@trachex/shared';
import {
  createLazyLocalEmbedder,
  migrate,
  openDatabase,
  resolveVectorBackend,
  SqliteUnitOfWork,
} from '@trachex/storage-sqlite';
import { createMcpServer } from './server.ts';

export const MCP_HTTP_PATH = '/mcp';
export const DEFAULT_MCP_HTTP_HOST = '127.0.0.1';
export const DEFAULT_MCP_HTTP_PORT = 8001;

export interface RunMcpHttpInput {
  projectSlug: string;
  appDir?: string;
  host?: string;
  port?: number;
  token?: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  env?: NodeJS.ProcessEnv;
  runAgent?: RunAgentFn;
}

export interface McpHttpServerHandle {
  server: HttpServer;
  host: string;
  port: number;
  close(): Promise<void>;
}

interface Session {
  server: ReturnType<typeof createMcpServer>;
  transport: StreamableHTTPServerTransport;
}

/**
 * Start one fixed-project MCP server over Streamable HTTP.
 *
 * The returned handle is useful to embedding applications and protocol tests.
 * `runMcpHttpServer` below is the long-lived CLI wrapper.
 */
export async function startMcpHttpServer(input: RunMcpHttpInput): Promise<McpHttpServerHandle> {
  const token = input.token ?? (input.env ?? process.env).TRACHEX_MCP_TOKEN;
  if (!token) {
    throw new Error('TRACHEX_MCP_TOKEN is required for HTTP MCP');
  }

  const host = input.host ?? DEFAULT_MCP_HTTP_HOST;
  const port = input.port ?? DEFAULT_MCP_HTTP_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`invalid MCP HTTP port: ${port}`);
  }

  const appDir = input.appDir ?? trachexAppDir(input.env ?? process.env);
  mkdirSync(appDir, { recursive: true });
  const db = openDatabase({ path: `${appDir}/trachex.db` });
  migrate(db);
  const env = input.env ?? process.env;
  const vector = resolveVectorBackend(env);
  const uow = new SqliteUnitOfWork(db, {
    embedder: createLazyLocalEmbedder(),
    vectorBackend: vector.backend,
    ...(vector.qdrantClient ? { qdrantClient: vector.qdrantClient } : {}),
  });

  try {
    const project = await uow.projects.findBySlug(input.projectSlug);
    if (!project) {
      throw new Error(`project not found: ${input.projectSlug}`);
    }

    const configuredHosts = input.allowedHosts ?? parseList(env.TRACHEX_MCP_ALLOWED_HOSTS);
    let allowedHosts = configuredHosts.length > 0 ? configuredHosts : [formatHostPort(host, port)];
    const allowedOrigins = input.allowedOrigins ?? parseList(env.TRACHEX_MCP_ALLOWED_ORIGINS);
    const sessions = new Map<string, Session>();
    let closing = false;

    const createSession = async (): Promise<Session> => {
      let session: Session | undefined;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        allowedHosts,
        allowedOrigins,
        // Host and Origin are validated at the request boundary below. The
        // SDK validator requires exact host:port values, while port 0 is useful
        // to embedders and protocol tests before the OS assigns the final port.
        enableDnsRebindingProtection: false,
        onsessioninitialized: (sessionId) => {
          if (!closing && session) sessions.set(sessionId, session);
        },
        onsessionclosed: (sessionId) => {
          const existing = sessions.get(sessionId);
          if (existing === session) sessions.delete(sessionId);
          void existing?.server.close();
        },
      });
      const mcpServer = createMcpServer({
        appDir,
        projectSlug: input.projectSlug,
        projectId: project.id,
        uow,
        runAgent:
          input.runAgent ??
          (() => {
            throw new Error('no agent configured for MCP add_adjustment');
          }),
      });
      session = { server: mcpServer, transport };
      await mcpServer.connect(transport as unknown as Transport);
      return session;
    };

    const httpServer = createServer((req, res) => {
      void handleHttpRequest(req, res);
    });

    const handleHttpRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      let pathname: string | undefined;
      try {
        pathname =
          req.url === undefined ? undefined : new URL(req.url, 'http://localhost').pathname;
      } catch {
        pathname = undefined;
      }
      if (pathname !== MCP_HTTP_PATH) {
        writeJson(res, 404, { error: 'not found' });
        return;
      }
      if (!hasBearerToken(req.headers.authorization, token)) {
        res.writeHead(401, { 'WWW-Authenticate': 'Bearer' });
        res.end();
        return;
      }
      const hostHeader = req.headers.host;
      const origin = req.headers.origin;
      if (
        !hostHeader ||
        !isAllowedHost(hostHeader, allowedHosts) ||
        (origin !== undefined && allowedOrigins.length > 0 && !allowedOrigins.includes(origin))
      ) {
        writeJson(res, 403, { error: 'request origin is not allowed' });
        return;
      }

      const sessionId = headerValue(req.headers['mcp-session-id']);
      let session = sessionId ? sessions.get(sessionId) : undefined;
      if (sessionId && !session) {
        writeJson(res, 404, { error: 'session not found' });
        return;
      }
      const isNewSession = !session;
      try {
        session ??= await createSession();
        const currentSession = session;
        await currentSession.transport.handleRequest(req, res);
        if (isNewSession && currentSession.transport.sessionId === undefined) {
          await closeSession(currentSession);
        }
      } catch {
        if (isNewSession && session) await closeSession(session);
        if (!res.headersSent) writeJson(res, 500, { error: 'MCP request failed' });
      }
    };

    await listen(httpServer, host, port);
    const address = httpServer.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    if (configuredHosts.length === 0) {
      allowedHosts = [formatHostPort(host, actualPort)];
    }
    let closed = false;
    const close = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      closing = true;
      const active = [...sessions.values()];
      sessions.clear();
      try {
        await Promise.allSettled(active.map(closeSession));
        await closeHttpServer(httpServer);
      } finally {
        db.close();
      }
    };
    return { server: httpServer, host, port: actualPort, close };
  } catch (error) {
    db.close();
    throw error;
  }
}

export async function runMcpHttpServer(input: RunMcpHttpInput): Promise<void> {
  const handle = await startMcpHttpServer(input);
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      handle.server.off('error', onError);
    };
    const onSignal = () => {
      void handle.close().then(resolve, reject);
    };
    const onError = (error: Error) => {
      void handle.close().then(
        () => {
          cleanup();
          reject(error);
        },
        (closeError: unknown) => {
          cleanup();
          reject(closeError instanceof Error ? closeError : error);
        },
      );
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    handle.server.once('close', () => {
      cleanup();
      resolve();
    });
    handle.server.once('error', onError);
  });
  await handle.close();
}

function parseList(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedHost(value: string, allowedHosts: string[]): boolean {
  const normalizedValue = value.trim().toLowerCase();
  return allowedHosts.some((allowed) => allowed.trim().toLowerCase() === normalizedValue);
}

function formatHostPort(host: string, port: number): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]:${port}` : `${host}:${port}`;
}

function hasBearerToken(authorization: string | undefined, expected: string): boolean {
  const prefix = 'Bearer ';
  if (authorization === undefined || authorization.length < prefix.length) return false;
  if (authorization.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) return false;
  const provided = authorization.slice(prefix.length);
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function closeSession(session: Session): Promise<void> {
  await Promise.allSettled([session.server.close(), session.transport.close()]);
}

function listen(server: HttpServer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
