import { BizCode, type BizCode as BizCodeType } from '@strict-rag/contracts';

export type PgBizMapping = {
  httpStatus: 400 | 409 | 500;
  code: BizCodeType;
  message: string;
  pgCode?: string;
};

type PgLike = {
  code?: string;
  name?: string;
};

/**
 * 从 err / cause 链解包 PG 错误（深度上限 5）。
 * 识别 postgres.js PostgresError（name + code）与裸 { code }。
 */
export function extractPgError(err: unknown, depth = 0): PgLike | null {
  if (err == null || depth > 5) return null;
  if (typeof err !== 'object') return null;

  const e = err as PgLike & { cause?: unknown };
  if (typeof e.code === 'string' && e.code.length > 0) {
    // postgres.js：name === 'PostgresError'
    // 裸 SQLSTATE：5 位且**以数字开头**（类 00–5Z）；避免误匹配 Node `EPERM`/`EPIPE` 等
    const sqlstate = /^[0-9][0-9A-Z]{4}$/.test(e.code);
    if (e.name === 'PostgresError' || sqlstate) {
      return { code: e.code, name: e.name };
    }
  }

  if ('cause' in e && e.cause !== undefined) {
    return extractPgError(e.cause, depth + 1);
  }
  return null;
}

/** PG SQLSTATE → 本仓 BizCode（写死表；勿自创码） */
export function mapPgErrorToBiz(pg: PgLike | null): PgBizMapping {
  const pgCode = pg?.code;
  switch (pgCode) {
    case '23505':
      return {
        httpStatus: 409,
        code: BizCode.CONFLICT,
        message: '数据冲突或已存在',
        pgCode,
      };
    case '23503':
      return {
        httpStatus: 409,
        code: BizCode.CONFLICT,
        message: '关联数据不存在或正在被引用',
        pgCode,
      };
    case '23502':
      return {
        httpStatus: 400,
        code: BizCode.VALIDATION_ERROR,
        message: '必填字段不能为空',
        pgCode,
      };
    case '23514':
      return {
        httpStatus: 400,
        code: BizCode.VALIDATION_ERROR,
        message: '数据不满足约束条件',
        pgCode,
      };
    case '40001':
    case '40P01':
      return {
        httpStatus: 409,
        code: BizCode.CONFLICT,
        message: '操作冲突，请重试',
        pgCode,
      };
    default:
      return {
        httpStatus: 500,
        code: BizCode.INTERNAL,
        message: '内部错误',
        pgCode,
      };
  }
}
