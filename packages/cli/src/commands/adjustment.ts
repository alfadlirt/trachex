import { runReconciliation } from '@trachex/agent';
import { createTicket, NotFoundError, type SourceType } from '@trachex/domain';
import { buildRunAgent } from '../agent-wiring.ts';
import type { AppContext } from '../app.ts';
import { printJson } from '../io.ts';

export async function adjustment(
  ctx: AppContext,
  args: {
    key: string;
    project: string;
    source: string;
    from?: string;
    note: string;
    fixture?: string;
  },
) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  let ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, args.key);
  if (!ticket) {
    ticket = await createTicket(ctx.uow, {
      projectId: project.id,
      key: args.key,
      title: args.key,
    });
  }
  const runAgent = buildRunAgent({
    search: ctx.uow.search,
    ...(args.fixture !== undefined ? { fixturePath: args.fixture } : {}),
  });
  const result = await runReconciliation(
    ctx.uow,
    { runAgent },
    {
      appDir: ctx.appDir,
      projectId: project.id,
      ticketId: ticket.id,
      type: args.source as SourceType,
      ...(args.from !== undefined ? { attribution: args.from } : {}),
      relPath: 'note',
      contentKind: 'text',
      content: args.note,
    },
  );
  printJson({
    ticket: { id: ticket.id, key: ticket.key },
    source: result.source,
    proposal: {
      id: result.proposal.id,
      kind: result.proposal.kind,
      status: result.proposal.status,
    },
  });
}
