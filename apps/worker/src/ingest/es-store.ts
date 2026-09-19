/**
 * 进程内 ES 索引 mock（P1 对账 / 失败路径）。
 * 生产替换为真实 ES bulk。
 *
 * 键按 **docId + indexVersion**（非 kb 聚合）：
 * 同 KB 多文档并行入库时，各文档 manifest 独立对账；
 * 若按 kb 聚合，后入库文档会把先入库 chunk 判为 orphan → 假失败。
 */
const index = new Map<string, Set<string>>();

function key(docId: string, indexVersion: number): string {
  return `${docId}:v${indexVersion}`;
}

export const mockEsStore = {
  reset() {
    index.clear();
  },

  bulkIndex(docId: string, indexVersion: number, chunkIds: string[]) {
    const k = key(docId, indexVersion);
    const set = index.get(k) ?? new Set<string>();
    for (const id of chunkIds) set.add(id);
    index.set(k, set);
  },

  /** 删除该文档全部 indexVersion 的 mock 稀疏项。 */
  dropDoc(docId: string) {
    const prefix = `${docId}:`;
    for (const k of [...index.keys()]) {
      if (k.startsWith(prefix)) index.delete(k);
    }
  },

  /** 该文档在 mock ES 里存在（可能为空集以外）的 indexVersion 列表。 */
  listVersions(docId: string): number[] {
    const prefix = `${docId}:v`;
    const out: number[] = [];
    for (const k of index.keys()) {
      if (!k.startsWith(prefix)) continue;
      const v = Number(k.slice(prefix.length));
      if (Number.isInteger(v)) out.push(v);
    }
    return out.sort((a, b) => a - b);
  },

  /** 按 (docId, indexVersion) 单侧删除；返回是否确有该项。 */
  dropVersion(docId: string, indexVersion: number): boolean {
    return index.delete(key(docId, indexVersion));
  },

  listChunkIds(docId: string, indexVersion: number): string[] {
    return [...(index.get(key(docId, indexVersion)) ?? new Set())].sort();
  },

  /**
   * 对账：该文档 indexVersion 下 ES 集合 ≡ manifest 集合（无 missing、无 orphan）。
   */
  reconcile(
    docId: string,
    indexVersion: number,
    manifestIds: string[],
  ): { ok: boolean; missing: string[]; orphan: string[] } {
    const es = new Set(this.listChunkIds(docId, indexVersion));
    const missing = manifestIds.filter((id) => !es.has(id));
    const orphan = [...es].filter((id) => !manifestIds.includes(id));
    return { ok: missing.length === 0 && orphan.length === 0, missing, orphan };
  },
};
