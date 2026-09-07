import { type RunAgentFn, runReconciliation } from '@trachex/agent';
import {
  approveProposal,
  buildExportSummary,
  checkRequirement,
  createTicket,
  NotFoundError,
  rejectProposal,
  ScopingError,
  type SourceType,
  serializeJson,
  serializeMarkdown,
  type UnitOfWork,
} from '@trachex/domain';
import { z } from 'zod';

export interface ToolContext {
  uow: UnitOfWork;
  appDir: string;
  projectId: string;
  projectSlug: string;
  runAgent: RunAgentFn;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (ctx: ToolContext, input: unknown) => Promise<unknown>;
}

const ticketKeySchema = z.string().min(1);
const sourceTypeSchema = z.enum([
  'fsd',
  'brd',
  'chat',
  'meeting',
  'clarification',
  'uat',
  'manual',
  'context',
]);

async function requireTicket(ctx: ToolContext, key: string) {
  const ticket = await ctx.uow.tickets.findByProjectAndKey(ctx.projectId, key);
  if (!ticket) {
    throw new NotFoundError('ticket', key);
  }
  return ticket;
}

async function requireScopedRequirement(ctx: ToolContext, requirementId: string) {
  const requirement = await ctx.uow.requirements.findById(requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', requirementId);
  }
  if (requirement.projectId !== ctx.projectId) {
    throw new ScopingError('requirement does not belong to the selected project');
  }
  return requirement;
}

async function requireScopedProposal(ctx: ToolContext, proposalId: string) {
  const proposal = await ctx.uow.proposals.findById(proposalId);
  if (!proposal) {
    throw new NotFoundError('proposal', proposalId);
  }
  const ticket = await ctx.uow.tickets.findById(proposal.ticketId);
  if (!ticket || ticket.projectId !== ctx.projectId) {
    throw new ScopingError('proposal does not belong to the selected project');
  }
  return proposal;
}

export const tools: ToolDef[] = [
  {
    name: 'get_checklist',
    description:
      'Get the current active requirements (checklist) for a ticket in the selected project.',
    inputSchema: z.object({ ticketKey: ticketKeySchema }),
    handler: async (ctx, input) => {
      const { ticketKey } = input as { ticketKey: string };
      const ticket = await requireTicket(ctx, ticketKey);
      const checklist = await ctx.uow.requirements.listActiveByTicket(ticket.id);
      return { ticketKey, checklist };
    },
  },
  {
    name: 'get_baseline',
    description:
      'Get a complete development context pack for a ticket: current checklist, history, impacts, scenarios, timeline, and open proposals.',
    inputSchema: z.object({ ticketKey: ticketKeySchema }),
    handler: async (ctx, input) => {
      const { ticketKey } = input as { ticketKey: string };
      const ticket = await requireTicket(ctx, ticketKey);
      const summary = await buildExportSummary(ctx.uow, {
        projectId: ctx.projectId,
        ticketKey,
      });
      const proposals = await ctx.uow.proposals.listByTicket(ticket.id);
      return {
        ...summary,
        openProposals: proposals.filter((p) => p.status === 'pending'),
      };
    },
  },
  {
    name: 'get_history',
    description: 'Get the requirement history (superseded items) and timeline for a ticket.',
    inputSchema: z.object({ ticketKey: ticketKeySchema }),
    handler: async (ctx, input) => {
      const { ticketKey } = input as { ticketKey: string };
      const ticket = await requireTicket(ctx, ticketKey);
      const requirements = await ctx.uow.requirements.listByTicket(ticket.id);
      const history = requirements.filter((r) => r.lifecycleStatus === 'superseded');
      const summary = await buildExportSummary(ctx.uow, { projectId: ctx.projectId, ticketKey });
      return { ticketKey, history, timeline: summary.timeline };
    },
  },
  {
    name: 'list_tickets',
    description: 'List all tickets in the selected project.',
    inputSchema: z.object({}),
    handler: async (ctx) => {
      const tickets = await ctx.uow.tickets.listByProject(ctx.projectId);
      return { tickets };
    },
  },
  {
    name: 'get_requirement',
    description: 'Get a single requirement by id (must belong to the selected project).',
    inputSchema: z.object({ requirementId: z.string().min(1) }),
    handler: async (ctx, input) => {
      const { requirementId } = input as { requirementId: string };
      const requirement = await requireScopedRequirement(ctx, requirementId);
      const impacts = await ctx.uow.requirements.listImpactsByTicket(requirement.ticketId);
      const scenarios = await ctx.uow.requirements.listScenariosByTicket(requirement.ticketId);
      return {
        requirement,
        impacts: impacts.filter((i) => i.requirementId === requirement.id),
        scenarios: scenarios.filter((s) => s.requirementId === requirement.id),
      };
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a new ticket in the selected project.',
    inputSchema: z.object({
      key: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
    }),
    handler: async (ctx, input) => {
      const { key, title, description } = input as {
        key: string;
        title: string;
        description?: string;
      };
      const ticket = await createTicket(ctx.uow, {
        projectId: ctx.projectId,
        key,
        title,
        ...(description !== undefined ? { description } : {}),
      });
      return { ticket };
    },
  },
  {
    name: 'add_adjustment',
    description:
      'Add an adjustment note and create a PENDING reconciliation proposal (not applied until approved).',
    inputSchema: z.object({
      ticketKey: ticketKeySchema,
      source: sourceTypeSchema,
      attribution: z.string().optional(),
      note: z.string().min(1),
    }),
    handler: async (ctx, input) => {
      const { ticketKey, source, attribution, note } = input as {
        ticketKey: string;
        source: SourceType;
        attribution?: string;
        note: string;
      };
      const ticket = await requireTicket(ctx, ticketKey);
      const result = await runReconciliation(
        ctx.uow,
        { runAgent: ctx.runAgent },
        {
          appDir: ctx.appDir,
          projectId: ctx.projectId,
          ticketId: ticket.id,
          type: source,
          ...(attribution !== undefined ? { attribution } : {}),
          relPath: 'note',
          contentKind: 'text',
          content: note,
        },
      );
      return {
        proposal: {
          id: result.proposal.id,
          kind: result.proposal.kind,
          status: result.proposal.status,
        },
        source: result.source,
      };
    },
  },
  {
    name: 'approve_proposal',
    description: 'Approve a pending proposal, creating or superseding canonical requirements.',
    inputSchema: z.object({ proposalId: z.string().min(1) }),
    handler: async (ctx, input) => {
      const { proposalId } = input as { proposalId: string };
      await requireScopedProposal(ctx, proposalId);
      await approveProposal(ctx.uow, { proposalId });
      return { proposalId, status: 'approved' };
    },
  },
  {
    name: 'reject_proposal',
    description: 'Reject a pending proposal. Canonical requirements are unchanged.',
    inputSchema: z.object({ proposalId: z.string().min(1) }),
    handler: async (ctx, input) => {
      const { proposalId } = input as { proposalId: string };
      await requireScopedProposal(ctx, proposalId);
      await rejectProposal(ctx.uow, { proposalId });
      return { proposalId, status: 'rejected' };
    },
  },
  {
    name: 'check_item',
    description:
      'Mark a requirement as complete. This asserts human completion and REQUIRES confirm: true.',
    inputSchema: z.object({
      requirementId: z.string().min(1),
      confirm: z.literal(true),
    }),
    handler: async (ctx, input) => {
      const { requirementId } = input as { requirementId: string; confirm: true };
      const requirement = await requireScopedRequirement(ctx, requirementId);
      const audit = await checkRequirement(ctx.uow, {
        requirementId: requirement.id,
        actorType: 'human',
      });
      return { requirementId, status: 'checked', audit };
    },
  },
  {
    name: 'export_summary',
    description: 'Export the development summary for a ticket in Markdown or JSON.',
    inputSchema: z.object({
      ticketKey: ticketKeySchema,
      format: z.enum(['markdown', 'json']).default('markdown'),
    }),
    handler: async (ctx, input) => {
      const { ticketKey, format } = input as { ticketKey: string; format: 'markdown' | 'json' };
      await requireTicket(ctx, ticketKey);
      const summary = await buildExportSummary(ctx.uow, {
        projectId: ctx.projectId,
        ticketKey,
      });
      const text = format === 'json' ? serializeJson(summary) : serializeMarkdown(summary);
      return { ticketKey, format, content: text };
    },
  },
];

export function getTool(name: string): ToolDef | undefined {
  return tools.find((t) => t.name === name);
}
