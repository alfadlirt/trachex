import { mkdirSync } from 'node:fs';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

export interface RunMcpInput {
  projectSlug: string;
  appDir?: string;
  runAgent?: RunAgentFn;
  /** Primarily useful for protocol-boundary tests; defaults to the process stdio streams. */
  stdin?: Readable;
  stdout?: Writable;
}

export async function runMcpServer(input: RunMcpInput): Promise<void> {
  const appDir = input.appDir ?? trachexAppDir();
  mkdirSync(appDir, { recursive: true });
  const db = openDatabase({ path: `${appDir}/trachex.db` });
  migrate(db);
  const vector = resolveVectorBackend();
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

    const server = createMcpServer({
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

    const stdin = input.stdin ?? process.stdin;
    const transport = new StdioServerTransport(stdin, input.stdout ?? process.stdout);
    await server.connect(transport);

    // StdioServerTransport intentionally only listens for data.  It therefore
    // needs this small adapter to turn an MCP client's EOF into a transport
    // close; otherwise the SQLite handle and the CLI await would outlive the
    // client (or the composition binary could terminate too early).
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let closePromise: Promise<void> | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        stdin.off('end', onEnd);
        stdin.off('close', onEnd);
        process.off('SIGINT', onSignal);
        process.off('SIGTERM', onSignal);
        if (error) reject(error);
        else resolve();
      };
      const closeServer = () => {
        closePromise ??= server.close();
        return closePromise;
      };
      const onEnd = async () => {
        try {
          await closeServer();
          finish();
        } catch (error) {
          finish(asError(error));
        }
      };
      const onSignal = () => {
        void closeServer()
          .then(() => finish())
          .catch((error: unknown) => finish(asError(error)));
      };

      server.onclose = () => finish();
      server.onerror = (error) => finish(error);
      stdin.once('end', onEnd);
      stdin.once('close', onEnd);
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);
    });
  } finally {
    db.close();
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
