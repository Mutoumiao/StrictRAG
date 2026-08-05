import type { SpanHandle, SpanTracer } from '../graph/tracer.js';

export type SpanRecord = {
  name: string;
  startAttrs?: Record<string, unknown>;
  endAttrs?: Record<string, unknown>;
  startedAt: number;
  endedAt?: number;
};

export type TraceRecord = {
  requestId: string;
  name: string;
  metadata: Record<string, unknown>;
  spans: SpanRecord[];
  scores: Record<string, number | string | boolean>;
  endedAt?: number;
};

/** 进程内 mock Langfuse exporter（dev / 单测可见主链） */
const traces = new Map<string, TraceRecord>();

export function getTraceRecord(requestId: string): TraceRecord | undefined {
  return traces.get(requestId);
}

export function listTraceRecords(): TraceRecord[] {
  return [...traces.values()];
}

export function clearTraceRecords(): void {
  traces.clear();
}

export type MemoryTracer = SpanTracer & {
  setScore: (name: string, value: number | string | boolean) => void;
  endTrace: (scores?: Record<string, number | string | boolean>) => TraceRecord;
  getRecord: () => TraceRecord;
};

/**
 * 创建一次 ask 的 memory tracer。
 * 与设计 §14 span 名对齐：ask.route / retrieve / generate / claim_split / verify / finalize。
 */
export function createMemoryTracer(
  requestId: string,
  metadata: Record<string, unknown> = {},
): MemoryTracer {
  const record: TraceRecord = {
    requestId,
    name: 'kb.ask',
    metadata,
    spans: [],
    scores: {},
  };
  traces.set(requestId, record);

  return {
    startSpan(name, attrs) {
      const span: SpanRecord = {
        name,
        startAttrs: attrs,
        startedAt: Date.now(),
      };
      record.spans.push(span);
      const handle: SpanHandle = {
        end(endAttrs) {
          span.endAttrs = endAttrs;
          span.endedAt = Date.now();
        },
      };
      return handle;
    },
    setScore(name, value) {
      record.scores[name] = value;
    },
    endTrace(scores) {
      if (scores) Object.assign(record.scores, scores);
      record.endedAt = Date.now();
      return record;
    },
    getRecord() {
      return record;
    },
  };
}
