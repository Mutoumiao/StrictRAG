import { MongoClient } from 'mongodb';

const DOCUMENT_BODIES = 'document_bodies';
const CHUNK_BODIES = 'chunk_bodies';
const SERVER_SELECTION_TIMEOUT_MS = 3000;

/**
 * parse 正文写入 Mongo。URL 空 → 调用方应回退 local:{docId}。
 * 每调用短连，避免 worker 单测泄漏连接。
 */
export function localMongoDocId(docId: string): string {
  return `local:${docId}`;
}

function mongoClient(url: string): MongoClient {
  return new MongoClient(url, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
}

/** 连通性探测；URL 空 → false（不连）。冒烟 ping 用，禁止在脚本里另开客户端。 */
export async function pingMongo(url: string): Promise<boolean> {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const client = mongoClient(trimmed);
  try {
    await client.connect();
    const res = await client.db().command({ ping: 1 });
    return res.ok === 1;
  } finally {
    await client.close();
  }
}

export async function upsertDocumentBody(opts: {
  url: string;
  docId: string;
  kbId: string;
  text: string;
}): Promise<string> {
  const url = opts.url.trim();
  if (!url) return localMongoDocId(opts.docId);
  const client = mongoClient(url);
  try {
    await client.connect();
    await client.db().collection(DOCUMENT_BODIES).updateOne(
      { docId: opts.docId },
      {
        $set: {
          kbId: opts.kbId,
          docId: opts.docId,
          text: opts.text,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    return opts.docId;
  } finally {
    await client.close();
  }
}

export type ChunkBodyRow = {
  chunkId: string;
  tenantId: string;
  kbId: string;
  docId: string;
  indexVersion: number;
  contextPrefix: string | null;
  text: string;
  tokenCount: number | null;
};

/** chunk 正文写 Mongo（PRD 03-data/02 §3.2 chunk_bodies）；URL 空 → 调用方回退 local:{chunkId} */
export async function upsertChunkBodies(opts: {
  url: string;
  rows: ChunkBodyRow[];
}): Promise<string[]> {
  const url = opts.url.trim();
  if (!url || opts.rows.length === 0) {
    return opts.rows.map((r) => localMongoDocId(r.chunkId));
  }
  const client = mongoClient(url);
  try {
    await client.connect();
    const col = client.db().collection(CHUNK_BODIES);
    await Promise.all(
      opts.rows.map((r) =>
        col.updateOne(
          { chunkId: r.chunkId },
          {
            $set: {
              chunkId: r.chunkId,
              tenantId: r.tenantId,
              kbId: r.kbId,
              docId: r.docId,
              indexVersion: r.indexVersion,
              contextPrefix: r.contextPrefix ?? '',
              text: r.text,
              tokenCount: r.tokenCount ?? 0,
              updatedAt: new Date().toISOString(),
            },
          },
          { upsert: true },
        ),
      ),
    );
    return opts.rows.map((r) => r.chunkId);
  } finally {
    await client.close();
  }
}

/** 回读 parse 正文；URL 空 → null（不连）。冒烟用，禁止在测里重写 upsert。 */
export async function findDocumentBody(opts: {
  url: string;
  docId: string;
}): Promise<string | null> {
  const url = opts.url.trim();
  if (!url) return null;
  const client = mongoClient(url);
  try {
    await client.connect();
    const row = await client.db().collection(DOCUMENT_BODIES).findOne({ docId: opts.docId });
    return typeof row?.text === 'string' ? row.text : null;
  } finally {
    await client.close();
  }
}
