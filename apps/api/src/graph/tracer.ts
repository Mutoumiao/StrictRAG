/**
 * 可观测钩子（设计 §14）。#11 Langfuse 接线；未配置 no-op。
 * 禁止事后大拆 graph 再埋点。
 */
export type SpanHandle = {
  end: (attrs?: Record<string, unknown>) => void;
};

export type SpanTracer = {
  startSpan: (name: string, attrs?: Record<string, unknown>) => SpanHandle;
};

export const noopTracer: SpanTracer = {
  startSpan: () => ({ end: () => {} }),
};
