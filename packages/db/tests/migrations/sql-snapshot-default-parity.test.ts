/**
 * 目标：迁移 SQL 的列级默认值不得与 Drizzle schema 快照漂移。
 * 需求：库侧默认值只能来自 schema 声明。`ALTER TABLE … ADD COLUMN … NOT NULL` 为回填临时加的 DEFAULT
 *       若忘了撤销，库就比声明宽松——漏传该列的写入会被静默填上默认值，等于替业务断言一个未观测的事实
 *       （本仓禁止「写 0 假装零重复」），应当响亮失败。
 * 被测：`packages/db/drizzle/*.sql` 的净 DEFAULT 集合 与 `drizzle/meta` 最高号 `*_snapshot.json` 的 `default` 集合。
 * 简介：按文件名顺序累积 SQL 声明（`ADD COLUMN … DEFAULT` 记入、`ALTER COLUMN … DROP DEFAULT` 移除），
 *       与快照双向比对存在性与取值。快照取最高号，避免基线换代即假红。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.resolve(here, '../../drizzle');
const META_DIR = path.join(DRIZZLE_DIR, 'meta');

type SnapshotColumn = { name: string; type: string; default?: unknown };
type SnapshotTable = { columns?: Record<string, SnapshotColumn> };
type Snapshot = { tables?: Record<string, SnapshotTable> };

/** 取 DEFAULT 之后的字面量；没有 DEFAULT 子句返回 null */
function literalFromDefaultClause(clause: string): string | null {
  const m = /\bDEFAULT\s+(.+?)(?:\s+NOT NULL\b|\s*,?\s*$)/i.exec(clause.trim());
  const lit = m?.[1];
  return lit ? lit.trim().replace(/,$/, '').trim() : null;
}

/** 迁移 SQL 的净默认值：键 `表.列` → 字面量 */
function netSqlDefaults(): Map<string, string> {
  const out = new Map<string, string>();
  const files = fs
    .readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    let table: string | null = null;
    for (const raw of fs.readFileSync(path.join(DRIZZLE_DIR, file), 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (line === '' || line.startsWith('--')) continue;

      const create = /^CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/.exec(line);
      if (create) {
        table = create[1] ?? null;
        continue;
      }
      if (/^\)\s*;/.test(line)) {
        table = null;
        continue;
      }

      const drop = /^ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" DROP DEFAULT/.exec(line);
      if (drop) {
        out.delete(`${drop[1] ?? ''}.${drop[2] ?? ''}`);
        continue;
      }

      const add = /^ALTER TABLE "([^"]+)" ADD COLUMN IF NOT EXISTS "([^"]+)"(.*)$/.exec(line);
      if (add) {
        const lit = literalFromDefaultClause(add[3] ?? '');
        if (lit !== null) out.set(`${add[1] ?? ''}.${add[2] ?? ''}`, lit);
        continue;
      }

      if (table === null) continue;
      const col = /^"([^"]+)"\s+\S/.exec(line);
      if (!col) continue;
      const lit = literalFromDefaultClause(line);
      if (lit !== null) out.set(`${table}.${col[1] ?? ''}`, lit);
    }
  }
  return out;
}

/** 最高号快照声明的默认值：键 `表.列` → 归一化后的字面量 */
function snapshotDefaults(): Map<string, string> {
  const candidates = fs
    .readdirSync(META_DIR)
    .filter((f) => /^\d+_snapshot\.json$/.test(f))
    .sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error('drizzle/meta 下没有 *_snapshot.json');
  const snap = JSON.parse(fs.readFileSync(path.join(META_DIR, latest), 'utf8')) as Snapshot;

  const out = new Map<string, string>();
  for (const [key, t] of Object.entries(snap.tables ?? {})) {
    const short = key.split('.').pop() ?? key;
    for (const [name, col] of Object.entries(t.columns ?? {})) {
      if (col === null || typeof col !== 'object') continue;
      if (!Object.prototype.hasOwnProperty.call(col, 'default')) continue;
      const v = col.default;
      out.set(
        `${short}.${name}`,
        typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v),
      );
    }
  }
  return out;
}

describe('迁移 SQL 与 schema 快照的默认值对账', () => {
  it('SQL 声明的净默认值必须都在快照里，且取值一致', () => {
    const sql = netSqlDefaults();
    const snap = snapshotDefaults();

    const missing = [...sql.keys()].filter((k) => !snap.has(k));
    expect(missing).toEqual([]);

    const wrongValue = [...sql.entries()]
      .filter(([k, v]) => snap.get(k) !== v)
      .map(([k, v]) => `${k}：SQL=${v} 快照=${snap.get(k)}`);
    expect(wrongValue).toEqual([]);
  });

  it('快照声明的默认值必须能在迁移 SQL 里找到来源，不得凭空出现', () => {
    const sql = netSqlDefaults();
    const snap = snapshotDefaults();

    const orphan = [...snap.keys()].filter((k) => !sql.has(k));
    expect(orphan).toEqual([]);
  });
});
