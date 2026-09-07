/**
 * 入库阶段失败可选 Webhook。空 URL 不发；只试一次；失败 warn 不阻断。
 */

import { formatLocalDateTime } from '@strict-rag/db';

import { env } from '../env.js';
import { logger } from '../logger.js';

export const INGEST_FAILED_EVENT = 'ingest.failed' as const;
const DEFAULT_TIMEOUT_MS = 3000;

export type IngestFailureNotifyInput = {
  tenantId: string;
  kbId: string;
  docId: string;
  stage: string;
  errorCode: string;
  jobId?: string;
};

export type IngestFailureWebhookBody = {
  event: typeof INGEST_FAILED_EVENT;
  tenantId: string;
  kbId: string;
  docId: string;
  stage: string;
  errorCode: string;
  at: string;
  jobId?: string;
};

export type NotifyIngestFailureDeps = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  url?: string;
  timeoutMs?: number;
};

export function buildIngestFailureWebhookBody(
  payload: IngestFailureNotifyInput,
  at: string,
): IngestFailureWebhookBody {
  const body: IngestFailureWebhookBody = {
    event: INGEST_FAILED_EVENT,
    tenantId: payload.tenantId,
    kbId: payload.kbId,
    docId: payload.docId,
    stage: payload.stage,
    errorCode: payload.errorCode,
    at,
  };
  if (payload.jobId) body.jobId = payload.jobId;
  return body;
}

export async function notifyIngestFailure(
  payload: IngestFailureNotifyInput,
  deps: NotifyIngestFailureDeps = {},
): Promise<void> {
  const url = (deps.url ?? env.INGEST_FAILURE_WEBHOOK_URL ?? '').trim();
  if (!url) return;

  const fetchImpl = deps.fetchImpl ?? fetch;
  const at = formatLocalDateTime((deps.now ?? (() => new Date()))());
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const body = buildIngestFailureWebhookBody(payload, at);

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status, docId: payload.docId, stage: payload.stage },
        'ingest failure webhook non-2xx (non-blocking)',
      );
    }
  } catch (err) {
    logger.warn(
      { err, docId: payload.docId, stage: payload.stage },
      'ingest failure webhook failed (non-blocking)',
    );
  }
}
