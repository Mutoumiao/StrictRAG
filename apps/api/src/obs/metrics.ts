/**
 * 进程内指标骨架（P2 · #11）。
 * 非 Prometheus 全量；可 snapshot / 打日志聚合。完整直方图 → P4。
 */

export type MetricLabels = Record<string, string | number | boolean | undefined>;

type CounterKey = string;

const counters = new Map<CounterKey, number>();

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

export function recordLlmCall(purpose: string, ok: boolean): void {
  metricInc('llm_call_total', { purpose, ok: String(ok) });
}

export function recordRerank(ok: boolean, kind?: string): void {
  metricInc('rerank_total', { ok: String(ok), ...(kind ? { kind } : {}) });
}

export function recordRateLimited(scope: string): void {
  metricInc('ask_rate_limited_total', { scope });
}
