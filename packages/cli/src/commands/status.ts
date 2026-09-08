import { buildProjectStatus, NotFoundError, type ProjectStatus } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { print, printJson } from '../io.ts';

export async function statusProject(ctx: AppContext, args: { project: string; json: boolean }) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const status = await buildProjectStatus(ctx.uow, project.id);
  if (args.json) {
    printJson(status);
    return;
  }
  print(`project ${status.projectSlug} (${status.projectName})`);
  const t = status.totals;
  print(
    `tickets: ${t.tickets}   active: ${t.active}   checked: ${t.checked}   remaining: ${t.remaining}   open proposals: ${t.openProposals}`,
  );
  print(`last updated: ${status.updatedAt}`);
  print('');
  for (const ticket of status.tickets) {
    const box = ticket.active === 0 ? '—' : `[${ticket.checked}/${ticket.active}]`;
    print(
      `  ${ticket.key}   ${box}   remaining ${ticket.remaining}   open ${ticket.openProposals}   updated ${ticket.updatedAt}`,
    );
    if (ticket.title && ticket.title !== ticket.key) {
      print(`      ${ticket.title}`);
    }
  }
}

export type { ProjectStatus };
