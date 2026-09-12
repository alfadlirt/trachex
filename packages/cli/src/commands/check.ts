import { checkRequirement, InvalidOperationError, NotFoundError } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { confirm, print, printJson } from '../io.ts';
import { resolveSubjectTicket } from '../lib/subject.ts';

export async function check(
  ctx: AppContext,
  args: {
    subjectId: string;
    project?: string;
    requirementId: string;
    yes?: boolean;
    json?: boolean;
  },
) {
  const { ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
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
      if (args.json) printJson({ id: args.requirementId, status: 'aborted' });
      else print('Check cancelled; checklist state unchanged.');
      return;
    }
  }
  const audit = await checkRequirement(ctx.uow, {
    requirementId: args.requirementId,
    actorType: 'human',
  });
  if (args.json) printJson({ id: args.requirementId, status: 'checked', audit });
  else {
    print(`Checked requirement ${args.requirementId}.`);
    print('Checklist state changed: yes.');
    print('Next: subject checklist <subject-id>');
  }
}
