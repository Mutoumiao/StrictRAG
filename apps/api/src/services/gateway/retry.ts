import { GatewayError, type GatewayPurpose } from './errors.js';

/** ADR-032 / PRD：default.maxAttempts=2（含首跳 = 至多 1 次重试） */
export const DEFAULT_MAX_ATTEMPTS = 2;

/**
 * 同模型重试：仅 retryable kind；非 retryable 立即抛出。
 * 耗尽 → kind=exhausted（上层映射 abstain，禁止假 answered）。
 */
export async function withSameModelRetry<T>(params: {
  purpose: GatewayPurpose | string;
  maxAttempts?: number;
  run: (attempt: number) => Promise<T>;
}): Promise<T> {
  const max = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let last: GatewayError | undefined;

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await params.run(attempt);
    } catch (err) {
      if (!(err instanceof GatewayError)) throw err;
      last = err;
      if (!err.retryable || attempt >= max) {
        if (err.retryable && attempt >= max) {
          throw new GatewayError(
            'exhausted',
            `gateway ${params.purpose}: all ${max} attempts failed (${err.kind}: ${err.message})`,
            params.purpose,
            { attempt, status: err.details?.status, provider: err.details?.provider, model: err.details?.model },
          );
        }
        throw err;
      }
    }
  }

  throw (
    last ??
    new GatewayError('exhausted', `gateway ${params.purpose}: no attempts`, params.purpose)
  );
}
