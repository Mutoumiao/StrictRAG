/**
 * 队列名 SSOT（api 入队 + worker 消费必须一致）。
 */
/** BullMQ 禁止队列名包含 `:`，故用连字符前缀。 */
export const QUEUE_NAMES = {
  PROBE: 'sr-probe',
  INGEST: 'sr-ingest',
  EVAL: 'sr-eval',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export {
  INGEST_JOB_BACKOFF_MS,
  INGEST_JOB_DEFAULT_ATTEMPTS,
  INGEST_STAGES,
  IngestJobDataSchema,
  type IngestJobData,
  type IngestStage,
} from './ingest-job.js';

export {
  EVAL_JOB_DEFAULT_ATTEMPTS,
  EVAL_JOB_NAME,
  EvalJobDataSchema,
  type EvalJobData,
} from './eval-job.js';
