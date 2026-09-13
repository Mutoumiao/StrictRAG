import { BizCode } from '@strict-rag/contracts';

export type DeleteEval =
  | { ok: true }
  | {
      ok: false;
      httpStatus: 404;
      code: typeof BizCode.NOT_FOUND;
      message: string;
    };

/** DELETE 闸：缺文档 404。已 archived 仍可入队 purge。 */
export function evaluateDocumentDelete(doc: { id: string } | null): DeleteEval {
  if (!doc) {
    return { ok: false, httpStatus: 404, code: BizCode.NOT_FOUND, message: 'document not found' };
  }
  return { ok: true };
}
