import { MongoClient } from 'mongodb';

const DOCUMENT_BODIES = 'document_bodies';
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
