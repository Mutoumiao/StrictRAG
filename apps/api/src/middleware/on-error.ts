import { BizCode } from '@strict-rag/contracts';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { extractPgError, mapPgErrorToBiz } from '../lib/pg-error.js';
import { fail } from '../lib/response.js';
import { childLogger } from '../logger.js';
import type { ApiVariables } from './request-id.js';

/**
 * 全局未捕获错误 → 标准 ApiFailure。
 * 业务路径应继续显式 fail()；本 handler 仅兜底 throw / 框架级错误。
 */
export const onErrorHandler: ErrorHandler<{ Variables: ApiVariables }> = (err, c) => {
  const requestId = (() => {
    try {
      return c.get('requestId');
    } catch {
      return undefined;
    }
  })();
  const log = childLogger({ requestId });

  // HTTPException：已有自定义 body 则原样返回，避免双重包装
  if (err instanceof HTTPException) {
    if (err.res) {
      return err.getResponse();
    }
    // 无 body 时仍走统一信封（尽量映射状态码）
    const status = err.status;
    if (status === 404) {
      return fail(c, BizCode.NOT_FOUND, err.message || '资源不存在', 404);
    }
    if (status === 413) {
      return fail(c, BizCode.PAYLOAD_TOO_LARGE, err.message || '请求体过大', 413);
    }
    if (status === 400) {
      return fail(c, BizCode.VALIDATION_ERROR, err.message || '请求无效', 400);
    }
    if (status === 401) {
      return fail(c, BizCode.UNAUTHORIZED, err.message || '未登录', 401);
    }
    if (status === 403) {
      return fail(c, BizCode.FORBIDDEN, err.message || '无权限', 403);
    }
    if (status === 409) {
      return fail(c, BizCode.CONFLICT, err.message || '冲突', 409);
    }
    if (status === 429) {
      return fail(c, BizCode.RATE_LIMITED, err.message || '请求过于频繁', 429);
    }
    log.error({ err, status }, 'HTTPException without custom body');
    return fail(c, BizCode.INTERNAL, 'internal error', 500);
  }

  // PG 约束类错误（兜底；非业务推荐路径）
  const pg = extractPgError(err);
  if (pg) {
    const mapped = mapPgErrorToBiz(pg);
    log.warn({ err, pgCode: mapped.pgCode, code: mapped.code }, 'pg error mapped');
    return fail(c, mapped.code, mapped.message, mapped.httpStatus);
  }

  log.error({ err }, 'unhandled error');
  return fail(c, BizCode.INTERNAL, 'internal error', 500);
};
