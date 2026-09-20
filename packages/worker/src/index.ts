import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

export const ADJUSTMENT_QUEUE = 'trachex-adjustments';
const REDIS_TIMEOUT_MS = 10_000;
export interface AdjustmentPayload {
  adjustmentJobId: string;
}

export function createAdjustmentQueue(redisUrl: string): {
  queue: Queue<AdjustmentPayload>;
  close: () => Promise<void>;
} {
  const connection = new Redis(redisUrl, {
    commandTimeout: REDIS_TIMEOUT_MS,
    connectTimeout: REDIS_TIMEOUT_MS,
    // Do not leave Queue.add waiting in ioredis's offline command queue while
    // Redis is unreachable. The API must be able to mark the job failed.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  const queue = new Queue<AdjustmentPayload>(ADJUSTMENT_QUEUE, { connection });
  return {
    queue,
    close: async () => {
      await queue.close();
      try {
        await connection.quit();
      } catch {
        // A failed connection cannot accept QUIT. Disconnect it so callers do
        // not retain ioredis reconnect timers after a bounded enqueue failure.
        connection.disconnect();
      }
    },
  };
}

export async function enqueueAdjustment(
  redisUrl: string,
  adjustmentJobId: string,
): Promise<{ queueJobId: string; close: () => Promise<void> }> {
  const owned = createAdjustmentQueue(redisUrl);
  try {
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
  } catch (error) {
    await owned.close().catch(() => undefined);
    throw error;
  }
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
