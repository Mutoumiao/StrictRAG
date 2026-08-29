import { goldQuestions } from '@strict-rag/db';
import { and, desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { extractPgError } from '../lib/pg-error.js';
import { getDb } from './db.js';

export type GoldType = 'answerable' | 'unanswerable' | 'false_premise';

export type GoldQuestionRow = {
  id: string;
  kbId: string;
  tenantId: string;
  caseKey: string;
  question: string;
  type: GoldType;
  expectedDocIds: string[] | null;
  expectedChunkIds: string[] | null;
  rubric: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GoldWrite = {
  caseKey: string;
  question: string;
  type: GoldType;
  expectedDocIds?: string[] | null;
  expectedChunkIds?: string[] | null;
  rubric?: string | null;
};

export type GoldRepo = {
  listByKb(input: { kbId: string; limit: number; offset: number }): Promise<GoldQuestionRow[]>;
  countByKb(kbId: string): Promise<number>;
  getById(id: string): Promise<GoldQuestionRow | null>;
  create(input: {
    tenantId: string;
    kbId: string;
    createdBy?: string;
    data: GoldWrite;
  }): Promise<{ ok: true; row: GoldQuestionRow } | { ok: false; reason: 'conflict' }>;
  update(input: {
    id: string;
    kbId: string;
    updatedBy?: string;
    data: Partial<GoldWrite>;
  }): Promise<
    { ok: true; row: GoldQuestionRow } | { ok: false; reason: 'not_found' | 'conflict' }
  >;
  remove(input: { id: string; kbId: string }): Promise<boolean>;
};

function asType(raw: string): GoldType {
  if (raw === 'answerable' || raw === 'unanswerable' || raw === 'false_premise') return raw;
  return 'unanswerable';
}

function mapRow(r: typeof goldQuestions.$inferSelect): GoldQuestionRow {
  return {
    id: r.id,
    kbId: r.kbId,
    tenantId: r.tenantId,
    caseKey: r.caseKey,
    question: r.question,
    type: asType(r.type),
    expectedDocIds: r.expectedDocIds ?? null,
    expectedChunkIds: r.expectedChunkIds ?? null,
    rubric: r.rubric ?? null,
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
  };
}

function isConflict(err: unknown): boolean {
  return extractPgError(err)?.code === '23505';
}

export const goldQuestionRepo: GoldRepo = {
  async listByKb({ kbId, limit, offset }) {
    const rows = await getDb()
      .select()
      .from(goldQuestions)
      .where(eq(goldQuestions.kbId, kbId))
      .orderBy(desc(goldQuestions.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapRow);
  },

  async countByKb(kbId) {
    const rows = await getDb()
      .select({ id: goldQuestions.id })
      .from(goldQuestions)
      .where(eq(goldQuestions.kbId, kbId));
    return rows.length;
  },

  async getById(id) {
    const [row] = await getDb().select().from(goldQuestions).where(eq(goldQuestions.id, id)).limit(1);
    return row ? mapRow(row) : null;
  },

  async create({ tenantId, kbId, createdBy, data }) {
    const id = uuidv7();
    try {
      const [row] = await getDb()
        .insert(goldQuestions)
        .values({
          id,
          tenantId,
          kbId,
          caseKey: data.caseKey,
          question: data.question,
          type: data.type,
          expectedDocIds: data.expectedDocIds ?? null,
          expectedChunkIds: data.expectedChunkIds ?? null,
          rubric: data.rubric ?? null,
          createdBy: createdBy ?? null,
          updatedBy: createdBy ?? null,
        })
        .returning();
      if (!row) return { ok: false, reason: 'conflict' };
      return { ok: true, row: mapRow(row) };
    } catch (err) {
      if (isConflict(err)) return { ok: false, reason: 'conflict' };
      throw err;
    }
  },

  async update({ id, kbId, updatedBy, data }) {
    const patch: Partial<typeof goldQuestions.$inferInsert> = {
      updatedBy: updatedBy ?? null,
    };
    if (data.caseKey !== undefined) patch.caseKey = data.caseKey;
    if (data.question !== undefined) patch.question = data.question;
    if (data.type !== undefined) patch.type = data.type;
    if (data.expectedDocIds !== undefined) patch.expectedDocIds = data.expectedDocIds;
    if (data.expectedChunkIds !== undefined) patch.expectedChunkIds = data.expectedChunkIds;
    if (data.rubric !== undefined) patch.rubric = data.rubric;
    try {
      const [row] = await getDb()
        .update(goldQuestions)
        .set(patch)
        .where(and(eq(goldQuestions.id, id), eq(goldQuestions.kbId, kbId)))
        .returning();
      if (!row) return { ok: false, reason: 'not_found' };
      return { ok: true, row: mapRow(row) };
    } catch (err) {
      if (isConflict(err)) return { ok: false, reason: 'conflict' };
      throw err;
    }
  },

  async remove({ id, kbId }) {
    const deleted = await getDb()
      .delete(goldQuestions)
      .where(and(eq(goldQuestions.id, id), eq(goldQuestions.kbId, kbId)))
      .returning({ id: goldQuestions.id });
    return deleted.length > 0;
  },
};
