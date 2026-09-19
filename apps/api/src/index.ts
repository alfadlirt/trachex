import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import {
  buildObservability,
  createTrachexAgent,
  extractionOutputSchema,
  type RunAgentFn,
  reconciliationOutputSchema,
  resolveProviderConfig,
  runAgentWithSchema,
} from '@trachex/agent';
import { Hono } from 'hono';
import { createChatRoutes } from './chat.ts';
import { type ApiContext, openApiContext } from './context.ts';
import { createRoutes } from './routes.ts';

const DEFAULT_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dashboard', 'dist');

const ASSET_MIME_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

export interface DashboardOptions {
  appDir?: string;
  port?: number;
  host?: string;
  dashboardDist?: string;
  env?: NodeJS.ProcessEnv;
  runAgent?: RunAgentFn;
}

export function buildRunAgent(ctx: ApiContext, env: NodeJS.ProcessEnv = process.env): RunAgentFn {
  const config = resolveProviderConfig(env);
  if (!config.apiKey) {
    throw new Error('no provider API key configured: set OPENAI_API_KEY');
  }
  const observability = buildObservability(env);
  return async (args) => {
    const schema =
      args.outputSchema === extractionOutputSchema
        ? extractionOutputSchema
        : args.outputSchema === reconciliationOutputSchema
          ? reconciliationOutputSchema
          : args.outputSchema;
    const agent = createTrachexAgent(
      { provider: config, search: ctx.uow.search, observability },
      args.instructions,
      schema,
    );
    return runAgentWithSchema(agent, { prompt: args.userContent });
  };
}

export function createApp(options: DashboardOptions = {}) {
  const ctx = openApiContext(options.appDir);
  const runAgent = options.runAgent ?? buildRunAgent(ctx, options.env ?? process.env);
  const app = new Hono();

  app.get(
    '/api/health',
    () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  );

  app.route('/api', createRoutes({ ctx, runAgent }));
  app.route('/api', createChatRoutes({ ctx, runAgent }));

  const dist = options.dashboardDist ?? DEFAULT_DIST;
  if (existsSync(join(dist, 'index.html'))) {
    app.get('*', async (c) => {
      const url = c.req.path;
      const file = url === '/' ? 'index.html' : url.slice(1);
      const candidate = join(dist, file);
      if (existsSync(candidate) && !candidate.endsWith('.html')) {
        const contentType =
          ASSET_MIME_TYPES[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
        return c.body(readFileSync(candidate), 200, { 'Content-Type': contentType });
      }
      return c.html(readFileSync(join(dist, 'index.html'), 'utf8'));
    });
  }

  return app;
}

export async function startDashboard(options: DashboardOptions = {}): Promise<void> {
  const app = createApp(options);
  const port = options.port ?? Number(process.env.TRACHEX_DASHBOARD_PORT ?? 8000);
  const host = options.host ?? process.env.TRACHEX_DASHBOARD_HOST ?? '127.0.0.1';
  await new Promise<void>((resolve) => {
    serve({ fetch: app.fetch, port, hostname: host }, () => {
      console.log(`trachex dashboard listening on http://${host}:${port}`);
      resolve();
    });
  });
}
