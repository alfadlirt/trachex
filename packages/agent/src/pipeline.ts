import type {
  ProposalOutput as DomainProposalOutput,
  SourceType,
  UnitOfWork,
} from '@trachex/domain';
import { createProposal } from '@trachex/domain';
import { ingestFile } from '@trachex/storage-sqlite';
import type { RunAgentFn } from './factory.ts';
import { buildExtractionPrompt, buildReconciliationPrompt } from './prompts.ts';
import { extractionOutputSchema, reconciliationOutputSchema } from './schemas.ts';

export class PipelineError extends Error {
  readonly cause: unknown | undefined;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PipelineError';
    this.cause = cause;
  }
}

export interface PipelineDeps {
  runAgent: RunAgentFn;
}

export interface PipelineInput {
  appDir: string;
  projectId: string;
  ticketId: string;
  type: SourceType;
  attribution?: string;
  relPath: string;
  contentKind: string;
  content: string;
  sourceEventAt?: string;
  location?: string;
}

export async function runExtraction(uow: UnitOfWork, deps: PipelineDeps, input: PipelineInput) {
  const source = await ingestFile(uow, {
    appDir: input.appDir,
    projectId: input.projectId,
    ticketId: input.ticketId,
    type: input.type,
    ...(input.attribution !== undefined ? { attribution: input.attribution } : {}),
    ...(input.sourceEventAt !== undefined ? { sourceEventAt: input.sourceEventAt } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    relPath: input.relPath,
    contentKind: input.contentKind,
    content: input.content,
  });

  try {
    const output = await deps.runAgent({
      instructions: buildExtractionPrompt({
        sourceType: input.type,
        ...(input.attribution !== undefined ? { attribution: input.attribution } : {}),
      }),
      userContent: input.content,
      outputSchema: extractionOutputSchema,
    });
    const proposal = await createProposal(uow, {
      ticketId: input.ticketId,
      kind: 'extraction',
      sourceId: source.source.id,
      output: normalizeOutput(output),
    });
    return { source: source.source, proposal };
  } catch (error) {
    await recordPipelineError(uow, error);
    throw new PipelineError('extraction failed', error);
  }
}

export async function runReconciliation(uow: UnitOfWork, deps: PipelineDeps, input: PipelineInput) {
  const source = await ingestFile(uow, {
    appDir: input.appDir,
    projectId: input.projectId,
    ticketId: input.ticketId,
    type: input.type,
    ...(input.attribution !== undefined ? { attribution: input.attribution } : {}),
    ...(input.sourceEventAt !== undefined ? { sourceEventAt: input.sourceEventAt } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    relPath: input.relPath,
    contentKind: input.contentKind,
    content: input.content,
  });

  try {
    const output = await deps.runAgent({
      instructions: buildReconciliationPrompt({
        sourceType: input.type,
        ...(input.attribution !== undefined ? { attribution: input.attribution } : {}),
      }),
      userContent: input.content,
      outputSchema: reconciliationOutputSchema,
    });
    const proposal = await createProposal(uow, {
      ticketId: input.ticketId,
      kind: 'reconciliation',
      sourceId: source.source.id,
      output: normalizeOutput(output),
    });
    return { source: source.source, proposal };
  } catch (error) {
    await recordPipelineError(uow, error);
    throw new PipelineError('reconciliation failed', error);
  }
}

function normalizeOutput(output: unknown): DomainProposalOutput {
  return JSON.parse(JSON.stringify(output)) as DomainProposalOutput;
}

async function recordPipelineError(uow: UnitOfWork, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await uow.sessions.recordError({
    id: crypto.randomUUID(),
    sessionId: null,
    proposalId: null,
    message,
    stack: error instanceof Error ? (error.stack ?? null) : null,
    createdAt: new Date().toISOString(),
  });
}
