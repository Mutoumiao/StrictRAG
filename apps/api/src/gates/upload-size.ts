import { BizCode } from '@strict-rag/contracts';

/** ADR-039：complete 权威 size 闸（route 与单测共用） */
export function checkUploadByteSize(
  actualBytes: number,
  maxBytes: number,
): { ok: true } | { ok: false; code: typeof BizCode.PAYLOAD_TOO_LARGE } {
  if (actualBytes > maxBytes) {
    return { ok: false, code: BizCode.PAYLOAD_TOO_LARGE };
  }
  return { ok: true };
}
