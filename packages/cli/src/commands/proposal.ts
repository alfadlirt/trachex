import { approveProposal, NotFoundError, rejectProposal } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { confirm, printJson } from '../io.ts';

export async function proposalList(ctx: AppContext, args: { project: string }) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const tickets = await ctx.uow.tickets.listByProject(project.id);
  const proposals = [];
  for (const ticket of tickets) {
    const list = await ctx.uow.proposals.listByTicket(ticket.id);
    for (const proposal of list) {
      const versions = await ctx.uow.proposals.listVersions(proposal.id);
      proposals.push({ ticketKey: ticket.key, proposal, versions });
    }
  }
  printJson(proposals);
}

export async function proposalApprove(
  ctx: AppContext,
  args: {
    id: string;
    project: string;
    yes?: boolean;
  },
) {
  const proposal = await ctx.uow.proposals.findById(args.id);
  if (!proposal) {
    throw new NotFoundError('proposal', args.id);
  }
  if (!args.yes) {
    const ok = await confirm(
      `Approve proposal ${args.id} (${proposal.kind}, ${proposal.status})? This will create/supersede canonical requirements.`,
    );
    if (!ok) {
      printJson({ id: args.id, status: 'aborted' });
      return;
    }
  }
  await approveProposal(ctx.uow, { proposalId: args.id });
  printJson({ id: args.id, status: 'approved' });
}

export async function proposalReject(ctx: AppContext, args: { id: string; project: string }) {
  const proposal = await ctx.uow.proposals.findById(args.id);
  if (!proposal) {
    throw new NotFoundError('proposal', args.id);
  }
  await rejectProposal(ctx.uow, { proposalId: args.id });
  printJson({ id: args.id, status: 'rejected' });
}
