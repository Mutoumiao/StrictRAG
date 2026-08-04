/**
 * 进程内 ES 索引 mock（P1 对账 / 失败路径）。
 * 生产替换为真实 ES bulk。
 */
const index = new Map<string, Set<string>>();

function key(kbId: string, indexVersion: number): string {
  return `${kbId}:v${indexVersion}`;
}

export const mockEsStore = {
  reset() {
    index.clear();
  },

  bulkIndex(kbId: string, indexVersion: number, chunkIds: string[]) {
    const k = key(kbId, indexVersion);
    const set = index.get(k) ?? new Set<string>();
    for (const id of chunkIds) set.add(id);
    index.set(k, set);
  },

  listChunkIds(kbId: string, indexVersion: number): string[] {
    return [...(index.get(key(kbId, indexVersion)) ?? new Set())].sort();
  },

  reconcile(kbId: string, indexVersion: number, manifestIds: string[]): { ok: boolean; missing: string[]; orphan: string[] } {
    const es = new Set(this.listChunkIds(kbId, indexVersion));
    const mf = new Set(manifestIds);
    const missing = manifestIds.filter((id) => !es.has(id));
    const orphan = [...es].filter((id) => !mf.has(id));
    return { ok: missing.length === 0 && orphan.length === 0, missing, orphan };
  },
};
