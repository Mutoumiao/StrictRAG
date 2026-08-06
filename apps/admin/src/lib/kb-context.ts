'use client';

/** 运营端当前知识库选择（localStorage，非 HTTP）。 */

const KB_STORAGE = 'strict-rag:admin:last-kb-id';

export function readStoredKbId(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(KB_STORAGE) ?? '';
}

export function writeStoredKbId(kbId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KB_STORAGE, kbId);
}
