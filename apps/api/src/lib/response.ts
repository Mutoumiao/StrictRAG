import {
  buildFailure,
  buildSuccess,
  type ApiError,
  type ApiFailure,
  type BizCode,
} from '@strict-rag/contracts';
import { format } from 'date-fns';
import type { Context } from 'hono';

import type { ApiVariables } from '../middleware/request-id.js';

function meta(c: Context<{ Variables: ApiVariables }>) {
  let requestId = 'unknown';
  try {
    requestId = c.get('requestId') || 'unknown';
  } catch {
    // requestId middleware 未跑到时
  }
  return {
    requestId,
    timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  };
}

/** 失败信封对象（timeout 需先组装 body 再包 HTTPException） */
export function buildFailureJson(
  c: Context<{ Variables: ApiVariables }>,
  code: BizCode,
  message: string,
  details?: unknown,
): ApiFailure {
  const error: ApiError = { code, message, details };
  return buildFailure(error, meta(c));
}

export function ok<T>(c: Context<{ Variables: ApiVariables }>, data: T, status: 200 | 201 = 200) {
  return c.json(buildSuccess(data, meta(c)), status);
}

export function fail(
  c: Context<{ Variables: ApiVariables }>,
  code: BizCode,
  message: string,
  httpStatus: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 = 400,
  details?: unknown,
) {
  return c.json(buildFailureJson(c, code, message, details), httpStatus);
}
