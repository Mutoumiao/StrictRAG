import { askSessions, askTraces } from '@strict-rag/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { uniqueEvidenceDocIds } from './ask/session-window.js';
import { getDb } from './db.js';

export type SessionSummaryRow = {
  sessionId: string;
  title: string | null;
  status: 'open' | 'closed';
  createdAt: string | null;
  updatedAt: string | null;
};

export type SessionMessageRow = {
  role: 'user' | 'assistant';
  content: string;
  requestId?: string;
  status?: 'answered' | 'abstained';
  reason?: string;
  createdAt?: string;
};

export type SessionsRepo = {
  create(input: {
    kbId: string;
    tenantId: string;
    userId: string;
    title?: string | null;
  }): Promise<SessionSummaryRow>;
  list(input: {
    kbId: string;
    userId: string;
    limit?: number;
    offset?: number;
  }): Promise<SessionSummaryRow[]>;
  getOwned(input: {
    sessionId: string;
    kbId: string;
    userId: string;
  }): Promise<SessionSummaryRow | null>;
  /** 仅本 session 的 transcript；从 ask_traces 拼 user/assistant 轮次 */
  listMessages(input: {
    sessionId: string;
    kbId: string;
    userId: string;
  }): Promise<SessionMessageRow[]>;
  /** 本 session 最近一条 ask_traces 的去重 evidence docId；无归属 → [] */
  listLastEvidenceDocIds(input: {
    sessionId: string;
    kbId: string;
    userId: string;
  }): Promise<string[]>;
};

function mapSession(row: {
  id: string;
  title: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}): SessionSummaryRow {
  return {
    sessionId: row.id,
    title: row.title,
    status: row.status === 'closed' ? 'closed' : 'open',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** PG 实现；单测可注入内存 repo */
export const sessionsRepo: SessionsRepo = {
  async create(input) {
    const id = uuidv7();
    const rows = await getDb()
      .insert(askSessions)
      .values({
        id,
        tenantId: input.tenantId,
        kbId: input.kbId,
        userId: input.userId,
        title: input.title ?? null,
        status: 'open',
      })
      .returning({
        id: askSessions.id,
        title: askSessions.title,
        status: askSessions.status,
        createdAt: askSessions.createdAt,
        updatedAt: askSessions.updatedAt,
      });
    const row = rows[0];
    if (!row) {
      // ponytail: PG 应总有 returning；无则当内部错误
      throw new Error('session insert returned empty');
    }
    return mapSession(row);
  },

  async list(input) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const rows = await getDb()
      .select({
        id: askSessions.id,
        title: askSessions.title,
        status: askSessions.status,
        createdAt: askSessions.createdAt,
        updatedAt: askSessions.updatedAt,
      })
      .from(askSessions)
      .where(and(eq(askSessions.kbId, input.kbId), eq(askSessions.userId, input.userId)))
      .orderBy(desc(askSessions.updatedAt))
      .limit(limit)
      .offset(offset);
    return rows.map(mapSession);
  },

  async getOwned(input) {
    const [row] = await getDb()
      .select({
        id: askSessions.id,
        title: askSessions.title,
        status: askSessions.status,
        createdAt: askSessions.createdAt,
        updatedAt: askSessions.updatedAt,
      })
      .from(askSessions)
      .where(
        and(
          eq(askSessions.id, input.sessionId),
          eq(askSessions.kbId, input.kbId),
          eq(askSessions.userId, input.userId),
        ),
      )
      .limit(1);
    return row ? mapSession(row) : null;
  },

  async listMessages(input) {
    // 先确认会话归属，防止仅靠 traces.session_id 越权
    const owned = await this.getOwned(input);
    if (!owned) return [];

    const rows = await getDb()
      .select({
        requestId: askTraces.requestId,
        rawQuestion: askTraces.rawQuestion,
        answer: askTraces.answer,
        status: askTraces.status,
        reason: askTraces.reason,
        createdAt: askTraces.createdAt,
      })
      .from(askTraces)
      .where(
        and(
          eq(askTraces.sessionId, input.sessionId),
          eq(askTraces.kbId, input.kbId),
          eq(askTraces.userId, input.userId),
        ),
      )
      .orderBy(asc(askTraces.createdAt));

    const messages: SessionMessageRow[] = [];
    for (const r of rows) {
      messages.push({
        role: 'user',
        content: r.rawQuestion,
        requestId: r.requestId,
        createdAt: r.createdAt ?? undefined,
      });
      messages.push({
        role: 'assistant',
        content: r.answer ?? '',
        requestId: r.requestId,
        status: r.status === 'abstained' ? 'abstained' : 'answered',
        reason: r.reason,
        createdAt: r.createdAt ?? undefined,
      });
    }
    return messages;
  },

  async listLastEvidenceDocIds(input) {
    const owned = await this.getOwned(input);
    if (!owned) return [];
    const [row] = await getDb()
      .select({ evidenceSnapshot: askTraces.evidenceSnapshot })
      .from(askTraces)
      .where(
        and(
          eq(askTraces.sessionId, input.sessionId),
          eq(askTraces.kbId, input.kbId),
          eq(askTraces.userId, input.userId),
        ),
      )
      .orderBy(desc(askTraces.createdAt))
      .limit(1);
    return uniqueEvidenceDocIds(row?.evidenceSnapshot);
  },
};

/** 内存会话仓：单测隔离 / 无 DB */
export function createMemorySessionsRepo(): SessionsRepo & {
  /** 模拟 ask 落 transcript（不写 evidence 历史） */
  appendTrace(input: {
    sessionId: string;
    kbId: string;
    userId: string;
    requestId: string;
    question: string;
    answer: string;
    status: 'answered' | 'abstained';
    reason: string;
    /** 默认不写，保持旧测不沾 evidence */
    evidenceDocIds?: string[];
  }): void;
  /** 暴露 traces 供断言：不得含他 session */
  dumpTraces(sessionId: string): { question: string; answer: string }[];
} {
  type StoreSession = SessionSummaryRow & { kbId: string; userId: string; tenantId: string };
  type StoreTrace = {
    sessionId: string;
    kbId: string;
    userId: string;
    requestId: string;
    question: string;
    answer: string;
    status: 'answered' | 'abstained';
    reason: string;
    createdAt: string;
    evidenceDocIds?: string[];
  };

  const sessions = new Map<string, StoreSession>();
  const traces: StoreTrace[] = [];
  let seq = 0;

  return {
    async create(input) {
      const sessionId = uuidv7();
      const now = new Date().toISOString();
      const row: StoreSession = {
        sessionId,
        title: input.title ?? null,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        kbId: input.kbId,
        userId: input.userId,
        tenantId: input.tenantId,
      };
      sessions.set(sessionId, row);
      return {
        sessionId: row.sessionId,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async list(input) {
      return [...sessions.values()]
        .filter((s) => s.kbId === input.kbId && s.userId === input.userId)
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .slice(input.offset ?? 0, (input.offset ?? 0) + (input.limit ?? 50))
        .map((s) => ({
          sessionId: s.sessionId,
          title: s.title,
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }));
    },

    async getOwned(input) {
      const s = sessions.get(input.sessionId);
      if (!s || s.kbId !== input.kbId || s.userId !== input.userId) return null;
      return {
        sessionId: s.sessionId,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    },

    async listMessages(input) {
      const owned = await this.getOwned(input);
      if (!owned) return [];
      const rows = traces
        .filter(
          (t) =>
            t.sessionId === input.sessionId &&
            t.kbId === input.kbId &&
            t.userId === input.userId,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const messages: SessionMessageRow[] = [];
      for (const r of rows) {
        messages.push({
          role: 'user',
          content: r.question,
          requestId: r.requestId,
          createdAt: r.createdAt,
        });
        messages.push({
          role: 'assistant',
          content: r.answer,
          requestId: r.requestId,
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt,
        });
      }
      return messages;
    },

    async listLastEvidenceDocIds(input) {
      const owned = await this.getOwned(input);
      if (!owned) return [];
      const rows = traces
        .filter(
          (t) =>
            t.sessionId === input.sessionId &&
            t.kbId === input.kbId &&
            t.userId === input.userId,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = rows.at(-1);
      return uniqueEvidenceDocIds(last?.evidenceDocIds?.map((docId) => ({ docId })));
    },

    appendTrace(input) {
      seq += 1;
      traces.push({
        ...input,
        createdAt: new Date(Date.now() + seq).toISOString(),
      });
      const s = sessions.get(input.sessionId);
      if (s) s.updatedAt = new Date().toISOString();
    },

    dumpTraces(sessionId) {
      return traces
        .filter((t) => t.sessionId === sessionId)
        .map((t) => ({ question: t.question, answer: t.answer }));
    },
  };
}
