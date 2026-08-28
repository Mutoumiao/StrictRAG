import { MongoClient } from 'mongodb';

/**
 * 融合后批取 chunk 权威正文（PRD 03-data/02 §3.2 chunk_bodies）。
 * 检索切片口径：contextPrefix + "\n" + text；禁止检索后字段级改写。
 * URL 空 → 抛错（调用方只在 MONGODB_URL 非空时注入）。
 */

const CHUNK_BODIES = 'chunk_bodies';
const SERVER_SELECTION_TIMEOUT_MS = 3000;

function mongoClient(url: string): MongoClient {
  return new MongoClient(url, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
}

/** 拼接权威切片；与入库 embed/sparse 同口径 */
export function composeChunkSlice(contextPrefix: string | null | undefined, text: string): string {
  const prefix = (contextPrefix ?? '').trim();
  const body = (text ?? '').trim();
  if (prefix && body) return `${prefix}\n${body}`;
  return body || prefix;
}

/** 批量拉正文；缺 chunkId 不会出现在返回 map 中（调用方须 fail-closed） */
export async function batchLoadChunkBodies(opts: {
  url: string;
  chunkIds: readonly string[];
}): Promise<Map<string, string>> {
  const url = opts.url.trim();
  if (!url) {
    throw new Error('MONGODB_URL empty; cannot load authoritative chunk bodies');
  }
  const ids = [...new Set(opts.chunkIds)];
  if (ids.length === 0) return new Map();

  const client = mongoClient(url);
  try {
    await client.connect();
    const rows = await client
      .db()
      .collection(CHUNK_BODIES)
      .find({ chunkId: { $in: ids } })
      .toArray();
    const out = new Map<string, string>();
    for (const row of rows) {
      const chunkId = typeof row?.chunkId === 'string' ? row.chunkId : null;
      if (!chunkId || typeof row?.text !== 'string') continue;
      out.set(chunkId, composeChunkSlice(row.contextPrefix, row.text));
    }
    return out;
  } finally {
    await client.close();
  }
}
