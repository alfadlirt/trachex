import { z } from 'zod';

export const impactKindSchema = z.enum(['service', 'api', 'page']);

export const requirementDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sourceLocation: z.string().optional(),
  parentLabel: z.string().optional(),
  impacts: z
    .array(
      z.object({
        kind: impactKindSchema,
        value: z.string().min(1),
      }),
    )
    .optional(),
  scenarios: z.array(z.string().min(1)).optional(),
  supersedes: z.array(z.string().min(1)).optional(),
});

export const extractionOutputSchema = z.object({
  kind: z.literal('extraction'),
  requirements: z.array(requirementDraftSchema).min(1),
});

export const reconciliationOutputSchema = z.object({
  kind: z.literal('reconciliation'),
  create: z.array(requirementDraftSchema),
});

export const proposalOutputSchema = z.discriminatedUnion('kind', [
  extractionOutputSchema,
  reconciliationOutputSchema,
]);

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
export type ReconciliationOutput = z.infer<typeof reconciliationOutputSchema>;
export type ProposalOutput = z.infer<typeof proposalOutputSchema>;
export type RequirementDraft = z.infer<typeof requirementDraftSchema>;
