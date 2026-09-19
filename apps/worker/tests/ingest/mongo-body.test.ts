/**
 * 目标：Mongo 正文边界的本地回退与明文直存都不得破，失败则空 URL 真连或落库正文变应用层密文。
 * 需求：prds/03-data · 剧本 N2（部署检查表：应用层无字段级 encrypt wrapper）
 * 被测：localMongoDocId · upsertDocumentBody · upsertChunkBodies · findDocumentBody · pingMongo · deleteBodiesForDoc
 * 简介：空 url 返回 local:docId / null / false；有 url 时写入 payload 的 text 与明文逐字节相等、字段集只有已知明文字段；回读原样返回。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mongo = vi.hoisted(() => {
  const writes: Array<{ query: Record<string, unknown>; set: Record<string, unknown> }> = [];
  const updateOne = vi.fn(
    async (query: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      writes.push({ query, set: update.$set });
      return { acknowledged: true };
    },
  );
  const findOne = vi.fn<(query: Record<string, unknown>) => Promise<unknown>>(async () => null);
  const deleteMany = vi.fn<(query: Record<string, unknown>) => Promise<unknown>>(async () => ({
    deletedCount: 0,
  }));
  const collection = vi.fn(() => ({ updateOne, findOne, deleteMany }));
  const db = vi.fn(() => ({ collection, command: vi.fn(async () => ({ ok: 1 })) }));
  const connect = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  return { writes, updateOne, findOne, deleteMany, collection, db, connect, close };
});

/** 打桩 MongoClient：只用于观察应用层发给 Mongo 的原始 payload，不连真库。 */
vi.mock('mongodb', () => ({
  MongoClient: class {
    connect = mongo.connect;
    close = mongo.close;
    db = mongo.db;
  },
}));

import {
  deleteBodiesForDoc,
  findDocumentBody,
  localMongoDocId,
  pingMongo,
  upsertChunkBodies,
  upsertDocumentBody,
} from '../../src/ingest/mongo-body.js';

const MONGO_URL = 'mongodb://127.0.0.1:27017/strict-rag';
const DOC_ID = '01900000-0000-7000-8000-0000000000d1';
const KB_ID = '01900000-0000-7000-8000-0000000000b1';
const DOC_PLAINTEXT = '差旅制度：一线城市住宿上限 600 元/晚。';
const CHUNK_TEXT_1 = '第一块正文：住宿上限 600 元。';
const CHUNK_TEXT_2 = '第二块正文：超标须事前审批。';
const DOC_BODY_FIELDS = ['docId', 'kbId', 'text', 'updatedAt'];
const CHUNK_BODY_FIELDS = [
  'chunkId',
  'contextPrefix',
  'docId',
  'indexVersion',
  'kbId',
  'tenantId',
  'text',
  'tokenCount',
  'updatedAt',
];

describe('mongo-body', () => {
  beforeEach(() => {
    mongo.writes.length = 0;
    mongo.updateOne.mockClear();
    mongo.findOne.mockClear();
    mongo.findOne.mockResolvedValue(null);
  });

  it('local id prefix', () => {
    expect(localMongoDocId('doc-1')).toBe('local:doc-1');
  });

  it('empty url returns local id without connecting', async () => {
    const id = await upsertDocumentBody({
      url: '  ',
      docId: 'd1',
      kbId: 'k1',
      text: 'hello',
    });
    expect(id).toBe('local:d1');
  });

  it('findDocumentBody empty url returns null without connecting', async () => {
    await expect(findDocumentBody({ url: '  ', docId: 'd1' })).resolves.toBeNull();
  });

  it('pingMongo empty url returns false without connecting', async () => {
    await expect(pingMongo('  ')).resolves.toBe(false);
  });

  it('deleteBodiesForDoc empty url does not connect', async () => {
    await expect(deleteBodiesForDoc({ url: '  ', docId: 'd1' })).resolves.toBeUndefined();
  });

  it('N2: 有 url 时写库 payload 的 text 与明文逐字节相等，且不夹带密文 / 密钥字段', async () => {
    const id = await upsertDocumentBody({
      url: MONGO_URL,
      docId: DOC_ID,
      kbId: KB_ID,
      text: DOC_PLAINTEXT,
    });
    expect(id).toBe(DOC_ID);
    expect(mongo.writes).toHaveLength(1);
    expect(mongo.writes[0].query).toEqual({ docId: DOC_ID });
    expect(mongo.writes[0].set.text).toBe(DOC_PLAINTEXT);
    // 字段集锁死：出现 ciphertext / enc / iv 之类即视为引入应用层字段加密 wrapper
    expect(Object.keys(mongo.writes[0].set).sort()).toEqual(DOC_BODY_FIELDS);
  });

  it('N2: chunk 正文同样明文逐块直存，不做逐块加密', async () => {
    const rows = [
      {
        chunkId: '01900000-0000-7000-8000-0000000000c1',
        tenantId: '01900000-0000-7000-8000-000000000001',
        kbId: KB_ID,
        docId: DOC_ID,
        indexVersion: 3,
        contextPrefix: null,
        text: CHUNK_TEXT_1,
        tokenCount: 8,
      },
      {
        chunkId: '01900000-0000-7000-8000-0000000000c2',
        tenantId: '01900000-0000-7000-8000-000000000001',
        kbId: KB_ID,
        docId: DOC_ID,
        indexVersion: 3,
        contextPrefix: '差旅制度',
        text: CHUNK_TEXT_2,
        tokenCount: 9,
      },
    ];
    const ids = await upsertChunkBodies({ url: MONGO_URL, rows });
    expect(ids).toEqual(rows.map((r) => r.chunkId));
    expect(mongo.writes).toHaveLength(2);
    expect(mongo.writes.map((w) => w.set.text)).toEqual([CHUNK_TEXT_1, CHUNK_TEXT_2]);
    for (const write of mongo.writes) {
      expect(Object.keys(write.set).sort()).toEqual(CHUNK_BODY_FIELDS);
    }
  });

  it('N2: 回读正文原样返回，不做应用层解密或归一', async () => {
    mongo.findOne.mockResolvedValue({ text: DOC_PLAINTEXT });
    await expect(findDocumentBody({ url: MONGO_URL, docId: DOC_ID })).resolves.toBe(
      DOC_PLAINTEXT,
    );
    expect(mongo.findOne).toHaveBeenCalledWith({ docId: DOC_ID });
  });
});
