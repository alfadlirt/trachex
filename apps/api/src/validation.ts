import { z } from 'zod';

const proposedOrderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1),
  uncertainty: z.string().nullable().optional(),
});

const proposalDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sourceLocation: z.string().nullable().optional(),
  parentLabel: z.string().nullable().optional(),
  implementationItems: z.array(z.string().min(1)).optional(),
  successCriteria: z.array(z.string().min(1)).optional(),
  impacts: z
    .array(z.object({ kind: z.enum(['service', 'api', 'page']), value: z.string().min(1) }))
    .optional(),
  scenarios: z.array(z.string().min(1)).optional(),
  supersedes: z.array(z.string().min(1)).optional(),
});

export const proposalOutputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('extraction'),
    requirements: z.array(proposalDraftSchema).min(1),
    proposedOrder: proposedOrderSchema.nullish(),
  }),
  z.object({
    kind: z.literal('reconciliation'),
    create: z.array(proposalDraftSchema),
    proposedOrder: proposedOrderSchema.nullish(),
  }),
]);

export const createProjectSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

export const deleteProjectSchema = z.object({
  confirmName: z.string().min(1),
});

export const createTicketSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateTicketSchema = z.object({
  key: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const deleteTicketSchema = z.object({
  confirmName: z.string().min(1),
});

export const reorderChecklistSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const adjustmentSchema = z.object({
  source: z.enum(['fsd', 'brd', 'chat', 'meeting', 'clarification', 'uat', 'manual', 'context']),
  attribution: z.string().optional(),
  note: z.string().min(1),
});

export const checkSchema = z.object({
  confirm: z.literal(true),
});

export const proposalEditSchema = z.object({ editedOutput: proposalOutputSchema });
