import { checkRequirement, InvalidOperationError, NotFoundError } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { confirm, printJson } from '../io.ts';
import { resolveSubjectTicket } from '../lib/subject.ts';

export async function check(
  ctx: AppContext,
  args: {
    subjectId: string;
    project?: string;
    requirementId: string;
    yes?: boolean;
  },
) {
  const { subject, ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
  const requirement = await ctx.uow.requirements.findById(args.requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', args.requirementId);
  }
  if (requirement.ticketId !== ticket.id) {
    throw new InvalidOperationError('requirement does not belong to the given subject');
  }
  if (!args.yes) {
    const ok = await confirm(
      `Mark requirement ${args.requirementId} (${requirement.title}) as complete?`,
    );
    if (!ok) {
      printJson({ id: args.requirementId, status: 'aborted' });
      return;
    }
  }
  const audit = await checkRequirement(ctx.uow, {
    requirementId: args.requirementId,
    actorType: 'human',
  });
  printJson({ id: args.requirementId, status: 'checked', audit });
}
