import { buildFailure, buildSuccess, type ApiError, type BizCode } from '@strict-rag/contracts';
import { format } from 'date-fns';
import type { Context } from 'hono';

import type { ApiVariables } from '../middleware/request-id.js';

function meta(c: Context<{ Variables: ApiVariables }>) {
  return {
    requestId: c.get('requestId'),
    timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  };
}

export function ok<T>(c: Context<{ Variables: ApiVariables }>, data: T, status: 200 | 201 = 200) {
  return c.json(buildSuccess(data, meta(c)), status);
}

export function fail(
  c: Context<{ Variables: ApiVariables }>,
  code: BizCode,
  message: string,
  httpStatus: 400 | 401 | 403 | 404 | 409 | 413 | 500 = 400,
  details?: unknown,
) {
  const error: ApiError = { code, message, details };
  return c.json(buildFailure(error, meta(c)), httpStatus);
}
