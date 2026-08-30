'use client';

import type { CreateKbBody, CreateKbResponse, KnowledgeBaseListItem } from '@strict-rag/contracts';

import { http } from '@/lib/http';

/** GET 可见库；壳只消费本次行，失败不回退粘贴。 */
export async function listKnowledgeBases() {
  return http.get<KnowledgeBaseListItem[]>('/api/v1/knowledge-bases');
}

export async function createKnowledgeBase(body: CreateKbBody) {
  return http.post<CreateKbResponse, CreateKbBody>('/api/v1/knowledge-bases', body);
}
