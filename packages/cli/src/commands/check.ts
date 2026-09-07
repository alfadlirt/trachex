import { checkRequirement, InvalidOperationError, NotFoundError } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { confirm, printJson } from '../io.ts';

export async function check(
  ctx: AppContext,
  args: {
    key: string;
    requirementId: string;
    project: string;
    yes?: boolean;
  },
) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, args.key);
  if (!ticket) {
    throw new NotFoundError('ticket', args.key);
  }
  const requirement = await ctx.uow.requirements.findById(args.requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', args.requirementId);
  }
  if (requirement.ticketId !== ticket.id) {
    throw new InvalidOperationError('requirement does not belong to the given ticket');
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
