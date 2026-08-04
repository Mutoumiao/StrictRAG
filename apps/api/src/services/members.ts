import { kbMembers, users } from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

/** 本地/dev 默认租户（与 live 测、demo 脚本一致） */
export const DEV_DEFAULT_TENANT = '01900000-0000-7000-8000-000000000001';

export type KbMemberRole = 'read' | 'write' | 'admin';

/** 按 email upsert users（dev-login / 邀请） */
export async function ensureUserByEmail(params: {
  email: string;
  tenantId?: string;
  displayName?: string;
  platformRole?: string;
}): Promise<{ id: string; tenantId: string; email: string; displayName: string | null }> {
  const db = getDb();
  const [existing] = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.email, params.email))
    .limit(1);
  if (existing) return existing;

  const id = uuidv7();
  const tenantId = params.tenantId ?? DEV_DEFAULT_TENANT;
  await db.insert(users).values({
    id,
    tenantId,
    email: params.email,
    displayName: params.displayName ?? null,
    platformRole: params.platformRole ?? 'user',
    status: 'active',
  });
  return {
    id,
    tenantId,
    email: params.email,
    displayName: params.displayName ?? null,
  };
}

export const membersRepo = {
  async isMember(userId: string, kbId: string): Promise<boolean> {
    const [row] = await getDb()
      .select({ id: kbMembers.id })
      .from(kbMembers)
      .where(and(eq(kbMembers.userId, userId), eq(kbMembers.kbId, kbId)))
      .limit(1);
    return Boolean(row);
  },

  async list(kbId: string) {
    return getDb()
      .select({
        kbId: kbMembers.kbId,
        userId: kbMembers.userId,
        role: kbMembers.role,
        email: users.email,
        displayName: users.displayName,
        createdAt: kbMembers.createdAt,
      })
      .from(kbMembers)
      .leftJoin(users, eq(users.id, kbMembers.userId))
      .where(eq(kbMembers.kbId, kbId));
  },

  async invite(input: {
    kbId: string;
    tenantId: string;
    userId?: string;
    email?: string;
    role: KbMemberRole;
    createdBy?: string;
  }): Promise<
    | { ok: true; userId: string; role: KbMemberRole }
    | { ok: false; reason: 'conflict'; userId: string }
    | { ok: false; reason: 'user_not_found' }
  > {
    let userId = input.userId;
    if (!userId && input.email) {
      const u = await ensureUserByEmail({ email: input.email, tenantId: input.tenantId });
      userId = u.id;
    }
    if (!userId) {
      return { ok: false, reason: 'user_not_found' };
    }

    if (input.userId) {
      const [exists] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!exists) {
        return { ok: false, reason: 'user_not_found' };
      }
    }

    if (await this.isMember(userId, input.kbId)) {
      return { ok: false, reason: 'conflict', userId };
    }

    await getDb().insert(kbMembers).values({
      id: uuidv7(),
      tenantId: input.tenantId,
      kbId: input.kbId,
      userId,
      role: input.role,
      createdBy: input.createdBy,
    });
    return { ok: true, userId, role: input.role };
  },

  async remove(kbId: string, userId: string): Promise<boolean> {
    const deleted = await getDb()
      .delete(kbMembers)
      .where(and(eq(kbMembers.kbId, kbId), eq(kbMembers.userId, userId)))
      .returning({ id: kbMembers.id });
    return deleted.length > 0;
  },
};
