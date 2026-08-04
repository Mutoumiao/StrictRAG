/**
 * apps/worker — BullMQ consumers
 * Phase 0：探针队列 · Phase 1：ingest 状态机
 */

import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from './env.js';
import { runIngestStage } from './ingest/pipeline.js';
import { logger } from './logger.js';
import {
  QUEUE_NAMES,
  type IngestJobData,
  type ProbeJobData,
} from './queues.js';

function createConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

async function assertRedisReachable(url: string): Promise<void> {
  const probe = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });
  try {
    await probe.connect();
    const pong = await probe.ping();
    if (pong !== 'PONG') {
      throw new Error(`unexpected PING response: ${pong}`);
    }
  } catch (err) {
    logger.fatal({ err }, 'Redis 不可达，worker 退出');
    process.exit(1);
  } finally {
    probe.disconnect();
  }
}

async function main() {
  await assertRedisReachable(env.REDIS_URL);

  const connection = createConnection() as unknown as ConnectionOptions;
  const redisForQueue = createConnection();

  const probeWorker = new Worker<ProbeJobData>(
    QUEUE_NAMES.PROBE,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'probe job started');
      return { ok: true as const, at: new Date().toISOString() };
    },
    { connection },
  );

  probeWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'probe job completed');
  });

  const ingestQueue = new Queue<IngestJobData>(QUEUE_NAMES.INGEST, {
    connection: redisForQueue as unknown as ConnectionOptions,
  });

  const ingestWorker = new Worker<IngestJobData>(
    QUEUE_NAMES.INGEST,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'ingest job started');
      const result = await runIngestStage(job.data);
      if (result.next) {
        await ingestQueue.add(result.next.stage, result.next, {
          removeOnComplete: 200,
          removeOnFail: 100,
        });
        logger.info({ next: result.next.stage, docId: job.data.docId }, 'chained next stage');
      }
      return result;
    },
    { connection },
  );

  ingestWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'ingest job completed');
  });

  ingestWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'ingest job failed');
  });

  if (env.WORKER_PROBE_ON_START) {
    const queue = new Queue<ProbeJobData>(QUEUE_NAMES.PROBE, { connection });
    const job = await queue.add(
      'noop',
      {
        reason: 'worker_start_probe',
        enqueuedAt: new Date().toISOString(),
      },
      { removeOnComplete: 100, removeOnFail: 50 },
    );
    logger.info({ jobId: job.id }, 'enqueued start probe job');
    await queue.close();
  }

  logger.info(
    {
      queues: [QUEUE_NAMES.PROBE, QUEUE_NAMES.INGEST],
      scanMode: env.INGEST_SCAN_MODE,
      esMode: env.INGEST_ES_MODE,
      embedMode: env.INGEST_EMBED_MODE,
    },
    'worker running',
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down worker');
    await Promise.all([probeWorker.close(), ingestWorker.close(), ingestQueue.close()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
