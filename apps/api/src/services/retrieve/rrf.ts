/**
 * Reciprocal Rank Fusion。
 * score = Σ 1/(k + rank)；rank 从 1 起。
 * 仅作候选融合 — 不可跳过 rerank 当 answered 出口。
 */
export function rrfFuse(
  rankedLists: string[][],
  k = 60,
): { id: string; score: number; ranks: number[] }[] {
  const acc = new Map<string, { score: number; ranks: number[] }>();
  for (let li = 0; li < rankedLists.length; li++) {
    const list = rankedLists[li] ?? [];
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      if (!id) continue;
      const rank = i + 1;
      const cur = acc.get(id) ?? { score: 0, ranks: [] };
      cur.score += 1 / (k + rank);
      cur.ranks[li] = rank;
      acc.set(id, cur);
    }
  }
  return [...acc.entries()]
    .map(([id, v]) => ({ id, score: v.score, ranks: v.ranks }))
    .sort((a, b) => b.score - a.score);
}
