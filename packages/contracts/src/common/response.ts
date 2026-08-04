import type { BizCode } from './biz-code.js';

/** meta 放请求级信息；data/error 放业务结果。 */
export type ApiMeta = {
  requestId: string;
  timestamp: string;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

export type ApiError = {
  code: BizCode;
  message: string;
  details?: unknown;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
  meta: ApiMeta;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function buildSuccess<T>(data: T, meta: ApiMeta): ApiSuccess<T> {
  return { ok: true, data, meta };
}

export function buildFailure(error: ApiError, meta: ApiMeta): ApiFailure {
  return { ok: false, error, meta };
}
