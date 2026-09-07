import type { KbSettingsAuditItem } from '@strict-rag/contracts';
import { formatLocalDateTime, kbSettingsAudits, type KbSettingsAuditDiff } from '@strict-rag/db';
import { desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

export const SETTINGS_AUDIT_LIST_LIMIT = 50;

export type KbSettingsAuditInsert = {
  tenantId: string;
  kbId: string;
  actorUserId: string;
  diff: KbSettingsAuditDiff;
};

export type KbSettingsAuditRepo = {
  insert(row: KbSettingsAuditInsert): Promise<KbSettingsAuditItem>;
  listByKb(kbId: string): Promise<KbSettingsAuditItem[]>;
};

export function toKbSettingsAuditItem(row: {
  id: string;
  kbId: string;
  actorUserId: string;
  createdAt: string | null;
  diffJson: KbSettingsAuditDiff;
}): KbSettingsAuditItem {
  return {
    id: row.id,
    kbId: row.kbId,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt,
    diff: row.diffJson,
  };
}

export const kbSettingsAuditRepo: KbSettingsAuditRepo = {
  async insert(row) {
    const id = uuidv7();
    const createdAt = formatLocalDateTime();
    await getDb()
      .insert(kbSettingsAudits)
      .values({
        id,
        tenantId: row.tenantId,
        kbId: row.kbId,
        actorUserId: row.actorUserId,
        diffJson: row.diff,
        createdAt,
        createdBy: row.actorUserId,
        updatedAt: createdAt,
        updatedBy: row.actorUserId,
      });
    return {
      id,
      kbId: row.kbId,
      actorUserId: row.actorUserId,
      createdAt,
      diff: row.diff,
    };
  },

  async listByKb(kbId) {
    const rows = await getDb()
      .select({
        id: kbSettingsAudits.id,
        kbId: kbSettingsAudits.kbId,
        actorUserId: kbSettingsAudits.actorUserId,
        createdAt: kbSettingsAudits.createdAt,
        diffJson: kbSettingsAudits.diffJson,
      })
      .from(kbSettingsAudits)
      .where(eq(kbSettingsAudits.kbId, kbId))
      .orderBy(desc(kbSettingsAudits.createdAt), desc(kbSettingsAudits.id))
      .limit(SETTINGS_AUDIT_LIST_LIMIT);
    return rows.map((r) =>
      toKbSettingsAuditItem({
        id: r.id,
        kbId: r.kbId,
        actorUserId: r.actorUserId,
        createdAt: r.createdAt ?? null,
        diffJson: (r.diffJson ?? {}) as KbSettingsAuditDiff,
      }),
    );
  },
};

/** 内存 repo：单测注入，不碰 PG */
export function createMemoryKbSettingsAuditRepo(
  seed: KbSettingsAuditItem[] = [],
): KbSettingsAuditRepo {
  const rows: KbSettingsAuditItem[] = seed.map((r) => ({ ...r, diff: { ...r.diff } }));
  return {
    async insert(input) {
      const item: KbSettingsAuditItem = {
        id: uuidv7(),
        kbId: input.kbId,
        actorUserId: input.actorUserId,
        createdAt: formatLocalDateTime(),
        diff: { ...input.diff },
      };
      rows.unshift(item);
      return { ...item, diff: { ...item.diff } };
    },
    async listByKb(kbId) {
      return rows
        .filter((r) => r.kbId === kbId)
        .slice(0, SETTINGS_AUDIT_LIST_LIMIT)
        .map((r) => ({ ...r, diff: { ...r.diff } }));
    },
  };
}
