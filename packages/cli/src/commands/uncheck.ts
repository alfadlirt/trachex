import { NotFoundError, uncheckRequirement } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { print, printJson } from '../io.ts';
import { resolveSubjectTicket } from '../lib/subject.ts';

export async function uncheck(
  ctx: AppContext,
  args: {
    subjectId: string;
    project?: string;
    requirementId: string;
    from?: string;
    note?: string;
    json: boolean;
  },
) {
  const { ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
  const requirement = await ctx.uow.requirements.findById(args.requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', args.requirementId);
  }
  if (requirement.ticketId !== ticket.id) {
    const { InvalidOperationError } = await import('@trachex/domain');
    throw new InvalidOperationError('requirement does not belong to the given subject');
  }
  const audit = await uncheckRequirement(ctx.uow, {
    requirementId: args.requirementId,
    actorType: 'human',
    ...(args.from !== undefined ? { actorId: args.from } : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
  });
  if (args.json) printJson({ id: args.requirementId, status: 'unchecked', audit });
  else {
    print(`Unchecked requirement ${args.requirementId}.`);
    print('Checklist state changed: yes.');
    print('Next: subject checklist <subject-id>');
  }
}
