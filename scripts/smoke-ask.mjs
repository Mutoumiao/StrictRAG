/**
 * HALF-SMOKE：从 ask 信封取出用户可见 citations。
 * 烟测脚本与单测共用，禁止在测里另写判定。
 * 只认 data.citations（AskResponse）；图内部 evidence / debug 不当引用。
 * 空引用 / 非 ok / 非 answered / 无 docId → 失败。
 */
export function citationsFromAskEnvelope(json) {
  if (!json || json.ok !== true || !json.data) return [];
  const cites = json.data.citations;
  return Array.isArray(cites) ? cites : [];
}

export function citationHasDocId(c) {
  return Boolean(c && typeof c === 'object' && typeof c.docId === 'string' && c.docId.length > 0);
}

export function askHasCitations(json) {
  if (!json || json.ok !== true || json.data?.status !== 'answered') return false;
  return citationsFromAskEnvelope(json).some(citationHasDocId);
}
