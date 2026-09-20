// 一次性对账：drizzle 迁移 SQL 里的列级 DEFAULT 与 0021_snapshot.json 是否一致。
// 只读，不写任何仓库文件。
import fs from 'node:fs';
import path from 'node:path';

const DRIZZLE = 'packages/db/drizzle';
const SNAP = path.join(DRIZZLE, 'meta', '0021_snapshot.json');

const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const tables = snap.tables ?? {};
const byShort = new Map();
for (const [key, t] of Object.entries(tables)) {
  byShort.set(key.split('.').pop(), t);
}

const sqlFiles = fs
  .readdirSync(DRIZZLE)
  .filter((f) => f.endsWith('.sql'))
  .sort();

// sqlDefaults: table -> col -> {file, line, hasDefault}
const sqlHas = new Map(); // `${table}.${col}` -> [{file,line}]
function mark(table, col, file, line, literal) {
  const k = `${table}.${col}`;
  const prev = sqlHas.get(k) ?? [];
  prev.push({ file, line, literal });
  sqlHas.set(k, prev);
}

/** 从 DEFAULT 之后的片段取字面量 */
function literalOf(rest) {
  const m = /DEFAULT\s+(.+?)(?:\s+NOT NULL|\s*,?\s*$)/i.exec(rest.trim());
  return m ? m[1].trim().replace(/,$/, '').trim() : '(??)';
}

function normalizeSnapshot(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

let curTable = null;
for (const f of sqlFiles) {
  const lines = fs.readFileSync(path.join(DRIZZLE, f), 'utf8').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const ln = i + 1;
    const create = /^CREATE TABLE IF NOT EXISTS "([^"]+)"/.exec(line);
    if (create) {
      curTable = create[1];
      return;
    }
    if (/^\);?\s*$/.test(line) || /^\)\s*;/.test(line)) {
      curTable = null;
      return;
    }
    const alter = /^ALTER TABLE "([^"]+)" ADD COLUMN IF NOT EXISTS "([^"]+)"(.*)$/.exec(line);
    if (alter) {
      const [, table, col, rest] = alter;
      if (/\bDEFAULT\b/i.test(rest)) mark(table, col, f, ln, literalOf(rest.slice(rest.search(/\bDEFAULT\b/i))));
      return;
    }
    if (curTable) {
      const colm = /^"([^"]+)"\s+\S+/.exec(line);
      if (colm && /\bDEFAULT\b/i.test(line)) mark(curTable, colm[1], f, ln, literalOf(line));
    }
  });
}

// 反向：snapshot 有 default
const snapHas = [];
for (const [short, t] of byShort) {
  for (const [col, def] of Object.entries(t.columns ?? {})) {
    if (def && Object.prototype.hasOwnProperty.call(def, 'default')) {
      snapHas.push({ table: short, col, value: def.default });
    }
  }
}

const onlySql = [];
const valueMismatch = [];
for (const [k, locs] of sqlHas) {
  const [table, col] = k.split('.');
  const t = byShort.get(table);
  const def = t?.columns?.[col];
  if (!def) {
    onlySql.push({ k, locs, why: '快照无此表/列' });
    continue;
  }
  if (!Object.prototype.hasOwnProperty.call(def, 'default')) {
    onlySql.push({ k, locs, why: 'SQL 有 DEFAULT，快照无 default' });
    continue;
  }
  const sqlLit = locs[locs.length - 1].literal;
  const snapLit = normalizeSnapshot(def.default);
  if (sqlLit !== snapLit) {
    valueMismatch.push({ k, locs, sqlLit, snapLit });
  }
}

console.log('== SQL 有 DEFAULT 而快照无（漂移）==');
if (onlySql.length === 0) console.log('（无）');
for (const r of onlySql) {
  console.log(`${r.k}  ← ${r.locs.map((l) => `${l.file}:${l.line}`).join(', ')}  [${r.why}]`);
}

console.log('\n== DEFAULT 取值不一致 ==');
if (valueMismatch.length === 0) console.log('（无）');
for (const r of valueMismatch) {
  console.log(`${r.k}  ← ${r.locs[0].file}:${r.locs[0].line}  SQL=${JSON.stringify(r.sqlLit)} 快照=${JSON.stringify(r.snapLit)}`);
}

console.log('\n== 快照有 default（应能在 SQL 里找到来源）==');
for (const r of snapHas) {
  const key = `${r.table}.${r.col}`;
  const locs = sqlHas.get(key);
  console.log(`${key} = ${JSON.stringify(r.value)}  ← ${locs ? locs.map((l) => `${l.file}:${l.line}`).join(', ') : '（SQL 未标 DEFAULT！）'}`);
}

console.log('\n统计：SQL 标 DEFAULT 的列 =', sqlHas.size, '· 快照带 default 的列 =', snapHas.length);
