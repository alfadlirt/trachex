import { NotFoundError, uncheckRequirement } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { printJson } from '../io.ts';

export async function uncheck(
  ctx: AppContext,
  args: {
    key: string;
    requirementId: string;
    project: string;
    from?: string;
    note?: string;
    json: boolean;
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
    const { InvalidOperationError } = await import('@trachex/domain');
    throw new InvalidOperationError('requirement does not belong to the given ticket');
  }
  const audit = await uncheckRequirement(ctx.uow, {
    requirementId: args.requirementId,
    actorType: 'human',
    ...(args.from !== undefined ? { actorId: args.from } : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
  });
  printJson({ id: args.requirementId, status: 'unchecked', audit });
}
