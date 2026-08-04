/**
 * 队列名 SSOT（api 入队 + worker 消费必须一致）。
 */
/** BullMQ 禁止队列名包含 `:`，故用连字符前缀。 */
export const QUEUE_NAMES = {
  PROBE: 'sr-probe',
  INGEST: 'sr-ingest',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
