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
