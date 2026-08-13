/**
 * module-status 代码事实提取器（纯 Node ESM，零依赖）。
 *
 * 只做「规整模式」的静态提取：z.coerce / transform / superRefine / 动态路由
 * 不解析（不产生断言，宁缺毋滥）。输出供 draft.mjs（获取环）与 check.mjs（验证环）复用。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** 包键 → 源码根（相对仓库根） */
export const PKG_ROOT = {
  api: 'apps/api/src',
  worker: 'apps/worker/src',
  web: 'apps/web/src',
  admin: 'apps/admin/src',
  contracts: 'packages/contracts/src',
  db: 'packages/db/src',
  'admin-catalog': 'packages/admin-catalog/src',
  ui: 'packages/ui/src',
  'eslint-config': 'packages/eslint-config',
  'typescript-config': 'packages/typescript-config',
};

export function pkgRoot(pkg) {
  return join(ROOT, PKG_ROOT[pkg] ?? '');
}

function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/* ------------------------------------------------------------------ */
/* env：Zod 默认值 / 枚举值                                             */
/* ------------------------------------------------------------------ */

/**
 * 提取 env.ts 字段：{ KEY: { enum?: string[], default?: string, optional?: boolean } }
 * 字段块 = 4 空格缩进的 `KEY:` 开头，到下一个同缩进 `KEY:` 或文件尾。
 * 返回 null 表示该包无 env.ts。
 */
export function extractEnv(pkg) {
  const src = readIfExists(join(pkgRoot(pkg), 'env.ts'));
  if (src === null) return null;

  // 枚举变量：const X = [...] as const; 与 const X = z.enum([...]);
  // 变量名允许驼峰（AppEnvSchema 等）；未命中时跨文件搜（INGEST_SCAN_MODES 在 scan-mode-policy.ts）
  const enumVars = {};
  for (const m of src.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?\s*[;,]/g)) {
    enumVars[m[1]] = parseEnumList(m[2]);
  }
  for (const m of src.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*z\.enum\(\s*\[([\s\S]*?)\]\s*\)/g)) {
    enumVars[m[1]] = parseEnumList(m[2]);
  }
  const envFileDir = pkgRoot(pkg);

  const starts = [];
  const fieldRe = /(?:^|\n)( {4})([A-Z][A-Z0-9_]*):/g;
  let fm;
  while ((fm = fieldRe.exec(src)) !== null) {
    starts.push({ key: fm[2], index: fm.index + fm[0].length });
  }

  const fields = {};
  for (let i = 0; i < starts.length; i++) {
    // parseEnv 返回对象会重复出现字段名（如 STORAGE_LOCAL_DIR 被重新赋值），
    // 覆盖会丢失 schema 里的默认值；schema 定义总在前，保留首个。
    if (starts[i].key in fields) continue;
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    const block = src.slice(starts[i].index, end);
    fields[starts[i].key] = parseEnvField(block, enumVars, envFileDir);
  }
  return Object.keys(fields).length ? fields : null;
}

function parseEnumList(raw) {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function parseEnvField(block, enumVars, envFileDir) {
  const info = { enum: undefined, default: undefined, optional: false };
  const dm =
    block.match(/\.default\(\s*(['"])(.*?)\1\s*\)/) ??
    block.match(/\.default\(\s*([\d_]+(?:\.\d+)?)\s*\)/) ??
    block.match(/\.default\(\s*(true|false)\s*\)/);
  if (dm) {
    info.default = dm[1] === '"' || dm[1] === "'" ? dm[2] : dm[1];
  }
  const em = block.match(/z\.enum\(\s*\[([^\]]*)\]\)/);
  if (em) {
    info.enum = parseEnumList(em[1]);
  } else {
    const ev = block.match(/z\.enum\(\s*([A-Z][A-Za-z0-9_]*)\s*\)/);
    if (ev) {
      info.enum = resolveEnumVar(ev[1], enumVars, envFileDir);
    }
  }
  // 变量引用枚举（AppEnvSchema.default(...) 等）
  if (!info.enum) {
    const vv = block.match(/\b([A-Z][A-Za-z0-9_]*)(?:\.default\([^)]*\))?\s*(?:\.|\)|$)/);
    if (vv) info.enum = resolveEnumVar(vv[1], enumVars, envFileDir);
  }
  if (block.includes('.optional()')) info.optional = true;
  return info;
}

let enumVarFileCache = null;
function resolveEnumVar(name, enumVars, envFileDir) {
  if (enumVars[name]) return enumVars[name];
  // 跨文件搜：包内递归找 `const NAME = [...]`（如 INGEST_SCAN_MODES）
  if (enumVarFileCache === null) {
    enumVarFileCache = new Map();
    walkFiles(envFileDir, (p) => {
      if (!p.endsWith('.ts')) return;
      const fs = readIfExists(p);
      if (fs === null) return;
      for (const m of fs.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?\s*[;,]/g)) {
        if (!enumVarFileCache.has(m[1])) enumVarFileCache.set(m[1], parseEnumList(m[2]));
      }
    });
  }
  return enumVarFileCache.get(name);
}

/* ------------------------------------------------------------------ */
/* exports：index.ts re-export 链 → 符号名                              */
/* ------------------------------------------------------------------ */

/** 解析 .js/.ts 相对导入为真实文件路径；找不到返回 null */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  const cands = [];
  // TS 源码里 import 常写 .js 后缀（NodeNext），真实文件是 .ts
  if (base.endsWith('.js')) cands.push(base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx');
  cands.push(base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx'));
  for (const c of cands) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * 提取包导出符号（含 re-export 链递归）。
 * 返回 string[]；解析不了的 import 静默跳过。
 */
export function extractExports(pkg) {
  const indexFile = join(pkgRoot(pkg), 'index.ts');
  if (!existsSync(indexFile)) return [];
  const symbols = new Set();
  const seen = new Set();
  const queue = [indexFile];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readIfExists(f);
    if (src === null) continue;

    for (const m of src.matchAll(/export\s*\*\s*from\s*['"](.+?)['"]/g)) {
      const t = resolveImport(f, m[1]);
      if (t) queue.push(t);
    }
    for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*from\s*['"](.+?)['"]/g)) {
      addNamed(m[1], symbols);
      const t = resolveImport(f, m[2]);
      if (t) queue.push(t);
    }
    for (const m of src.matchAll(/export\s*\{([^}]+)\}(?!\s*from)/g)) {
      addNamed(m[1], symbols);
    }
    for (const m of src.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) symbols.add(m[1]);
    for (const m of src.matchAll(/export\s+function\s+([A-Za-z_$][\w$]*)/g)) symbols.add(m[1]);
    for (const m of src.matchAll(/export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)/g)) symbols.add(m[1]);
  }
  return [...symbols];
}

function addNamed(list, symbols) {
  for (const name of list.split(',')) {
    let n = name.trim();
    if (n.startsWith('type ')) n = n.slice(5).trim();
    n = n.split(/\s+as\s+/)[0].trim();
    if (n) symbols.add(n);
  }
}

/* ------------------------------------------------------------------ */
/* routes：api 路由端点（静态模式）                                      */
/* ------------------------------------------------------------------ */

/**
 * 提取 api 端点：{ method, path }[]，path 为完整路径（如 /api/v1/documents/:docId）。
 * 支持 app.route('prefix', xRoutes) 挂载 + 路由文件内 `x.get('path')` / 函数内 `app.get(...)`。
 */
export function extractRoutes() {
  const appFile = join(ROOT, 'apps/api/src/app.ts');
  const src = readIfExists(appFile);
  if (src === null) return [];

  // 符号 → 文件（import 映射）
  const symbolFile = {};
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](.+?)['"]/g)) {
    const t = resolveImport(appFile, m[2]);
    if (!t) continue;
    for (const name of m[1].split(',')) {
      const n = name.trim().split(/\s+as\s+/)[0].trim();
      if (n && !n.startsWith('type ')) symbolFile[n] = t;
    }
  }

  const endpoints = [];
  for (const m of src.matchAll(/app\.route\(\s*['"]([^'"]*)['"]\s*,\s*([A-Za-z_$][\w$()]*)\s*\)/g)) {
    const prefix = m[1];
    const expr = m[2];
    const varName = expr.replace(/\(\)$/, '');
    const file = symbolFile[varName];
    if (!file) continue;
    const fileSrc = readIfExists(file);
    if (fileSrc === null) continue;
    // 精确匹配文件内 Hono 实例变量（覆盖 `export const xxxRoutes = new Hono()` 与工厂内 `const routes = new Hono()`）
    for (const vm of fileSrc.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+Hono/g)) {
      const rv = vm[1];
      const methodRe = new RegExp(
        `\\b${rv}\\s*\\.\\s*(get|post|patch|put|delete)\\(\\s*['"]([^'"]+)['"]`,
        'g',
      );
      let rm;
      while ((rm = methodRe.exec(fileSrc)) !== null) {
        endpoints.push({ method: rm[1].toUpperCase(), path: joinPath(prefix, rm[2]) });
      }
    }
  }
  return endpoints;
}

function joinPath(prefix, path) {
  const p = prefix === '/' || prefix === '' ? path : `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
  return p.replace(/\/{2,}/g, '/');
}

/* ------------------------------------------------------------------ */
/* tables：db 表名（pgTable 字面量）                                     */
/* ------------------------------------------------------------------ */

/**
 * 提取 db 真实表名：解析 schema/index.ts re-export → 各文件 pgTable('name', ...)。
 * 返回 string[]（蛇形表名）。
 */
export function extractTables() {
  const indexFile = join(ROOT, 'packages/db/src/schema/index.ts');
  const src = readIfExists(indexFile);
  if (src === null) return [];
  const files = new Set([indexFile]);
  for (const m of src.matchAll(/from\s*['"](.+?)['"]/g)) {
    const t = resolveImport(indexFile, m[1]);
    if (t) files.add(t);
  }
  const tables = new Set();
  for (const f of files) {
    const fs = readIfExists(f);
    if (fs === null) continue;
    for (const m of fs.matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)) tables.add(m[1]);
  }
  return [...tables];
}

/* ------------------------------------------------------------------ */
/* tests：测试文件清单                                                  */
/* ------------------------------------------------------------------ */

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.turbo', 'coverage', '.data']);

export function extractTests(pkg) {
  const root = pkgRoot(pkg);
  const out = [];
  walkFiles(root, (p) => {
    if (/\.test\.(ts|tsx)$/.test(p)) out.push(toPosix(relative(ROOT, p)));
  });
  return out;
}

export function walkFiles(dir, onFile) {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, onFile);
    else onFile(p);
  }
}

export function toPosix(p) {
  return p.split(sep).join('/');
}

/* ------------------------------------------------------------------ */
/* CLI：node extract.mjs <kind> <pkg>                                   */
/* ------------------------------------------------------------------ */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , kind, pkg] = process.argv;
  const result =
    kind === 'env' ? extractEnv(pkg)
    : kind === 'exports' ? extractExports(pkg)
    : kind === 'routes' ? extractRoutes()
    : kind === 'tables' ? extractTables()
    : kind === 'tests' ? extractTests(pkg)
    : null;
  if (result === null) {
    console.error(`用法: node extract.mjs <env|exports|routes|tables|tests> [pkg]`);
    process.exit(2);
  }
  console.log(JSON.stringify(result, null, 2));
}
