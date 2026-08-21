/**
 * HALF-PDF：最小 PDF 文本层（无 OCR、无新依赖）。
 * 只扫未压缩 stream 里的 Tj/TJ；失败返回 null → needs_ocr。
 */
export function isPdfObject(
  contentType: string | null | undefined,
  objectKey: string | null | undefined,
): boolean {
  const ct = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (ct === 'application/pdf') return true;
  const base = (objectKey ?? '').split(/[/\\]/).pop() ?? '';
  return /\.pdf$/i.test(base);
}

export function extractPdfTextLayer(buf: Buffer): string | null {
  if (buf.length < 5) return null;
  const head = buf.subarray(0, 5).toString('latin1');
  if (head !== '%PDF-') return null;
  const src = buf.toString('latin1');
  const chunks: string[] = [];
  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(src))) {
    const matched = m[0] ?? '';
    const inner = matched.slice(1, matched.lastIndexOf(')'));
    chunks.push(unescapePdfLiteral(inner));
  }
  const tjArr = /\[(.*?)\]\s*TJ/gs;
  while ((m = tjArr.exec(src))) {
    const parts = (m[1] ?? '').match(/\((?:\\.|[^\\)])*\)/g) ?? [];
    for (const p of parts) chunks.push(unescapePdfLiteral(p.slice(1, -1)));
  }
  const text = chunks.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function unescapePdfLiteral(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
