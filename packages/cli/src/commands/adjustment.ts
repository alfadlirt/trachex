import { runReconciliation } from '@trachex/agent';
import type { SourceType } from '@trachex/domain';
import { buildRunAgent } from '../agent-wiring.ts';
import type { AppContext } from '../app.ts';
import { print, printJson } from '../io.ts';
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
    json?: boolean;
  },
) {
  const { subject, ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
  const currentRequirements = JSON.stringify(
    (await ctx.uow.requirements.listByTicket(ticket.id)).map((requirement) => ({
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      lifecycleStatus: requirement.lifecycleStatus,
      devStatus: requirement.devStatus,
    })),
    null,
    2,
  );
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
      note: args.note,
      currentRequirements,
      relPath: 'note',
      contentKind: 'text',
      content: args.note,
    },
  );
  const response = {
    subject: { id: subject.id, name: subject.name },
    source: result.source,
    proposal: {
      id: result.proposal.id,
      kind: result.proposal.kind,
      status: result.proposal.status,
    },
  };
  if (args.json) {
    printJson(response);
  } else {
    print(
      `Created pending ${response.proposal.kind} proposal ${response.proposal.id} for ${response.subject.name}.`,
    );
    print(
      `Source: ${response.source.type}${response.source.attribution ? ` (${response.source.attribution})` : ''}`,
    );
    print('Checklist state changed: no — approval is required.');
    print(`Next: proposal review ${response.proposal.id} --project ${args.project ?? '<project>'}`);
  }
}
