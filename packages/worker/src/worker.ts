import { readFileSync } from 'node:fs';
import {
  buildObservability,
  createTrachexAgent,
  type RunAgentFn,
  resolveProviderConfig,
  retryTransientAgentCall,
  runAgentWithSchema,
  runReconciliation,
} from '@trachex/agent';
import { loadTrachexEnv, sourcesDir, trachexAppDir } from '@trachex/shared';
import {
  createLazyLocalEmbedder,
  migrate,
  openDatabase,
  resolveVectorBackend,
  SqliteUnitOfWork,
} from '@trachex/storage-sqlite';
import { createAdjustmentWorker } from './index.ts';

loadTrachexEnv();
const appDir = trachexAppDir();
const env = process.env;
const redisUrl = env.TRACHEX_REDIS_URL;
if (!redisUrl) throw new Error('TRACHEX_REDIS_URL is required to start the adjustment worker.');
console.log(`trachex adjustment worker listening on ${redisUrl}`);
const db = openDatabase({ path: `${appDir}/trachex.db` });
migrate(db);
const vector = resolveVectorBackend(env);
const uow = new SqliteUnitOfWork(db, {
  embedder: createLazyLocalEmbedder(),
  vectorBackend: vector.backend,
  ...(vector.qdrantClient ? { qdrantClient: vector.qdrantClient } : {}),
});
const provider = resolveProviderConfig(env);
if (!provider.apiKey) throw new Error('No provider API key configured for the adjustment worker.');
const runAgent: RunAgentFn = async (args) => {
  const agent = createTrachexAgent(
    { provider, search: uow.search, observability: buildObservability(env) },
    args.instructions ?? '',
    args.outputSchema,
  );
  const retrievalPrompt = args.projectId
    ? `\n\nBefore producing the proposal, call vectorSearch with query summarizing the adjustment, projectId "${args.projectId}"${args.subjectId ? `, and subjectId "${args.subjectId}"` : ''}. Use the returned indexed evidence when reconciling; do not invent a different projectId or subjectId.`
    : '';
  return retryTransientAgentCall(() =>
    runAgentWithSchema(agent, { prompt: `${args.userContent ?? ''}${retrievalPrompt}` }),
  );
};

createAdjustmentWorker(redisUrl, async (job) => {
  console.log(`processing adjustment job ${job.data.adjustmentJobId}`);
  const record = await uow.adjustmentJobs.findById(job.data.adjustmentJobId);
  if (!record || record.status === 'completed') return;
  const now = new Date().toISOString();
  const processing = {
    ...record,
    status: 'processing' as const,
    startedAt: record.startedAt ?? now,
    attempts: record.attempts + 1,
    updatedAt: now,
  };
  await uow.adjustmentJobs.update(processing);
  try {
    const source = await uow.sources.findById(record.sourceId);
    if (!source) throw new Error('The uploaded adjustment source is missing.');
    const content = source.snapshotId
      ? readFileSync(`${sourcesDir(appDir, record.projectId)}/${source.snapshotId}`, 'utf8')
      : (source.note ?? '');
    const currentRequirements = await uow.requirements.listActiveByTicket(record.ticketId);
    const subject = await uow.subjects.findById(record.ticketId);
    const result = await runReconciliation(
      uow,
      { runAgent },
      {
        appDir,
        projectId: record.projectId,
        ticketId: record.ticketId,
        type: record.sourceType,
        relPath: record.sourceLocation ?? 'note',
        contentKind: 'text',
        content,
        currentRequirements: JSON.stringify(currentRequirements, null, 2),
        sourceId: source.id,
        ...(subject ? { subjectId: subject.id } : {}),
        ...(source.attribution ? { attribution: source.attribution } : {}),
      },
    );
    await uow.adjustmentJobs.update({
      ...processing,
      status: 'completed',
      proposalId: result.proposal.id,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`completed adjustment job ${job.data.adjustmentJobId}`);
  } catch (error) {
    const finalAttempt = job.attemptsMade + 1 >= 3;
    if (finalAttempt)
      await uow.adjustmentJobs.update({
        ...processing,
        status: 'failed',
        error: `Reconciliation failed after retries. ${error instanceof Error ? error.message : String(error)}`,
        updatedAt: new Date().toISOString(),
      });
    console.error(`failed adjustment job ${job.data.adjustmentJobId}`, error);
    throw error;
  }
});
