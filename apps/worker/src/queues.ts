import { QUEUE_NAMES as SHARED_QUEUE_NAMES } from '@strict-rag/contracts';

/** 队列名（与 contracts SSOT 一致） */
export const QUEUE_NAMES = SHARED_QUEUE_NAMES;

export type ProbeJobName = 'noop';

export type ProbeJobData = {
  reason: string;
  enqueuedAt: string;
};

export type IngestStage = 'scan' | 'parse' | 'chunk' | 'embed' | 'es_index';

export type IngestJobData = {
  docId: string;
  kbId: string;
  tenantId: string;
  stage: IngestStage;
};
