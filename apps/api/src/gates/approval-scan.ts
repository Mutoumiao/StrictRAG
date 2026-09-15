import { BizCode } from '@strict-rag/contracts';

/** ADR-048：仅 approved 可入队 scan */
export function canEnqueueScan(approvalStatus: string): boolean {
  return approvalStatus === 'approved';
}

export function scanDeniedCode(): typeof BizCode.FORBIDDEN {
  return BizCode.FORBIDDEN;
}

/** 仅 status=ready 可 PATCH 为 active */
export function canBecomeActive(status: string): boolean {
  return status === 'ready';
}

/**
 * ADR-048 #4 四眼：提交人不得自决（approve / reject 同口径）。
 * 只在**同时**认得出 actor 与提交人时生效；缺任一侧不拦，
 * 以免 `AUTH_ENFORCE` 关（无 actor）或历史文（无提交人）把运营台锁死。
 */
export function evaluateSelfDecide(input: {
  actorUserId?: string | null;
  submittedBy?: string | null;
}): { ok: true } | { ok: false; message: string } {
  const actor = input.actorUserId;
  const submitted = input.submittedBy;
  if (!actor || !submitted || actor !== submitted) {
    return { ok: true };
  }
  return { ok: false, message: 'submitter cannot decide own ticket' };
}
