import { MongoClient } from 'mongodb';

/**
 * parse 正文写入 Mongo。URL 空 → 调用方应回退 local:{docId}。
 * 每调用短连，避免 worker 单测泄漏连接。
 */
export function localMongoDocId(docId: string): string {
  return `local:${docId}`;
}

export async function upsertDocumentBody(opts: {
  url: string;
  docId: string;
  kbId: string;
  text: string;
}): Promise<string> {
  const url = opts.url.trim();
  if (!url) return localMongoDocId(opts.docId);
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    await db.collection('document_bodies').updateOne(
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
