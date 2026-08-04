/**
 * 默认检索闸（双闸门 ADR-038）：
 * status=ready ∧ lifecycle=active ∧ 当前 indexVersion。
 * P2 retrieve 必须复用此谓词；P1 单测护栏。
 */
export type RetrievalDocLike = {
  status: string;
  lifecycle: string;
};

export function isDefaultRetrievable(doc: RetrievalDocLike): boolean {
  return doc.status === 'ready' && doc.lifecycle === 'active';
}

export function filterDefaultRetrievable<T extends RetrievalDocLike>(docs: T[]): T[] {
  return docs.filter(isDefaultRetrievable);
}
