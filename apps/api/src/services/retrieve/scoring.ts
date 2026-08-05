/** 余弦相似度；零向量 → 0 */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/** mock sparse：token 重叠比（BM25 替身；真 ES → B8） */
export function sparseOverlapScore(query: string, text: string): number {
  const tokens = query
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return 0;
  const hay = text.toLowerCase();
  let hit = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hit += 1;
  }
  return hit / tokens.length;
}

export function rankByScore(scored: { id: string; score: number }[]): string[] {
  return [...scored]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
}
