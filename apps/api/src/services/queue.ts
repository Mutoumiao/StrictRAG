import { QUEUE_NAMES } from '@strict-rag/contracts';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../env.js';
import { logger } from '../logger.js';

export type IngestJobName = 'scan' | 'parse' | 'chunk' | 'embed' | 'es_index';

export type IngestJobData = {
  docId: string;
  kbId: string;
  tenantId: string;
  stage: IngestJobName;
};

let queue: Queue<IngestJobData> | null = null;

function getQueue(): Queue<IngestJobData> {
  if (!queue) {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue<IngestJobData>(QUEUE_NAMES.INGEST, { connection });
  }
  return queue;
}

export async function enqueueIngest(data: IngestJobData): Promise<string | undefined> {
  const q = getQueue();
  const job = await q.add(data.stage, data, {
    removeOnComplete: 200,
    removeOnFail: 100,
  });
  logger.info({ jobId: job.id, ...data }, 'enqueued ingest job');
  return job.id;
}
