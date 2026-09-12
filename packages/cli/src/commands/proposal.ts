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
import { print, printJson } from '../io.ts';

export async function proposalList(ctx: AppContext, args: { project: string; json: boolean }) {
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
  if (args.json) {
    printJson(proposals);
    return;
  }
  if (proposals.length === 0) {
    print(`No proposals for project ${args.project}.`);
    return;
  }
  print(`Proposals for ${args.project}`);
  for (const entry of proposals) {
    const output = latestOutput(entry.versions);
    const drafts = output ? proposalDrafts(output) : [];
    const source = entry.proposal.sourceId
      ? await ctx.uow.sources.findById(entry.proposal.sourceId)
      : undefined;
    print(
      `- ${entry.proposal.id} [${entry.proposal.status}] ${entry.ticketKey} — ${entry.proposal.kind}`,
    );
    print(
      `  source: ${source?.type ?? entry.proposal.sourceId ?? 'unknown'}${source?.attribution ? ` (${source.attribution})` : ''}; ${drafts.length} proposed change(s)`,
    );
    for (const draft of drafts)
      print(
        `  + ${draft.title}${draft.supersedes?.length ? ` (supersedes ${draft.supersedes.join(', ')})` : ''}`,
      );
    if (entry.proposal.status === 'pending')
      print(`  Next: proposal review ${entry.proposal.id} --project ${args.project}`);
  }
}

function latestOutput(
  versions: Array<{ editedOutput?: string | null; modelOutput: string }>,
): ProposalOutput | undefined {
  const latest = versions.at(-1);
  if (!latest) return undefined;
  return JSON.parse(latest.editedOutput ?? latest.modelOutput) as ProposalOutput;
}

function proposalDrafts(output: ProposalOutput) {
  return output.kind === 'extraction' ? output.requirements : output.create;
}

export async function proposalApprove(
  ctx: AppContext,
  args: {
    id: string;
    project: string;
    yes?: boolean;
    json?: boolean;
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
  if (args.json) printJson({ id: args.id, status: 'approved' });
  else {
    print(`Approved proposal ${args.id}. Checklist state changed: applied.`);
    print(`Next: subject checklist <subject-id>`);
  }
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

export async function proposalReview(
  ctx: AppContext,
  args: { id: string; project: string; json?: boolean },
) {
  const review = await proposalReviewData(ctx, args.id, args.project);
  if (args.json) {
    printJson(review);
    return;
  }
  print(`Proposal ${review.proposal.id} — ${review.proposal.status}`);
  print(
    `Source: ${review.source?.type ?? 'unknown'}${review.source?.attribution ? ` (${review.source.attribution})` : ''}`,
  );
  print(`Cause: ${review.source?.note ?? review.source?.location ?? 'not specified'}`);
  if (review.supersedeTargets.length > 0) {
    print('Existing targets:');
    for (const target of review.supersedeTargets) print(`  - ${target.id}: ${target.title}`);
  } else {
    print('Existing targets: none');
  }
  print('Proposed changes (not applied):');
  for (const draft of proposalDrafts(review.output)) {
    print(`  + ${draft.title}`);
    if (draft.description) print(`    ${draft.description}`);
    if (draft.supersedes?.length) print(`    replaces: ${draft.supersedes.join(', ')}`);
    for (const impact of draft.impacts ?? []) print(`    impact: ${impact.kind}:${impact.value}`);
    for (const scenario of draft.scenarios ?? []) print(`    scenario: ${scenario}`);
  }
  print('Checklist state changed: no — approval is required.');
  print(`Next: proposal edit ${review.proposal.id} --project ${args.project} --output <file>`);
  print(`Next: proposal approve ${review.proposal.id} --project ${args.project} --yes`);
  print(`Next: proposal reject ${review.proposal.id} --project ${args.project}`);
}

export async function proposalEdit(
  ctx: AppContext,
  args: { id: string; project: string; output: string; json?: boolean },
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
  if (args.json) {
    printJson({
      id: args.id,
      status: 'pending',
      version,
      review: await proposalReviewData(ctx, args.id, args.project),
    });
  } else {
    print(`Edited proposal ${args.id}; it remains pending. Checklist state changed: no.`);
    print(`Next: proposal review ${args.id} --project ${args.project}`);
  }
}

export async function proposalReject(
  ctx: AppContext,
  args: { id: string; project: string; json?: boolean },
) {
  await requireScopedProposal(ctx, args.id, args.project);
  await rejectProposal(ctx.uow, { proposalId: args.id });
  if (args.json) printJson({ id: args.id, status: 'rejected' });
  else print(`Rejected proposal ${args.id}. Checklist state changed: no.`);
}
