import type { KnowledgeBaseListItem } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listKnowledgeBases() {
  return http.get<KnowledgeBaseListItem[]>('/api/v1/knowledge-bases');
}
