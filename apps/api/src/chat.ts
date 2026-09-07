import type { RunAgentFn } from '@trachex/agent';
import { NotFoundError } from '@trachex/domain';
import { Hono } from 'hono';
import type { ApiContext } from './context.ts';
import { errorPayload } from './errors.ts';

export interface ChatDeps {
  ctx: ApiContext;
  runAgent: RunAgentFn;
}

export function createChatRoutes(deps: ChatDeps): Hono {
  const app = new Hono();
  const { ctx } = deps;

  app.post('/chat/:projectId/:ticketKey', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project) {
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    }
    const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, c.req.param('ticketKey'));
    if (!ticket) {
      return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
    }

    const body = (await c.req.json().catch(() => ({}))) as { message?: string };
    const message = body.message ?? '';

    c.header('Content-Type', 'application/x-ndjson');
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => {
          controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
        };
        try {
          emit({ type: 'start', ticketKey: ticket.key });
          if (message.length === 0) {
            emit({ type: 'done' });
            controller.close();
            return;
          }
          emit({ type: 'message', text: `Received: ${message}` });
          emit({
            type: 'note',
            text: 'Chat can only create pending proposals. Use the adjustment flow to apply changes.',
          });
          emit({ type: 'done' });
          controller.close();
        } catch (error) {
          emit({
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
          controller.close();
        }
      },
    });
    return c.body(stream);
  });

  return app;
}
