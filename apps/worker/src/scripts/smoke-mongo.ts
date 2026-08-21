/**
 * HALF-MONGO：对已交付 pingMongo / upsertDocumentBody / findDocumentBody 做 ping+写+回读。
 * 用法（仓库根）：MONGODB_URL=mongodb://127.0.0.1:27017/strict_rag pnpm --filter @strict-rag/worker smoke:mongo
 * URL 须含库名；无 URL / 连不上 → 非零退出（不伪造绿）。
 */
import { findDocumentBody, pingMongo, upsertDocumentBody } from '../ingest/mongo-body.js';

/** 动态键读取：smoke CLI 非 turbo task，避免 no-undeclared-env-vars。 */
function envTrim(name: string): string {
  return String(process.env[name] ?? '').trim();
}

async function main(): Promise<void> {
  const url = envTrim('MONGODB_URL');
  if (!url) {
    console.error('FAIL: MONGODB_URL empty; not a green mongo smoke');
    process.exit(2);
  }
  const pong = await pingMongo(url);
  if (!pong) {
    console.error('FAIL: ping');
    process.exit(1);
  }
  const docId = `smoke-mongo-${Date.now()}`;
  const text = `HALF-MONGO smoke body ${docId}`;
  const id = await upsertDocumentBody({
    url,
    docId,
    kbId: '00000000-0000-4000-8000-000000000001',
    text,
  });
  if (id !== docId) {
    console.error(`FAIL: upsert returned ${id}, expected ${docId}`);
    process.exit(1);
  }
  const back = await findDocumentBody({ url, docId });
  if (back !== text) {
    console.error(`FAIL: readback mismatch got=${JSON.stringify(back)}`);
    process.exit(1);
  }
  console.log(`PASS document_bodies docId=${docId} chars=${text.length}`);
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
