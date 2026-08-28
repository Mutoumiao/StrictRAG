import type { CreateKbResponse, KbMemberRole } from '@strict-rag/contracts';
import { documents, formatLocalDateTime, kbMembers, knowledgeBases, users } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

export type CreateKbResult =
  | { ok: true; kb: CreateKbResponse }
  | { ok: false; reason: 'user_not_found' };

/** 文档/KB 数据访问（route 禁止散落 SQL） */
export const documentRepo = {
  async createKb(input: {
    tenantId: string;
    name: string;
    description?: string;
    initialAdminUserId: string;
    createdBy?: string;
  }): Promise<CreateKbResult> {
    const db = getDb();
    const [adminUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.initialAdminUserId))
      .limit(1);
    if (!adminUser) {
      return { ok: false, reason: 'user_not_found' };
    }

    const id = uuidv7();
    await db.transaction(async (tx) => {
      await tx.insert(knowledgeBases).values({
        id,
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        createdBy: input.createdBy,
      });
      await tx.insert(kbMembers).values({
        id: uuidv7(),
        tenantId: input.tenantId,
        kbId: id,
        userId: input.initialAdminUserId,
        role: 'admin' satisfies KbMemberRole,
        createdBy: input.createdBy,
      });
    });
    return {
      ok: true,
      kb: {
        id,
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
      },
    };
  },

  async listKbsByTenant(tenantId: string) {
    return getDb()
      .select({
        id: knowledgeBases.id,
        tenantId: knowledgeBases.tenantId,
        name: knowledgeBases.name,
        description: knowledgeBases.description,
      })
      .from(knowledgeBases)
      .where(eq(knowledgeBases.tenantId, tenantId));
  },

  async listMemberKbIds(userId: string): Promise<string[]> {
    const rows = await getDb()
      .select({ kbId: kbMembers.kbId })
      .from(kbMembers)
      .where(eq(kbMembers.userId, userId));
    return rows.map((r) => r.kbId);
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


  async markCompletePending(
    docId: string,
    byteSize: number,
    opts?: { chunkStrategy?: string },
  ) {
    await getDb()
      .update(documents)
      .set({
        byteSize,
        approvalStatus: 'pending',
        status: 'uploaded',
        errorCode: null,
        errorMessage: null,
        ...(opts?.chunkStrategy !== undefined
          ? { chunkStrategy: opts.chunkStrategy }
          : {}),
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

  /** ponytail: 无独立 ticket 表；驳回只改 approval_status */
  async reject(docId: string) {
    await getDb()
      .update(documents)
      .set({
        approvalStatus: 'rejected',
      })
      .where(eq(documents.id, docId));
  },

  async setLifecycle(docId: string, lifecycle: string) {
    await getDb().update(documents).set({ lifecycle }).where(eq(documents.id, docId));
  },

  /** B12：显式改策略（reindex 覆盖时） */
  async setChunkStrategy(docId: string, chunkStrategy: string) {
    await getDb()
      .update(documents)
      .set({ chunkStrategy })
      .where(eq(documents.id, docId));
  },

  /** P3b-META：只改部门/密级两列；不改 lifecycle、不入队 */
  async patchMeta(
    docId: string,
    patch: {
      ownerDeptId?: string | null;
      visibilityLevel?: 10 | 20 | 30 | 40;
    },
  ) {
    const set: {
      ownerDeptId?: string | null;
      visibilityLevel?: 10 | 20 | 30 | 40;
    } = {};
    if (patch.ownerDeptId !== undefined) set.ownerDeptId = patch.ownerDeptId;
    if (patch.visibilityLevel !== undefined) set.visibilityLevel = patch.visibilityLevel;
    if (Object.keys(set).length === 0) return;
    await getDb().update(documents).set(set).where(eq(documents.id, docId));
  },
};
