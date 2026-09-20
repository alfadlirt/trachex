import type { RunAgentFn } from '@trachex/agent';
import { buildExportSummary, NotFoundError, newId, nowIso } from '@trachex/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiContext } from './context.ts';
import { errorPayload } from './errors.ts';

const answerSchema = z.object({
  answer: z.string().min(1),
  evidence: z
    .array(
      z.object({
        source: z.string(),
        location: z.string().nullish().default(null),
        excerpt: z.string().nullish().default(null),
      }),
    )
    .default([]),
});

export interface ChatDeps {
  ctx: ApiContext;
  runAgent: RunAgentFn;
}

export function createChatRoutes(deps: ChatDeps): Hono {
  const app = new Hono();
  const { ctx, runAgent } = deps;

  async function createSession(projectId: string, ticketId: string) {
    return ctx.uow.sessions.create({
      id: newId(),
      projectId,
      ticketId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  app.get('/chat/:projectId/:ticketKey/history', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project)
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, c.req.param('ticketKey'));
    if (!ticket)
      return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
    const sessions = (await ctx.uow.sessions.listByTicket?.(ticket.id)) ?? [];
    const history = await Promise.all(
      sessions.map(async (session) => {
        const messages = await ctx.uow.sessions.listMessages(session.id);
        const firstUser = messages.find((message) => message.role === 'user');
        return {
          session,
          messages,
          title: firstUser?.content.slice(0, 72) || 'New conversation',
          preview: messages.at(-1)?.content.slice(0, 120) ?? '',
        };
      }),
    );
    return c.json({ sessions: history });
  });

  app.post('/chat/:projectId/:ticketKey/sessions', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project)
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, c.req.param('ticketKey'));
    if (!ticket)
      return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
    return c.json({ session: await createSession(project.id, ticket.id) }, 201);
  });

  app.post('/chat/:projectId/:ticketKey', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project)
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, c.req.param('ticketKey'));
    if (!ticket)
      return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
    const body = (await c.req.json().catch(() => ({}))) as { message?: string };
    const message = body.message?.trim() ?? '';
    const requestedSessionId = (body as { sessionId?: string }).sessionId;
    c.header('Content-Type', 'application/x-ndjson');
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) =>
          controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
        try {
          const requested = requestedSessionId
            ? await ctx.uow.sessions.findById(requestedSessionId)
            : null;
          if (requestedSessionId && (!requested || requested.ticketId !== ticket.id)) {
            throw new Error(
              'That chat session is unavailable. Start a new conversation and ask again.',
            );
          }
          // The composer is usable before any session exists. The first message
          // lazily creates the session so users never have to click "New Chat".
          const session = requested ?? (await createSession(project.id, ticket.id));
          emit({ type: 'start', ticketKey: ticket.key, sessionId: session.id });
          if (!message) {
            emit({ type: 'done' });
            controller.close();
            return;
          }
          const summary = await buildExportSummary(ctx.uow, {
            projectId: project.id,
            ticketKey: ticket.key,
          });
          const history = await ctx.uow.sessions.listMessages(session.id);
          const output = await runAgent({
            instructions: [
              'You are the Trachex ticket-context assistant.',
              'Answer only from the supplied ticket baseline and retrieved evidence.',
              'Explain what changed, what remains, why requirements exist, and what needs clarification.',
              'Do not invent owners, causes, dates, implementation status, repository details, or confidence.',
              'If evidence is insufficient, say so and recommend adding a clarification through the adjustment flow.',
              'Never mark work complete or silently mutate canonical requirements.',
              'Return a concise answer and optional evidence references.',
            ].join('\n'),
            userContent: `Ticket baseline:\n${JSON.stringify(summary, null, 2)}\n\nRecent conversation:\n${JSON.stringify(history.slice(-12), null, 2)}\n\nUser question:\n${message}`,
            outputSchema: answerSchema,
          });
          const answer = answerSchema.parse(output);
          await ctx.uow.sessions.addMessage({
            id: newId(),
            sessionId: session.id,
            role: 'user',
            content: message,
            createdAt: nowIso(),
          });
          await ctx.uow.sessions.addMessage({
            id: newId(),
            sessionId: session.id,
            role: 'assistant',
            content: answer.answer,
            createdAt: nowIso(),
          });
          emit({ type: 'text', text: answer.answer });
          for (const evidence of answer.evidence ?? []) emit({ type: 'evidence', ...evidence });
          emit({ type: 'done' });
          controller.close();
        } catch (error) {
          process.stderr.write(
            `[trachex] dashboard chat agent error: ${JSON.stringify(inspectChatError(error))}\n`,
          );
          emit({ type: 'error', error: error instanceof Error ? error.message : String(error) });
          controller.close();
        }
      },
    });
    return c.body(stream);
  });
  return app;
}

function inspectChatError(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) };
  const record = error as Error & Record<string, unknown>;
  const scalar = (key: string) => {
    const value = record[key];
    return typeof value === 'string' || typeof value === 'number' ? value : undefined;
  };
  return {
    name: error.name,
    message: error.message,
    status: scalar('status') ?? scalar('statusCode'),
    code: scalar('code'),
    cause: record.cause instanceof Error ? record.cause.message : undefined,
  };
}
