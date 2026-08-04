/**
 * apps/worker — BullMQ consumers（入库 / 对账 / 评测等）
 *
 * 骨架阶段：无队列、无 processor。
 * Phase 0：进程可起 + 探针队列 noop。
 * 规格：prds/06-async、prds/04-pipelines/01-offline-ingest.md
 */

export const APP_WORKER_SCAFFOLD = true as const;
