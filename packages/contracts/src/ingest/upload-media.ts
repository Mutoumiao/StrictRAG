/**
 * 入库 MIME / 扩展名白名单（ADR-039）。
 * 未知类型与 application/octet-stream 不得默许。
 */

export const ALLOWED_INGEST_CONTENT_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const;

export type AllowedIngestContentType = (typeof ALLOWED_INGEST_CONTENT_TYPES)[number];

export const ALLOWED_INGEST_EXTENSIONS = ['txt', 'md', 'markdown', 'pdf', 'docx', 'doc'] as const;

export type AllowedIngestExtension = (typeof ALLOWED_INGEST_EXTENSIONS)[number];

const TYPE_SET = new Set<string>(ALLOWED_INGEST_CONTENT_TYPES);
const EXT_SET = new Set<string>(ALLOWED_INGEST_EXTENSIONS);

export function normalizeContentType(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
}

export function extensionFromFileName(name: string | null | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

export function contentTypeFromExtension(ext: string | null | undefined): AllowedIngestContentType | null {
  if (!ext) return null;
  if (ext === 'txt') return 'text/plain';
  if (ext === 'md' || ext === 'markdown') return 'text/markdown';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  return null;
}

export function isAllowedIngestMedia(input: {
  contentType: string | null | undefined;
  fileName?: string | null;
}): boolean {
  const ct = normalizeContentType(input.contentType);
  if (!TYPE_SET.has(ct)) return false;
  const ext = extensionFromFileName(input.fileName);
  if (ext && !EXT_SET.has(ext)) return false;
  return true;
}

/** 声明类型优先；空/未知时仅按白名单扩展名推断。推断失败返回 null。 */
export function resolveIngestContentType(input: {
  contentType?: string | null;
  fileName?: string | null;
}): AllowedIngestContentType | null {
  const declared = normalizeContentType(input.contentType);
  if (declared && TYPE_SET.has(declared)) {
    const ext = extensionFromFileName(input.fileName);
    if (ext && !EXT_SET.has(ext)) return null;
    return declared as AllowedIngestContentType;
  }
  const inferred = contentTypeFromExtension(extensionFromFileName(input.fileName));
  if (!inferred) return null;
  if (!isAllowedIngestMedia({ contentType: inferred, fileName: input.fileName })) return null;
  return inferred;
}

export const SHA256_HEX_RE = /^[a-fA-F0-9]{64}$/;
