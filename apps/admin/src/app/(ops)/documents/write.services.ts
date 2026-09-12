'use client';

import { mapBizError } from '@/lib/map-biz-error';

import { writeDocument } from './api';
import { pickUploadChunkStrategy, planUploadChunkStrategy } from './upload.services';

export const WRITE_MARKDOWN_TYPE = 'text/markdown';

export function canSubmitWrite(title: string, markdown: string): boolean {
  return title.trim().length > 0 && markdown.trim().length > 0;
}

export type WriteDocumentResult =
  | { ok: true; docId: string }
  | { ok: false; message: string };

export async function writeAdminDocument(
  kbId: string,
  title: string,
  markdown: string,
  chunkStrategy: string,
): Promise<WriteDocumentResult> {
  const trimmedTitle = title.trim();
  const trimmedMarkdown = markdown.trim();
  if (!canSubmitWrite(trimmedTitle, trimmedMarkdown)) {
    return { ok: false, message: '请填写标题和正文' };
  }
  try {
    const data = await writeDocument(kbId, {
      title: trimmedTitle,
      markdown: trimmedMarkdown,
      chunkStrategy,
    });
    return { ok: true, docId: data.docId };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export { pickUploadChunkStrategy as pickWriteChunkStrategy, planUploadChunkStrategy as planWriteChunkStrategy };
