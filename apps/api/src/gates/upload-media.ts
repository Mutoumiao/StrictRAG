import { BizCode, isAllowedIngestMedia } from '@strict-rag/contracts';

/** ADR-039：complete 权威 MIME/扩展名闸（route 与单测共用） */
export function checkUploadMedia(input: {
  contentType: string | null | undefined;
  fileName?: string | null;
}): { ok: true } | { ok: false; code: typeof BizCode.UNSUPPORTED_MEDIA_TYPE } {
  if (!isAllowedIngestMedia(input)) {
    return { ok: false, code: BizCode.UNSUPPORTED_MEDIA_TYPE };
  }
  return { ok: true };
}
