import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

export const ADJUSTMENT_QUEUE = 'trachex-adjustments';
export interface AdjustmentPayload {
  adjustmentJobId: string;
}

export function createAdjustmentQueue(redisUrl: string): {
  queue: Queue<AdjustmentPayload>;
  close: () => Promise<void>;
} {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<AdjustmentPayload>(ADJUSTMENT_QUEUE, { connection });
  return {
    queue,
    close: async () => {
      await queue.close();
      await connection.quit();
    },
  };
}

export async function enqueueAdjustment(
  redisUrl: string,
  adjustmentJobId: string,
): Promise<{ queueJobId: string; close: () => Promise<void> }> {
  const owned = createAdjustmentQueue(redisUrl);
  const queued = await owned.queue.add(
    'reconcile-adjustment',
    { adjustmentJobId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    },
  );
  return { queueJobId: queued.id ?? adjustmentJobId, close: owned.close };
}

export function createAdjustmentWorker(
  redisUrl: string,
  processJob: (job: Job<AdjustmentPayload>) => Promise<void>,
) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<AdjustmentPayload>(ADJUSTMENT_QUEUE, processJob, {
    connection,
    concurrency: 1,
    autorun: true,
  });
  return {
    worker,
    close: async () => {
      await worker.close();
      await connection.quit();
    },
  };
}
