/**
 * 进程内指标骨架（P2 · #11）。
 * 非 Prometheus 全量；可 snapshot / 打日志聚合。完整直方图 → P4。
 */

import { logger } from '../logger.js';

export type MetricLabels = Record<string, string | number | boolean | undefined>;

type CounterKey = string;
type L3GuardKind = 'coref_fail_rate' | 'rewrite_dogfood' | 'topic_complaint' | 'l2_stale';

const counters = new Map<CounterKey, number>();
const l3AlertLatched = new Set<L3GuardKind>();

// ponytail: 进程寿命比，不是运维 PRD 的 1h 滑窗；要滑窗另开
export const L3_CORE_FAIL_RATE_MIN_SESSION = 20;
export const L3_CORE_FAIL_RATE_THRESHOLD = 0.2;
// ponytail: 进程寿命近似，不是运维 PRD 的 1h 滑窗
export const L3_TOPIC_COMPLAINT_THRESHOLD = 5;

function key(name: string, labels?: MetricLabels): CounterKey {
  if (!labels) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${String(labels[k] ?? '')}`);
  return parts.length ? `${name}{${parts.join(',')}}` : name;
}

/** 计数 +1（或 delta） */
export function metricInc(name: string, labels?: MetricLabels, delta = 1): void {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + delta);
}

export function metricGet(name: string, labels?: MetricLabels): number {
  return counters.get(key(name, labels)) ?? 0;
}

/** 导出快照（测试 / GET /metrics） */
export function metricsSnapshot(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function metricsReset(): void {
  counters.clear();
  l3AlertLatched.clear();
}

/** ask 结果：status / reason */
export function recordAskResult(input: {
  status: string;
  reason: string;
  ok: boolean;
}): void {
  metricInc('ask_total', { status: input.status, reason: input.reason });
  metricInc(input.ok ? 'ask_ok' : 'ask_fail', { reason: input.reason });
}

/** L3 多轮护栏打点 + 进程内告警闩。只告警，不改默认 / 不熔断。 */
export function recordL3Ask(input: {
  rewriteUsed: boolean;
  reason: string;
  hasSession: boolean;
  sessionDeepened?: boolean;
  documentBackref?: boolean;
  externalBackref?: boolean;
  rewriteEnvOn?: boolean;
}): void {
  if (input.rewriteUsed) metricInc('l3_rewrite_used_total');
  if (input.reason === 'coref_unresolved') metricInc('l3_coref_fail_total');
  if (input.hasSession) metricInc('l3_session_ask_total');
  if (input.sessionDeepened) metricInc('l3_session_deepened_total');
  if (input.documentBackref) metricInc('l3_document_backref_total');
  if (input.externalBackref) metricInc('l3_external_backref_total');
  latchL3GuardAlerts(input.rewriteEnvOn === true);
}

function latchL3GuardAlert(kind: L3GuardKind, extra: Record<string, unknown>): void {
  if (l3AlertLatched.has(kind)) return;
  l3AlertLatched.add(kind);
  metricInc('l3_guard_alert_total', { kind });
  logger.warn({ event: 'l3_guard', kind, ...extra }, 'l3 guard alert');
}

function latchL3GuardAlerts(rewriteEnvOn: boolean): void {
  if (rewriteEnvOn) {
    latchL3GuardAlert('rewrite_dogfood', { rewriteEnvOn: true });
  }
  const sessionAsk = metricGet('l3_session_ask_total');
  const corefFail = metricGet('l3_coref_fail_total');
  if (
    sessionAsk >= L3_CORE_FAIL_RATE_MIN_SESSION &&
    corefFail / sessionAsk >= L3_CORE_FAIL_RATE_THRESHOLD
  ) {
    latchL3GuardAlert('coref_fail_rate', { sessionAsk, corefFail });
  }
}

export function recordL3TopicComplaint(input: { hasSession: boolean }): void {
  if (!input.hasSession) return;
  metricInc('l3_topic_complaint_total');
  const complaints = metricGet('l3_topic_complaint_total');
  if (complaints >= L3_TOPIC_COMPLAINT_THRESHOLD) {
    latchL3GuardAlert('topic_complaint', { complaints });
  }
}

// ponytail: last 由调用方注入；本函数零 I/O。env 开且从未 persist L2 时会与 rewrite_dogfood 叠告，允许。
export function evaluateL2Stale(input: {
  rewriteEnvOn?: boolean;
  current: string;
  last?: string | null;
}): void {
  if (input.rewriteEnvOn !== true) return;
  const stale = !input.last || input.last !== input.current;
  if (!stale) return;
  latchL3GuardAlert('l2_stale', { kind: 'l2_stale' });
}

export function recordLlmCall(purpose: string, ok: boolean): void {
  metricInc('llm_call_total', { purpose, ok: String(ok) });
}

export function recordRerank(ok: boolean, kind?: string): void {
  metricInc('rerank_total', { ok: String(ok), ...(kind ? { kind } : {}) });
}

export function recordRateLimited(scope: string): void {
  metricInc('ask_rate_limited_total', { scope });
}
