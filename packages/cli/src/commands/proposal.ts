import { readFile } from 'node:fs/promises';
import {
  approveProposal,
  editProposal,
  NotFoundError,
  type ProposalOutput,
  rejectProposal,
} from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { CliError, EXIT_USAGE } from '../errors.ts';
import { printJson } from '../io.ts';

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
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) throw new NotFoundError('project', args.project);
  const proposal = await ctx.uow.proposals.findById(args.id);
  if (!proposal) throw new NotFoundError('proposal', args.id);
  const ticket = await ctx.uow.tickets.findById(proposal.ticketId);
  if (!ticket || ticket.projectId !== project.id) throw new NotFoundError('proposal', args.id);
  if (!args.yes) {
    throw new CliError(
      'proposal approve requires explicit --yes; no changes were applied',
      EXIT_USAGE,
      'CONFIRM_REQUIRED',
    );
  }
  await approveProposal(ctx.uow, { proposalId: args.id });
  printJson({ id: args.id, status: 'approved' });
}

async function requireScopedProposal(ctx: AppContext, id: string, projectSlug: string) {
  const project = await ctx.uow.projects.findBySlug(projectSlug);
  if (!project) throw new NotFoundError('project', projectSlug);
  const proposal = await ctx.uow.proposals.findById(id);
  if (!proposal) throw new NotFoundError('proposal', id);
  const ticket = await ctx.uow.tickets.findById(proposal.ticketId);
  if (!ticket || ticket.projectId !== project.id) {
    throw new NotFoundError('proposal', id);
  }
  return { proposal, ticket };
}

async function proposalReviewData(ctx: AppContext, id: string, projectSlug: string) {
  const { proposal, ticket } = await requireScopedProposal(ctx, id, projectSlug);
  if (proposal.status !== 'pending') {
    throw new Error('only pending proposals can be reviewed');
  }
  const versions = await ctx.uow.proposals.listVersions(id);
  const latest = versions.at(-1);
  if (!latest) throw new Error('proposal has no versions');
  const output = JSON.parse(latest.editedOutput ?? latest.modelOutput) as ProposalOutput;
  const source = proposal.sourceId ? await ctx.uow.sources.findById(proposal.sourceId) : null;
  const targetIds =
    output.kind === 'reconciliation'
      ? output.create.flatMap((draft) => draft.supersedes ?? [])
      : [];
  const targets = [];
  for (const targetId of targetIds) {
    const target = await ctx.uow.requirements.findById(targetId);
    if (target) targets.push(target);
  }
  return { proposal, ticket, source, version: latest, output, supersedeTargets: targets };
}

export async function proposalReview(ctx: AppContext, args: { id: string; project: string }) {
  printJson(await proposalReviewData(ctx, args.id, args.project));
}

export async function proposalEdit(
  ctx: AppContext,
  args: { id: string; project: string; output: string },
) {
  let output: ProposalOutput;
  try {
    output = JSON.parse(await readFile(args.output, 'utf8')) as ProposalOutput;
  } catch (error) {
    throw new Error(
      `could not read proposal output JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await requireScopedProposal(ctx, args.id, args.project);
  const version = await editProposal(ctx.uow, { proposalId: args.id, editedOutput: output });
  printJson({
    id: args.id,
    status: 'pending',
    version,
    review: await proposalReviewData(ctx, args.id, args.project),
  });
}

export async function proposalReject(ctx: AppContext, args: { id: string; project: string }) {
  await requireScopedProposal(ctx, args.id, args.project);
  await rejectProposal(ctx.uow, { proposalId: args.id });
  printJson({ id: args.id, status: 'rejected' });
}
