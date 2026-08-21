import type { KnowledgeBaseListItem } from '@strict-rag/contracts';

export type KbListRow = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
};

export function toKbListItem(row: KbListRow): KnowledgeBaseListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
  };
}

/** 超管 / 无鉴权 demo：全量；否则仅成员库。 */
export function selectVisibleKbs(input: {
  all: KbListRow[];
  memberKbIds: ReadonlySet<string>;
  bypass: boolean;
}): KbListRow[] {
  if (input.bypass) return input.all;
  return input.all.filter((row) => input.memberKbIds.has(row.id));
}
