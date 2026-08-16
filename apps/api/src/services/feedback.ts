import { askFeedback, formatLocalDateTime } from '@strict-rag/db';
import { and, desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

export type FeedbackStatus =
  | 'open'
  | 'dismissed'
  | 'linked_doc'
  | 'queued_reindex'
  | 'promoted_to_gold';

export type FeedbackRow = {
  feedbackId: string;
  requestId: string;
  kbId: string;
  userId: string;
  tenantId: string;
  rating: string | null;
  category: string | null;
  comment: string | null;
  status: FeedbackStatus;
  handlerId: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
};

export type FeedbackRepo = {
  create(input: {
    tenantId: string;
    kbId: string;
    userId: string;
    requestId: string;
    rating?: string | null;
    category?: string | null;
    comment?: string | null;
  }): Promise<FeedbackRow>;
  listByKb(input: {
    kbId: string;
    status?: FeedbackStatus;
    limit?: number;
    offset?: number;
  }): Promise<FeedbackRow[]>;
  getById(feedbackId: string): Promise<FeedbackRow | null>;
  patchStatus(input: {
    feedbackId: string;
    status: FeedbackStatus;
    handlerId: string;
  }): Promise<FeedbackRow | null>;
};

function mapRow(r: {
  id: string;
  requestId: string;
  kbId: string;
  userId: string;
  tenantId: string;
  rating: string | null;
  category: string | null;
  comment: string | null;
  status: string;
  handlerId: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
}): FeedbackRow {
  return {
    feedbackId: r.id,
    requestId: r.requestId,
    kbId: r.kbId,
    userId: r.userId,
    tenantId: r.tenantId,
    rating: r.rating,
    category: r.category,
    comment: r.comment,
    status: (r.status as FeedbackStatus) || 'open',
    handlerId: r.handlerId,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
  };
}

export const feedbackRepo: FeedbackRepo = {
  async create(input) {
    const id = uuidv7();
    const rows = await getDb()
      .insert(askFeedback)
      .values({
        id,
        tenantId: input.tenantId,
        kbId: input.kbId,
        userId: input.userId,
        requestId: input.requestId,
        rating: input.rating ?? null,
        category: input.category ?? null,
        comment: input.comment ?? null,
        status: 'open',
      })
      .returning({
        id: askFeedback.id,
        requestId: askFeedback.requestId,
        kbId: askFeedback.kbId,
        userId: askFeedback.userId,
        tenantId: askFeedback.tenantId,
        rating: askFeedback.rating,
        category: askFeedback.category,
        comment: askFeedback.comment,
        status: askFeedback.status,
        handlerId: askFeedback.handlerId,
        resolvedAt: askFeedback.resolvedAt,
        createdAt: askFeedback.createdAt,
      });
    const row = rows[0];
    if (!row) throw new Error('feedback insert empty');
    return mapRow(row);
  },

  async listByKb(input) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const conds = [eq(askFeedback.kbId, input.kbId)];
    if (input.status) conds.push(eq(askFeedback.status, input.status));
    const rows = await getDb()
      .select({
        id: askFeedback.id,
        requestId: askFeedback.requestId,
        kbId: askFeedback.kbId,
        userId: askFeedback.userId,
        tenantId: askFeedback.tenantId,
        rating: askFeedback.rating,
        category: askFeedback.category,
        comment: askFeedback.comment,
        status: askFeedback.status,
        handlerId: askFeedback.handlerId,
        resolvedAt: askFeedback.resolvedAt,
        createdAt: askFeedback.createdAt,
      })
      .from(askFeedback)
      .where(and(...conds))
      .orderBy(desc(askFeedback.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapRow);
  },

  async getById(feedbackId) {
    const [row] = await getDb()
      .select({
        id: askFeedback.id,
        requestId: askFeedback.requestId,
        kbId: askFeedback.kbId,
        userId: askFeedback.userId,
        tenantId: askFeedback.tenantId,
        rating: askFeedback.rating,
        category: askFeedback.category,
        comment: askFeedback.comment,
        status: askFeedback.status,
        handlerId: askFeedback.handlerId,
        resolvedAt: askFeedback.resolvedAt,
        createdAt: askFeedback.createdAt,
      })
      .from(askFeedback)
      .where(eq(askFeedback.id, feedbackId))
      .limit(1);
    return row ? mapRow(row) : null;
  },

  async patchStatus(input) {
    const resolvedAt = input.status === 'open' ? null : formatLocalDateTime();
    const rows = await getDb()
      .update(askFeedback)
      .set({
        status: input.status,
        handlerId: input.handlerId,
        resolvedAt,
      })
      .where(eq(askFeedback.id, input.feedbackId))
      .returning({
        id: askFeedback.id,
        requestId: askFeedback.requestId,
        kbId: askFeedback.kbId,
        userId: askFeedback.userId,
        tenantId: askFeedback.tenantId,
        rating: askFeedback.rating,
        category: askFeedback.category,
        comment: askFeedback.comment,
        status: askFeedback.status,
        handlerId: askFeedback.handlerId,
        resolvedAt: askFeedback.resolvedAt,
        createdAt: askFeedback.createdAt,
      });
    const row = rows[0];
    return row ? mapRow(row) : null;
  },
};

/** 内存仓 + 可注入的 trace 查找，单测用 */
export function createMemoryFeedbackRepo(): FeedbackRepo & {
  seedTrace(t: {
    requestId: string;
    kbId: string;
    userId: string;
    tenantId: string;
    sessionId?: string | null;
  }): void;
  getTrace(requestId: string): {
    requestId: string;
    kbId: string;
    userId: string;
    tenantId: string;
    sessionId?: string | null;
  } | null;
} {
  const items = new Map<string, FeedbackRow>();
  const traces = new Map<
    string,
    {
      requestId: string;
      kbId: string;
      userId: string;
      tenantId: string;
      sessionId?: string | null;
    }
  >();

  return {
    seedTrace(t) {
      traces.set(t.requestId, t);
    },
    getTrace(requestId) {
      return traces.get(requestId) ?? null;
    },
    async create(input) {
      const feedbackId = uuidv7();
      const row: FeedbackRow = {
        feedbackId,
        requestId: input.requestId,
        kbId: input.kbId,
        userId: input.userId,
        tenantId: input.tenantId,
        rating: input.rating ?? null,
        category: input.category ?? null,
        comment: input.comment ?? null,
        status: 'open',
        handlerId: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
      };
      items.set(feedbackId, row);
      return row;
    },
    async listByKb(input) {
      return [...items.values()]
        .filter((r) => r.kbId === input.kbId && (!input.status || r.status === input.status))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50));
    },
    async getById(feedbackId) {
      return items.get(feedbackId) ?? null;
    },
    async patchStatus(input) {
      const row = items.get(input.feedbackId);
      if (!row) return null;
      row.status = input.status;
      row.handlerId = input.handlerId;
      row.resolvedAt = input.status === 'open' ? null : new Date().toISOString();
      return row;
    },
  };
}
