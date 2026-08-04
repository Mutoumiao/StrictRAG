import { documents, formatLocalDateTime, knowledgeBases } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

/** 文档/KB 数据访问（route 禁止散落 SQL） */
export const documentRepo = {
  async createKb(input: { tenantId: string; name: string; description?: string }) {
    const id = uuidv7();
    await getDb().insert(knowledgeBases).values({
      id,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
    });
    return { id, ...input };
  },

  async getKb(kbId: string) {
    const [row] = await getDb()
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, kbId))
      .limit(1);
    return row ?? null;
  },

  async listDocsByKb(kbId: string) {
    return getDb().select().from(documents).where(eq(documents.kbId, kbId));
  },

  async getDoc(docId: string) {
    const [row] = await getDb().select().from(documents).where(eq(documents.id, docId)).limit(1);
    return row ?? null;
  },

  async insertUploadedDoc(input: {
    id?: string;
    tenantId: string;
    kbId: string;
    title: string;
    objectBucket: string;
    objectKey: string;
    contentType: string;
  }) {
    const id = input.id ?? uuidv7();
    await getDb().insert(documents).values({
      id,
      tenantId: input.tenantId,
      kbId: input.kbId,
      title: input.title,
      status: 'uploaded',
      approvalStatus: 'none',
      lifecycle: 'draft',
      sourceType: 'upload',
      objectBucket: input.objectBucket,
      objectKey: input.objectKey,
      contentType: input.contentType,
    });
    return id;
  },

  async patchObjectKey(docId: string, objectBucket: string, objectKey: string) {
    await getDb()
      .update(documents)
      .set({ objectBucket, objectKey })
      .where(eq(documents.id, docId));
  },


  async markCompletePending(docId: string, byteSize: number) {
    await getDb()
      .update(documents)
      .set({
        byteSize,
        approvalStatus: 'pending',
        status: 'uploaded',
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(documents.id, docId));
  },

  async approve(docId: string) {
    await getDb()
      .update(documents)
      .set({
        approvalStatus: 'approved',
        approvedAt: formatLocalDateTime(),
      })
      .where(eq(documents.id, docId));
  },

  async setLifecycle(docId: string, lifecycle: string) {
    await getDb().update(documents).set({ lifecycle }).where(eq(documents.id, docId));
  },
};
