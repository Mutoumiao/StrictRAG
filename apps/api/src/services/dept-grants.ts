import type { DeptCrossGrant } from '@strict-rag/contracts';
import { deptCrossGrants, formatLocalDateTime } from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

export type DeptGrantRow = {
  id: string;
  userId: string;
  deptId: string;
  maxVisibilityLevel: number;
  expiresAt: string | null;
  reason: string | null;
  grantedBy: string | null;
  grantedAt: string;
};

export type CreateDeptGrantInput = {
  userId: string;
  deptId: string;
  maxVisibilityLevel: number;
  expiresAt: string | null;
  reason: string | null;
  grantedBy: string | null;
};

export type DeptGrantsRepo = {
  listGrants(filter: { userId?: string; deptId?: string }): Promise<DeptGrantRow[]>;
  getGrant(id: string): Promise<DeptGrantRow | null>;
  createGrant(input: CreateDeptGrantInput): Promise<DeptGrantRow>;
  deleteGrant(id: string): Promise<boolean>;
};

/** memory / 测试用：模拟 PG 23505，供 route 走 mapPgErrorToBiz */
export function uniqueGrantConflictError(): Error & { code: string; name: string } {
  const err = new Error('grant already exists') as Error & { code: string; name: string };
  err.code = '23505';
  err.name = 'PostgresError';
  return err;
}

export function toPublicGrant(row: DeptGrantRow): DeptCrossGrant {
  return {
    id: row.id,
    userId: row.userId,
    deptId: row.deptId,
    maxVisibilityLevel: row.maxVisibilityLevel as DeptCrossGrant['maxVisibilityLevel'],
    expiresAt: row.expiresAt,
    reason: row.reason,
    grantedBy: row.grantedBy,
    grantedAt: row.grantedAt,
  };
}

function mapGrantRow(r: {
  id: string;
  userId: string;
  deptId: string;
  maxVisibilityLevel: number;
  expiresAt: string | null;
  reason: string | null;
  grantedBy: string | null;
  createdAt: string | null;
}): DeptGrantRow {
  return {
    id: r.id,
    userId: r.userId,
    deptId: r.deptId,
    maxVisibilityLevel: r.maxVisibilityLevel,
    expiresAt: r.expiresAt ?? null,
    reason: r.reason ?? null,
    grantedBy: r.grantedBy ?? null,
    grantedAt: r.createdAt ?? formatLocalDateTime(),
  };
}

export function createMemoryDeptGrantsRepo(): DeptGrantsRepo {
  const rows = new Map<string, DeptGrantRow>();

  return {
    async listGrants(filter) {
      return [...rows.values()].filter((r) => {
        if (filter.userId && r.userId !== filter.userId) return false;
        if (filter.deptId && r.deptId !== filter.deptId) return false;
        return true;
      });
    },
    async getGrant(id) {
      return rows.get(id) ?? null;
    },
    async createGrant(input) {
      for (const r of rows.values()) {
        if (r.userId === input.userId && r.deptId === input.deptId) {
          throw uniqueGrantConflictError();
        }
      }
      const row: DeptGrantRow = {
        id: uuidv7(),
        userId: input.userId,
        deptId: input.deptId,
        maxVisibilityLevel: input.maxVisibilityLevel,
        expiresAt: input.expiresAt,
        reason: input.reason,
        grantedBy: input.grantedBy,
        grantedAt: formatLocalDateTime(),
      };
      rows.set(row.id, row);
      return row;
    },
    async deleteGrant(id) {
      return rows.delete(id);
    },
  };
}

/** 生产 Drizzle 实现。检索路径禁止调用本 repo。 */
export const deptGrantsRepo: DeptGrantsRepo = {
  async listGrants(filter) {
    const conds = [
      filter.userId ? eq(deptCrossGrants.userId, filter.userId) : undefined,
      filter.deptId ? eq(deptCrossGrants.deptId, filter.deptId) : undefined,
    ];
    const found = await getDb()
      .select()
      .from(deptCrossGrants)
      .where(and(...conds));
    return found.map(mapGrantRow);
  },

  async getGrant(id) {
    const [r] = await getDb()
      .select()
      .from(deptCrossGrants)
      .where(eq(deptCrossGrants.id, id))
      .limit(1);
    return r ? mapGrantRow(r) : null;
  },

  async createGrant(input) {
    const id = uuidv7();
    await getDb().insert(deptCrossGrants).values({
      id,
      userId: input.userId,
      deptId: input.deptId,
      maxVisibilityLevel: input.maxVisibilityLevel,
      expiresAt: input.expiresAt,
      reason: input.reason,
      grantedBy: input.grantedBy,
      createdBy: input.grantedBy ?? undefined,
    });
    const row = await this.getGrant(id);
    if (!row) throw new Error('dept grant insert failed');
    return row;
  },

  async deleteGrant(id) {
    const cur = await this.getGrant(id);
    if (!cur) return false;
    await getDb().delete(deptCrossGrants).where(eq(deptCrossGrants.id, id));
    return true;
  },
};
