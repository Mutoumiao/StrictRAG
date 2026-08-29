import {
  EVAL_JOB_DEFAULT_ATTEMPTS,
  EVAL_JOB_NAME,
  INGEST_JOB_BACKOFF_MS,
  INGEST_JOB_DEFAULT_ATTEMPTS,
  QUEUE_NAMES,
  type EvalJobData,
  type IngestJobData,
} from '@strict-rag/contracts';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../env.js';
import { logger } from '../logger.js';

/** 与 worker 同源：`@strict-rag/contracts` IngestJobData */
export type { IngestJobData, EvalJobData };

let queue: Queue<IngestJobData> | null = null;
let evalQueue: Queue<EvalJobData> | null = null;
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}

function getQueue(): Queue<IngestJobData> {
  if (!queue) {
    queue = new Queue<IngestJobData>(QUEUE_NAMES.INGEST, {
      connection: getRedis(),
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

function getEvalQueue(): Queue<EvalJobData> {
  if (!evalQueue) {
    evalQueue = new Queue<EvalJobData>(QUEUE_NAMES.EVAL, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: EVAL_JOB_DEFAULT_ATTEMPTS,
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });
  }
  return evalQueue;
}

export async function enqueueIngest(data: IngestJobData): Promise<string | undefined> {
  const q = getQueue();
  const job = await q.add(data.stage, data);
  logger.info({ jobId: job.id, ...data }, 'enqueued ingest job');
  return job.id;
}

export async function enqueueEval(data: EvalJobData): Promise<string | undefined> {
  const job = await getEvalQueue().add(EVAL_JOB_NAME, data);
  logger.info({ jobId: job.id, runId: data.runId, kbId: data.kbId }, 'enqueued eval job');
  return job.id;
}

/** 优雅关闭：关闭 Queue + Redis（幂等） */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (evalQueue) {
    await evalQueue.close();
    evalQueue = null;
  }
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}
