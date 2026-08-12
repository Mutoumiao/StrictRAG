import {
  QUEUE_NAMES as SHARED_QUEUE_NAMES,
  type IngestJobData,
  type IngestStage,
} from '@strict-rag/contracts';

/** 队列名（与 contracts SSOT 一致） */
export const QUEUE_NAMES = SHARED_QUEUE_NAMES;

export type ProbeJobName = 'noop';

export type ProbeJobData = {
  reason: string;
  enqueuedAt: string;
};

export type { IngestJobData, IngestStage };

/**
 * 入库 job payload 类型见 `@strict-rag/contracts` `IngestJobData`。
 *
 * HOW：`.trellis/spec/worker/backend/ingest-idempotency.md`
 * - embed / es_index **必须**能解析到 indexVersion（job 或 doc）
 * - 重试 = 同 version 重跑 embed|es；**禁止**重试路径再 chunk 抬 version
 */
