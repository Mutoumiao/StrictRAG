import type { AskReason } from '@strict-rag/contracts';

/** 可重试：timeout / rate_limit / 5xx / network；auth/bad_request 等不重试 */
export type GatewayErrorKind =
  | 'timeout'
  | 'rate_limit'
  | 'provider_5xx'
  | 'network'
  | 'auth'
  | 'bad_request'
  | 'content_filter'
  | 'unavailable'
  | 'exhausted';

export type GatewayPurpose = 'chat' | 'embed' | 'rerank';

export class GatewayError extends Error {
  readonly name = 'GatewayError';

  constructor(
    readonly kind: GatewayErrorKind,
    message: string,
    readonly purpose: GatewayPurpose | string,
    readonly details?: { attempt?: number; status?: number; provider?: string; model?: string },
  ) {
    super(message);
  }

  get retryable(): boolean {
    return (
      this.kind === 'timeout' ||
      this.kind === 'rate_limit' ||
      this.kind === 'provider_5xx' ||
      this.kind === 'network'
    );
  }
}

export class GatewayConfigError extends Error {
  readonly name = 'GatewayConfigError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * 全链失败 → ask reason。
 * 禁止调用方 silent 映射为 answered/verified。
 */
export function mapGatewayFailureToAskReason(
  err: GatewayError,
  purpose: GatewayPurpose,
): AskReason {
  if (purpose === 'rerank' || err.purpose === 'rerank') {
    return 'rerank_unavailable';
  }
  if (purpose === 'embed' || err.purpose === 'embed') {
    return 'low_retrieval';
  }
  return 'internal_guard';
}

/** HTTP 状态 → 错误种类 */
export function kindFromHttpStatus(status: number): GatewayErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 422) return 'bad_request';
  if (status >= 500) return 'provider_5xx';
  return 'unavailable';
}
