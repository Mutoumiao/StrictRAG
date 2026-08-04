/**
 * 业务异常码 — 前后端共用。
 * **字符串值 = PRD §4 短名**（对外 HTTP `error.code` 直接使用，禁止再点分）。
 * 权威：`prds/05-api/01-http-api-hono.md` §4 · `.trellis/spec/api/backend/error-handling.md`
 */
export const BizCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  CONFLICT: 'CONFLICT',
  RULE_VIOLATION: 'RULE_VIOLATION',
  /** ADR-039 上传超限 */
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  /** 无 active+ready 文档（ask 前置 409） */
  KB_NOT_READY: 'KB_NOT_READY',
  /** rewrite 未准出却要求 rewrite 路径（ADR-047） */
  SESSION_REWRITE_DISABLED: 'SESSION_REWRITE_DISABLED',
  /** 兼容别名：同 rewrite 不可用；禁止用于拒绝多会话壳 */
  SESSION_DISABLED: 'SESSION_DISABLED',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type BizCode = (typeof BizCode)[keyof typeof BizCode];
