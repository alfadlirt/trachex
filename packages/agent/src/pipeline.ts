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
  note?: string;
  currentRequirements?: string;
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
    ...(input.note !== undefined ? { note: input.note } : {}),
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
      userContent: input.currentRequirements
        ? `${input.currentRequirements}\n\nAdjustment source:\n${input.content}`
        : input.content,
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
    logProviderError('extraction', error);
    await recordPipelineError(uow, error);
    const detail = error instanceof Error ? `: ${error.message}` : `: ${String(error)}`;
    throw new PipelineError(`extraction failed${detail}`, error);
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
    ...(input.note !== undefined ? { note: input.note } : {}),
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
      userContent: input.currentRequirements
        ? `${input.currentRequirements}\n\nAdjustment source:\n${input.content}`
        : input.content,
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
    logProviderError('reconciliation', error);
    await recordPipelineError(uow, error);
    const detail = error instanceof Error ? `: ${error.message}` : `: ${String(error)}`;
    throw new PipelineError(`reconciliation failed${detail}`, error);
  }
}

function normalizeOutput(output: unknown): DomainProposalOutput {
  const raw = JSON.parse(JSON.stringify(output)) as {
    kind: string;
    requirements?: Array<Record<string, unknown>>;
    create?: Array<Record<string, unknown>>;
  };
  const cleanDraft = (draft: Record<string, unknown>) => {
    const clean: Record<string, unknown> = { title: draft.title };
    for (const key of [
      'description',
      'sourceLocation',
      'parentLabel',
      'implementationItems',
      'successCriteria',
      'impacts',
      'scenarios',
      'supersedes',
    ]) {
      const value = draft[key];
      if (value !== null && value !== undefined) {
        clean[key] = value;
      }
    }
    return clean;
  };
  if (raw.kind === 'extraction' && Array.isArray(raw.requirements)) {
    return {
      kind: 'extraction',
      requirements: raw.requirements.map(cleanDraft),
    } as unknown as DomainProposalOutput;
  }
  if (raw.kind === 'reconciliation' && Array.isArray(raw.create)) {
    return {
      kind: 'reconciliation',
      create: raw.create.map(cleanDraft),
    } as unknown as DomainProposalOutput;
  }
  return raw as unknown as DomainProposalOutput;
}

function logProviderError(phase: string, error: unknown) {
  const detail = inspectProviderError(error);
  process.stderr.write(`[trachex] ${phase} provider error: ${JSON.stringify(detail)}\n`);
}

function inspectProviderError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const record = error as Error & Record<string, unknown>;
  const pick = (key: string) => {
    const value = record[key];
    return typeof value === 'string' || typeof value === 'number' ? value : undefined;
  };
  const nested = (key: string) => {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (value !== null && typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return String(value);
      }
    }
    return undefined;
  };
  const cause = record.cause;
  return {
    name: error.name,
    message: error.message,
    status: pick('status') ?? pick('statusCode'),
    code: pick('code') ?? nested('error'),
    body: nested('error') ?? nested('response'),
    cause: cause instanceof Error ? { name: cause.name, message: cause.message } : undefined,
  };
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
