import { env } from '../env.js';
import { childLogger } from '../logger.js';
import { noopTracer, type SpanTracer } from '../graph/tracer.js';
import { createMemoryTracer, type MemoryTracer } from './memory-tracer.js';

export type AskTracerHandle = {
  tracer: SpanTracer;
  memory?: MemoryTracer;
  /** finalize 时写 score；dev 打 info */
  finish: (scores: {
    answered: boolean;
    min_support?: number;
    reason_code: string;
    latency_ms: number;
  }) => void;
};

/**
 * Langfuse 接线入口（P2 骨架）。
 * - 始终可用 memory exporter（单测 / 本地可见主链）
 * - LANGFUSE_ENABLED=true 时额外打日志提示（真 SDK → 后续；不新增依赖）
 * - 未配置密钥不阻断 ask
 */
export function createAskTracer(ctx: {
  requestId: string;
  tenantId?: string;
  userId?: string;
  kbId?: string;
  sessionId?: string | null;
  mode?: string;
}): AskTracerHandle {
  const metadata = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kbId: ctx.kbId,
    sessionId: ctx.sessionId ?? null,
    mode: ctx.mode,
    requestId: ctx.requestId,
  };

  // ponytail: 默认 memory 便于验收；生产可关 OBS_MEMORY_TRACE=false
  const useMemory = env.OBS_MEMORY_TRACE;
  const memory = useMemory
    ? createMemoryTracer(ctx.requestId, metadata)
    : undefined;
  const tracer: SpanTracer = memory ?? noopTracer;
  const log = childLogger({
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kbId: ctx.kbId,
    sessionId: ctx.sessionId ?? undefined,
  });

  return {
    tracer,
    memory,
    finish(scores) {
      memory?.endTrace({
        answered: scores.answered,
        ...(scores.min_support !== undefined ? { min_support: scores.min_support } : {}),
        reason_code: scores.reason_code,
        latency_ms: scores.latency_ms,
      });
      if (env.LANGFUSE_ENABLED) {
        // 无 SDK：结构化日志作 mock export，失败不抛
        log.info(
          {
            langfuse: true,
            spans: memory?.getRecord().spans.map((s) => s.name) ?? [],
            scores,
          },
          'langfuse mock export (SDK 未接入；主链 span 已记)',
        );
      }
    },
  };
}
