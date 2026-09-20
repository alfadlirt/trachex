import { z } from 'zod';

export const impactKindSchema = z.enum(['service', 'api', 'page']);

export const requirementDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish().default(null),
  sourceLocation: z.string().nullish().default(null),
  parentLabel: z.string().nullish().default(null),
  implementationItems: z.array(z.string().min(1)).nullish().default(null),
  successCriteria: z.array(z.string().min(1)).nullish().default(null),
  impacts: z
    .array(
      z.object({
        kind: impactKindSchema,
        value: z.string().min(1),
      }),
    )
    .nullish()
    .default(null),
  scenarios: z.array(z.string().min(1)).nullish().default(null),
  supersedes: z.array(z.string().min(1)).nullish().default(null),
});

export const proposedOrderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1),
  uncertainty: z.string().nullish().default(null),
});

export const extractionOutputSchema = z.object({
  kind: z.literal('extraction'),
  requirements: z.array(requirementDraftSchema).min(1),
  proposedOrder: proposedOrderSchema.nullish().default(null),
});

export const reconciliationOutputSchema = z.object({
  kind: z.literal('reconciliation'),
  create: z.array(requirementDraftSchema),
  proposedOrder: proposedOrderSchema.nullish().default(null),
});

export const proposalOutputSchema = z.discriminatedUnion('kind', [
  extractionOutputSchema,
  reconciliationOutputSchema,
]);

export interface RequirementDraft {
  title: string;
  description?: string | null;
  sourceLocation?: string | null;
  parentLabel?: string | null;
  implementationItems?: string[] | null;
  successCriteria?: string[] | null;
  impacts?: Array<{ kind: z.infer<typeof impactKindSchema>; value: string }> | null;
  scenarios?: string[] | null;
  supersedes?: string[] | null;
}

export interface ExtractionOutput {
  kind: 'extraction';
  requirements: RequirementDraft[];
  proposedOrder?: ProposedOrder | null;
}

export interface ReconciliationOutput {
  kind: 'reconciliation';
  create: RequirementDraft[];
  proposedOrder?: ProposedOrder | null;
}

export interface ProposedOrder {
  orderedIds: string[];
  rationale: string;
  uncertainty?: string | null;
}

export type ProposalOutput = ExtractionOutput | ReconciliationOutput;
