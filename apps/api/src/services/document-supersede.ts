import { BizCode } from '@strict-rag/contracts';

/** POST supersede 校验所需的最小文档形状 */
export type DocForSupersede = {
  id: string;
  tenantId: string;
  kbId: string;
  status: string;
  lifecycle: string;
  supersedesDocId?: string | null;
  supersededByDocId?: string | null;
};

export type SupersedeEval =
  | { ok: true }
  | {
      ok: false;
      httpStatus: 400 | 404 | 409;
      code: typeof BizCode.VALIDATION_ERROR | typeof BizCode.NOT_FOUND | typeof BizCode.CONFLICT;
      message: string;
    };

/**
 * 替代联动闸：旧文关检索、后继升 active。
 * 不写库；跨库 / 自指 / 未 ready / 已替代一律 CONFLICT 或 NOT_FOUND。
 */
export function evaluateSupersedeLink(input: {
  old: DocForSupersede | null;
  successor: DocForSupersede | null;
  successorDocId: string;
}): SupersedeEval {
  const { old, successor, successorDocId } = input;
  if (!old) {
    return { ok: false, httpStatus: 404, code: BizCode.NOT_FOUND, message: 'document not found' };
  }
  if (old.id === successorDocId) {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'cannot supersede self',
    };
  }
  if (!successor) {
    return { ok: false, httpStatus: 404, code: BizCode.NOT_FOUND, message: 'successor not found' };
  }
  if (old.tenantId !== successor.tenantId || old.kbId !== successor.kbId) {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'successor must be same knowledge base',
    };
  }
  if (old.lifecycle === 'superseded' || old.lifecycle === 'archived') {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'old document cannot be superseded',
    };
  }
  if (old.supersededByDocId) {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'old document already superseded',
    };
  }
  if (successor.status !== 'ready') {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'successor must be ready',
    };
  }
  if (successor.lifecycle === 'superseded' || successor.lifecycle === 'archived') {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'successor cannot be superseded or archived',
    };
  }
  if (successor.supersedesDocId && successor.supersedesDocId !== old.id) {
    return {
      ok: false,
      httpStatus: 409,
      code: BizCode.CONFLICT,
      message: 'successor already supersedes another document',
    };
  }
  return { ok: true };
}
