import { runReconciliation } from '@trachex/agent';
import type { SourceType } from '@trachex/domain';
import { buildRunAgent } from '../agent-wiring.ts';
import type { AppContext } from '../app.ts';
import { printJson } from '../io.ts';
import { resolveSubjectTicket } from '../lib/subject.ts';

export async function adjustment(
  ctx: AppContext,
  args: {
    subjectId: string;
    project?: string;
    source: string;
    from?: string;
    note: string;
    fixture?: string;
  },
) {
  const { subject, ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
  const runAgent = buildRunAgent({
    search: ctx.uow.search,
    ...(args.fixture !== undefined ? { fixturePath: args.fixture } : {}),
  });
  const result = await runReconciliation(
    ctx.uow,
    { runAgent },
    {
      appDir: ctx.appDir,
      projectId: subject.projectId,
      ticketId: ticket.id,
      type: args.source as SourceType,
      ...(args.from !== undefined ? { attribution: args.from } : {}),
      relPath: 'note',
      contentKind: 'text',
      content: args.note,
    },
  );
  printJson({
    subject: { id: subject.id, name: subject.name },
    source: result.source,
    proposal: {
      id: result.proposal.id,
      kind: result.proposal.kind,
      status: result.proposal.status,
    },
  });
}
