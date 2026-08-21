/**
 * HALF-PARSE：明示 UTF-8 txt/md 才当文本层；其它走 needs_ocr（不接 OCR）。
 * PDF 文本层见 HALF-PDF，本文件只认 txt/md。
 */
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/x-markdown']);
const TEXT_EXT = /\.(txt|md|markdown)$/i;

function mimeType(contentType: string | null | undefined): string {
  return (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

export function hasUtf8TextLayer(
  contentType: string | null | undefined,
  objectKey: string | null | undefined,
): boolean {
  const ct = mimeType(contentType);
  if (TEXT_TYPES.has(ct)) return true;
  // 已声明的非 txt/md MIME 不得靠扩展名当成文本层（HALF-PDF 之前含 application/pdf）
  if (ct) return false;
  const key = objectKey ?? '';
  const base = key.split(/[/\\]/).pop() ?? key;
  return TEXT_EXT.test(base);
}

export function decodeUtf8Text(buf: Buffer): string {
  return buf.toString('utf8');
}

export type Utf8TextExtractResult =
  | { ok: true; text: string }
  | { ok: false; errorCode: 'NO_TEXT_LAYER' };

/** 给定 contentType / 文件名 / 字节：抽出 UTF-8 或明示无文本层（不把二进制当 UTF-8）。 */
export function extractUtf8TextLayer(
  contentType: string | null | undefined,
  objectKey: string | null | undefined,
  buf: Buffer,
): Utf8TextExtractResult {
  if (!hasUtf8TextLayer(contentType, objectKey)) {
    return { ok: false, errorCode: 'NO_TEXT_LAYER' };
  }
  return { ok: true, text: decodeUtf8Text(buf) };
}
