import {
  INGEST_JOB_BACKOFF_MS,
  INGEST_JOB_DEFAULT_ATTEMPTS,
  QUEUE_NAMES,
  type IngestJobData,
} from '@strict-rag/contracts';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../env.js';
import { logger } from '../logger.js';

/** 与 worker 同源：`@strict-rag/contracts` IngestJobData */
export type { IngestJobData };

let queue: Queue<IngestJobData> | null = null;
let redis: Redis | null = null;

function getQueue(): Queue<IngestJobData> {
  if (!queue) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue<IngestJobData>(QUEUE_NAMES.INGEST, {
      connection: redis,
      defaultJobOptions: {
        attempts: INGEST_JOB_DEFAULT_ATTEMPTS,
        backoff: { type: 'exponential', delay: INGEST_JOB_BACKOFF_MS },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });
  }
  return queue;
}

export async function enqueueIngest(data: IngestJobData): Promise<string | undefined> {
  const q = getQueue();
  const job = await q.add(data.stage, data);
  logger.info({ jobId: job.id, ...data }, 'enqueued ingest job');
  return job.id;
}

/** 优雅关闭：关闭 Queue + Redis（幂等） */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}
