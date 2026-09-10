/**
 * reindex 入队 stage：卡在 OCR 闸的文档走 ocr，短 utf8 页眉仍走 chunk。
 */

export function reindexEnqueueStage(input: {
  status: string;
  extractMethod?: string | null;
}): 'chunk' | 'ocr' {
  if (input.status === 'needs_review') return 'ocr';
  if (input.status === 'needs_ocr' && input.extractMethod !== 'text') return 'ocr';
  return 'chunk';
}
