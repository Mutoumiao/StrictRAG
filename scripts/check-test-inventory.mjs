/**
 * 包测例存货闸。cwd = 包根（或夹具临时目录）。
 * 禁止 import scripts/module-status/extract.mjs（其 ROOT 是仓库根）。
 * 不用名为 ROOT 的环境变量。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.turbo', 'coverage', '.data']);
const TEST_FILE_RE = /\.test\.(ts|tsx)$/;
const INVENTORY_TOKEN_RE = /^(src|tests)\/.+\.test\.(ts|tsx)$/;

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

function stripDotSlash(p) {
  let s = p;
  while (s.startsWith('./')) s = s.slice(2);
  return s.replace(/\/\.\//g, '/');
}

function normalize(p) {
  let s = stripDotSlash(toPosix(p));
  if (s.startsWith('../src/')) s = s.slice(3);
  if (TEST_FILE_RE.test(s)) {
    if (s.startsWith('src/') || s.startsWith('tests/')) return s;
    return `tests/${s}`;
  }
  return s;
}

function walkTests(root, sub) {
  const out = [];
  const start = join(root, sub);
  if (!existsSync(start)) return out;

  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (TEST_FILE_RE.test(e.name)) {
        out.push(normalize(relative(root, full)));
      }
    }
  };
  visit(start);
  return out;
}

function extractInventoryTokens(md) {
  const tokens = [];
  for (const m of md.matchAll(/`([^`]+)`/g)) {
    const n = normalize(m[1]);
    if (INVENTORY_TOKEN_RE.test(n)) tokens.push(n);
  }
  return tokens;
}

function main() {
  const cwd = process.cwd();
  const indexPath = join(cwd, 'tests', 'index.md');
  if (!existsSync(indexPath)) {
    console.error('缺 tests/index.md');
    process.exit(1);
  }

  let md;
  try {
    md = readFileSync(indexPath, 'utf8');
  } catch {
    console.error('缺 tests/index.md');
    process.exit(1);
  }

  const files = [...new Set([...walkTests(cwd, 'src'), ...walkTests(cwd, 'tests')])];
  const tokens = [...new Set(extractInventoryTokens(md))];
  const fileSet = new Set(files);
  const tokenSet = new Set(tokens);

  const unregistered = files.filter((f) => !tokenSet.has(f)).sort();
  const stale = tokens.filter((t) => !fileSet.has(t)).sort();

  if (unregistered.length === 0 && stale.length === 0) process.exit(0);

  if (unregistered.length) {
    console.error('未登记:');
    for (const f of unregistered) console.error(`  ${f}`);
  }
  if (stale.length) {
    console.error('假存货:');
    for (const t of stale) console.error(`  ${t}`);
  }
  process.exit(1);
}

main();
