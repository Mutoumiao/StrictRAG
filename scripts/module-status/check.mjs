/**
 * module-status 验证环：文档声称 ↔ 代码事实 对照，输出漂移报告。
 * 恒 exit 0（报告制，不阻塞）；判断层仍须人工裁决。
 *
 * 用法：node scripts/module-status/check.mjs [--only=1,2,3]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

import {
  ROOT,
  PKG_ROOT,
  pkgRoot,
  walkFiles,
  toPosix,
  extractEnv,
  extractExports,
  extractRoutes,
  extractTables,
} from './extract.mjs';

const DOC_DIR = join(ROOT, 'docs', 'module-status');

/** 文档 → 本包（路径解析用）与关联包（符号断言用） */
const DOC_PKG = {
  'api.md': 'api',
  'worker.md': 'worker',
  'web.md': 'web',
  'admin.md': 'admin',
  'contracts.md': 'contracts',
  'db.md': 'db',
  'admin-catalog.md': 'admin-catalog',
  'ui.md': 'ui',
  'eslint-config.md': 'eslint-config',
  'typescript-config.md': 'typescript-config',
};
const ALL_PKGS = Object.keys(PKG_ROOT);
const RELATED = {
  'api.md': ['api', 'contracts', 'db', 'admin-catalog'],
  'worker.md': ['worker', 'contracts', 'db'],
  'web.md': ['web', 'contracts', 'ui'],
  'admin.md': ['admin', 'contracts', 'admin-catalog', 'ui'],
  'contracts.md': ['contracts'],
  'db.md': ['db'],
  'admin-catalog.md': ['admin-catalog'],
  'ui.md': ['ui'],
  'eslint-config.md': ['eslint-config'],
  'typescript-config.md': ['typescript-config'],
  'README.md': ALL_PKGS,
};
// 动态发现文档；未知文档用「文件名去 .md 作为包键」的默认映射
const DOCS = readdirSync(DOC_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort()
  .concat('README.md');

const only = new Set(
  (process.argv.find((a) => a.startsWith('--only=')) ?? '')
    .slice(7)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const want = (n) => only.size === 0 || only.has(String(n));
const fail = process.argv.includes('--fail');

const findings = [];
function add(doc, check, claim, detail) {
  findings.push({ doc, check, claim, detail });
}

/* ------------------------------------------------------------------ */
/* 提取文档反引号 token                                                 */
/* ------------------------------------------------------------------ */

function docTokens(doc) {
  const src = readFileSync(join(DOC_DIR, doc), 'utf8');
  return [...src.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/* ------------------------------------------------------------------ */
/* 检查 1：路径存在性                                                    */
/* ------------------------------------------------------------------ */

let repoFileIndex = null;
function repoFiles() {
  if (repoFileIndex) return repoFileIndex;
  repoFileIndex = new Map();
  walkFiles(ROOT, (p) => {
    const b = basename(p);
    if (!repoFileIndex.has(b)) repoFileIndex.set(b, []);
    repoFileIndex.get(b).push(toPosix(p));
  });
  // walkFiles 跳过点目录（.trellis）；补收 spec 文档
  const specDir = join(ROOT, '.trellis', 'spec');
  if (existsSync(specDir)) {
    walkSpec(specDir, (p) => {
      const b = basename(p);
      if (!repoFileIndex.has(b)) repoFileIndex.set(b, []);
      repoFileIndex.get(b).push(toPosix(p));
    });
  }
  return repoFileIndex;
}

function walkSpec(dir, onFile) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkSpec(p, onFile);
    else onFile(p);
  }
}

function expandBraces(tok) {
  const parts = tok.split(/(\{[^{}]*\})/g);
  let out = [''];
  for (const p of parts) {
    if (p.startsWith('{') && p.endsWith('}')) {
      const opts = p.slice(1, -1).split(',').filter(Boolean);
      out = out.flatMap((r) => opts.map((o) => r + o));
    } else {
      out = out.map((r) => r + p);
    }
  }
  return out;
}

function pathRoots(pkg) {
  const src = pkgRoot(pkg);
  const roots = [src];
  const parent = dirname(src);
  if (parent !== ROOT) roots.push(parent); // apps/<pkg> 或 packages/<pkg>（配置文件）
  const pkgDir = join(ROOT, PKG_ROOT[pkg]);
  if (pkgDir !== src) roots.push(pkgDir);
  return [...new Set(roots)];
}

function findInRoots(clean, roots, isDir) {
  const candidates = clean.startsWith('src/') ? [clean, clean.slice(4)] : [clean];
  for (const c of candidates) {
    for (const r of roots) {
      const full = join(r, ...c.split('/'));
      if (isDir) {
        if (existsSync(full)) return true;
        continue;
      }
      if (existsSync(full)) {
        try {
          readdirSync(full);
        } catch {
          return true; // 是文件
        }
      }
    }
  }
  if (!isDir) {
    for (const r of roots) {
      let hit = false;
      walkFiles(r, (p) => {
        if (!hit && toPosix(p).endsWith('/' + clean)) hit = true;
      });
      if (hit) return true;
    }
  }
  return false;
}

/** token 是否出现在否定语境（“**没有** X / **无** X） */
function negatedIn(doc, token) {
  const src = readFileSync(join(DOC_DIR, doc), 'utf8');
  let idx = 0;
  while ((idx = src.indexOf(token, idx)) !== -1) {
    const ctx = src.slice(Math.max(0, idx - 12), idx);
    if (/没有|不存在|\*\*无\*\*|尚无|未做/.test(ctx)) return true;
    idx += token.length;
  }
  return false;
}

function checkPaths(doc) {
  const pkg = DOC_PKG[doc];
  const roots = pkg ? pathRoots(pkg) : [];
  for (const tok of docTokens(doc)) {
    const t = tok.trim();
    if (
      t.includes('<') ||
      t.includes('>') ||
      t.includes(' ') ||
      /[：，。；、（）()]/.test(t) ||
      t.startsWith('http') ||
      t.startsWith('@') ||
      t.includes('#') ||
      t.includes('*') ||
      /\{[A-Z_0-9]+\}/.test(t) ||
      /^prds\/00[–-]11/.test(t)
    ) {
      continue;
    }
    const isDir = t.endsWith('/');
    const clean = t.replace(/\/$/, '');
    if (!clean) continue;

    // task 短名
    if (/^08-\d{2}-[a-z0-9-]+$/.test(clean)) {
      if (!existsSync(join(ROOT, '.trellis', 'tasks', 'archive', '2026-08', clean))) {
        add(doc, '1-路径', `\`${tok}\``, '归档 task 目录不存在');
      }
      continue;
    }
    // 完整路径
    if (/^(apps|packages|docs|\.trellis|fixtures|prds|docker)\//.test(clean)) {
      const cands = expandBraces(clean);
      const missing = cands.filter((c) => !existsSync(join(ROOT, ...c.split('/'))));
      if (missing.length) {
        add(doc, '1-路径', `\`${tok}\``, `不存在: ${missing.join(', ')}`);
      }
      continue;
    }
    // 相对简写（文件/目录）
    if (/\.(ts|tsx|md|sql|json|mjs|css|yaml|yml|js)$/.test(clean) || isDir) {
      const cands = expandBraces(clean);
      const ok = cands.some((c) => findInRoots(c, roots, isDir));
      if (!ok) {
        const baseHits = (repoFiles().get(basename(clean)) ?? []).filter((p) =>
          cands.some((c) => p.endsWith('/' + c)),
        );
        if (baseHits.length === 0 && !negatedIn(doc, tok.trim())) {
          add(doc, '1-路径', `\`${tok}\``, '本包与全仓均未找到');
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 检查 2：env 默认值断言                                                */
/* ------------------------------------------------------------------ */

function norm(v) {
  return String(v).replace(/['"]/g, '').replace(/_/g, '');
}

function checkEnv(doc) {
  const pkg = DOC_PKG[doc];
  const fields = extractEnv(pkg);
  if (!fields) return;
  const lines = readFileSync(join(DOC_DIR, doc), 'utf8').split('\n');
  // 1) 反引号内 KEY=value：仅限「默认依赖模式」行（正文的条件描述如 `AUTH_ENFORCE=true` 不作断言）
  const modeLines = lines.filter((l) => l.includes('默认依赖模式'));
  for (const modeLine of modeLines) {
    for (const m of modeLine.matchAll(/`([A-Z][A-Z0-9_]{2,})=([A-Za-z0-9_.\-]+)`/g)) {
      assertEnvValue(doc, pkg, fields, m[1], m[2]);
    }
  }
  // 2) KEY … 默认 `value`（全文；反引号或加粗包裹的字面量）
  const src = lines.join('\n');
  for (const m of src.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b[^`\n]{0,40}?默认\s*[`*]*([A-Za-z0-9_.\-]+)[`*]*/g)) {
    assertEnvValue(doc, pkg, fields, m[1], m[2]);
  }
}

function assertEnvValue(doc, pkg, fields, key, claimed) {
  const f = fields[key];
  if (!f || f.default === undefined) return; // 提取器无默认值 → 不断言
  const code = norm(f.default);
  const docV = norm(claimed);
  if (code !== docV) {
    add(doc, '2-env', `${key}=${claimed}`, `代码默认 ${f.default}（${pkg}/src/env.ts）`);
  }
}

/* ------------------------------------------------------------------ */
/* 检查 3：导出符号断言                                                  */
/* ------------------------------------------------------------------ */

const UPPER_RE = /^[A-Z][A-Z0-9_]{2,}$/;
const UPPER_STOP = new Set([
  'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'SIGINT', 'SIGTERM', 'KNOWN', 'IMPLEMENTED',
  'SSOT', 'RPM', 'TTL', 'CLI', 'API', 'UI', 'AI', 'ID', 'SQL', 'ES', 'PG', 'OCR', 'SSE',
  'RRF', 'JWT', 'ACL', 'S3', 'DB', 'CI', 'QA', 'L1', 'L2', 'L3', 'QUAL', 'ARCH', 'OPS',
  'DEC', 'U8', 'ADR', 'HOW', 'IS', 'WHAT', 'TODO', 'URL', 'HTML', 'CDN', 'JSON', 'YAML',
  'MD', 'PNG', 'PDF', 'ANN', 'TLS', 'CRUD', 'MVP', 'OK', 'PING', 'PONG', 'MOCK', 'HTTP',
  'HTTPS', 'REDIS', 'BULLMQ', 'HONO', 'ZOD', 'NODE', 'TS', 'TXT', 'SCAN', 'MALWARE',
  'NOT_APPROVED', 'NO_TEXT_LAYER', 'NO_MANIFEST', 'DOC_LOCK_BUSY', 'EMBED_FAILED',
  'ES_INDEX_FAILED', 'ES_RECONCILE_FAILED', 'UNSUPPORTED_CHUNK_STRATEGY',
  'SCAN_ENGINE_UNAVAILABLE', 'DOC_NOT_FOUND', 'EMPTY_CHUNKS', 'MISSING_INDEX_VERSION',
  'EMBED_NOT_READY', 'UNKNOWN_STAGE', 'IDEMPOTENT_CHUNK_FORBIDDEN', 'INGEST', 'PROBE', 'DEPT', 'P0', 'P1', 'P2', 'S2', 'B1',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13',
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10',
  // 配置 / 概念名（非导出符号）
  'DEPT_ACL_ENFORCE', 'L1_KB_ID', 'L1_PERSIST_EVAL', 'L1_MAX_CASES', 'L1_TENANT_ID',
  'L1_USER_ID', 'L1_GOLD_PATH', 'L1_OUT_DIR', 'NEXT_PUBLIC_API_BASE_URL',
  'UNAUTHORIZED', 'SESSION_DISABLED', 'NEXT_PUBLIC_APP_ENV', 'OPENAPI',
]);

// env 字段名（api + worker）一律视为配置而非符号
for (const p of ['api', 'worker']) {
  const f = extractEnv(p);
  if (f) for (const k of Object.keys(f)) UPPER_STOP.add(k);
}

function checkSymbols(doc) {
  const pkg = DOC_PKG[doc];
  const related = (RELATED[doc] ?? []).length ? RELATED[doc] : pkg ? [pkg] : [];
  const exportsSet = new Set();
  for (const p of related) {
    for (const s of extractExports(p)) exportsSet.add(s);
  }
  for (const tok of docTokens(doc)) {
    const t = tok.trim();
    if (!UPPER_RE.test(t)) continue;
    if (UPPER_STOP.has(t)) continue;
    if (/^[A-Z]\d{1,2}$/.test(t)) continue; // B12 / R7 / P0 形态
    if (!exportsSet.has(t)) {
      add(doc, '3-符号', `\`${t}\``, `关联包（${related.join('/')}）导出中不存在（可能为概念名，可加入黑名单）`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 检查 4：路由端点断言                                                  */
/* ------------------------------------------------------------------ */

function checkRoutes(doc) {
  if (doc !== 'api.md') return;
  const endpoints = extractRoutes();
  const set = new Set(endpoints.map((e) => `${e.method} ${e.path}`));
  for (const tok of docTokens(doc)) {
    const m = tok.trim().match(/^(GET|POST|PATCH|PUT|DELETE)\s+(\/[A-Za-z0-9_{}:\-/.]+)$/);
    if (!m) continue;
    const method = m[1];
    let path = m[2].replace(/\/{2,}/g, '/');
    if (!path.startsWith('/api/v1')) path = `/api/v1${path}`;
    const key = `${method} ${path}`;
    if (!set.has(key)) {
      add(doc, '4-端点', `\`${tok.trim()}\``, `提取端点（61 个）中无 ${key}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 检查 5：表名断言                                                     */
/* ------------------------------------------------------------------ */

const SNAKE_RE = /^[a-z][a-z0-9_]{2,}$/;
const SNAKE_STOP = new Set([
  'structure_paragraph', 'fixed_window', 'heading_sections', 'mock_clean', 'mock_infected',
  'mock_embed', 'needs_ocr', 'development', 'test', 'staging', 'production', 'ready',
  'active', 'draft', 'queued', 'running', 'succeeded', 'failed', 'pending', 'approved',
  'rejected', 'answered', 'abstained', 'error', 'uploaded', 'chitchat', 'local', 'enqueued',
  'strict_rag_dev', 'dev_only', 'default', 'unknown', 'errorcount', 'mock_es', 'resume_embed',
  'skip_trace', 'answerable', 'unanswerable', 'not_found', 'validation_error', 'rule_violation',
  'payload_too_large', 'internal_guard', 'conflict', 'unauthorized', 'forbidden', 'gone',
  'processed', 'scan', 'parse', 'chunk', 'embed', 'es_index', 'mock', 'fail', 'off', 'on',
  // 字段 / 角色 / 事件 / 通用词（非表名）
  'false', 'true', 'worker', 'api', 'env', 'dashboard', 'execute', 'timeout', 'name',
  'description', 'mode', 'codes', 'body_text', 'kb_settings_patch', 'doc_operator',
  'super_admin', 'codes_json', 'embedding', 'vector', 'retrieve_mode', 'report_json',
  'signoff_eligible',
]);

function checkTables(doc) {
  if (!['api.md', 'worker.md', 'db.md', 'README.md'].includes(doc)) return;
  const tables = new Set(extractTables());
  const enumValues = new Set();
  for (const p of ['api', 'worker']) {
    const f = extractEnv(p);
    if (!f) continue;
    for (const info of Object.values(f)) {
      if (info.enum) for (const v of info.enum) enumValues.add(v);
    }
  }
  const src = readFileSync(join(DOC_DIR, doc), 'utf8');
  for (const tok of docTokens(doc)) {
    const t = tok.trim();
    if (!SNAKE_RE.test(t)) continue;
    if (enumValues.has(t) || SNAKE_STOP.has(t)) continue;
    if (t.endsWith('_id') || t.endsWith('_ids')) continue; // 字段形态
    if (tables.has(t)) continue;
    // db.md 是表主文档全量断言；其它文档要求出现于「表」字上下文（数据表/表名/…表）
    if (doc !== 'db.md') {
      let idx = 0;
      let seen = false;
      while ((idx = src.indexOf(t, idx)) !== -1) {
        const ctx = src.slice(Math.max(0, idx - 10), idx + t.length + 10);
        if (ctx.includes('表')) {
          seen = true;
          break;
        }
        idx += t.length;
      }
      if (!seen) continue;
    }
    add(doc, '5-表', `\`${t}\``, 'db schema 表清单中不存在（可能为字段/状态词，可加入黑名单）');
  }
}

/* ------------------------------------------------------------------ */
/* 检查 6：变更联动                                                     */
/* ------------------------------------------------------------------ */

const PKG_DIR = {};
for (const [pkg, rel] of Object.entries(PKG_ROOT)) {
  PKG_DIR[pkg] = rel.startsWith('apps') || rel.startsWith('packages') ? rel.split('/').slice(0, 2).join('/') : rel;
}

function checkDrift() {
  let status = '';
  try {
    status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return; // 非 git 环境跳过
  }
  const changed = new Set();
  for (const line of status.split('\n')) {
    const m = line.match(/^(?:.{1,2} |\?\?) (.*)$/);
    if (m) changed.add(m[1].replace(/^"|"$/g, ''));
  }
  for (const [pkg, dir] of Object.entries(PKG_DIR)) {
    const docFile = `${pkg}.md`;
    const touched = [...changed].some((p) => p.startsWith(dir + '/') && !p.startsWith(dir + '/src/__fixtures__'));
    const docTouched = changed.has(`docs/module-status/${docFile}`);
    if (touched && !docTouched) {
      add('(工作区)', '6-联动', `改 ${dir}/* 未改 docs/module-status/${docFile}`, '可能漂移，需人工确认');
    }
  }
}

/* ------------------------------------------------------------------ */
/* 检查 7：时效性（文档日期 vs git 提交历史）                             */
/* ------------------------------------------------------------------ */

function parseDocDate(doc) {
  const src = readFileSync(join(DOC_DIR, doc), 'utf8');
  const m = src.match(/\|\s*最近更新\s*\|\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function checkFreshness(doc) {
  const pkg = DOC_PKG[doc];
  if (!pkg) return; // README 无「最近更新」元信息
  const dir = PKG_DIR[pkg];
  if (!dir) return;
  const date = parseDocDate(doc);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  // 严格晚于文档「最近更新」当天的提交才算漂移（当日提交视为已覆盖）
  const since = `${date}T23:59:59`;
  let log = '';
  try {
    log = execFileSync('git', ['log', `--since=${since}`, '--pretty=format:%h', '--', dir], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    return; // 非 git / 浅克隆跳过
  }
  const commits = log.trim().split('\n').filter(Boolean);
  if (commits.length) {
    add(
      doc,
      '7-时效',
      `\`${dir}\` 在 ${date} 后有 ${commits.length} 个提交`,
      `文档「最近更新」未同步；最新提交 ${commits[0]}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* 主流程                                                               */
/* ------------------------------------------------------------------ */

const checks = [
  [1, checkPaths],
  [2, checkEnv],
  [3, checkSymbols],
  [4, checkRoutes],
  [5, checkTables],
  [6, checkDrift],
  [7, checkFreshness],
];

for (const [n, fn] of checks) {
  if (!want(n)) continue;
  for (const doc of DOCS) {
    if (n === 6) break;
    fn(doc);
  }
  if (n === 6) fn();
}

const json = process.argv.includes('--json');

if (json) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const byCheck = new Map();
  for (const f of findings) {
    if (!byCheck.has(f.check)) byCheck.set(f.check, []);
    byCheck.get(f.check).push(f);
  }

  console.log(`module-status 漂移报告 · ${findings.length} 条\n`);
  for (const [check, list] of byCheck) {
    console.log(`── ${check}（${list.length}）`);
    for (const f of list) {
      console.log(`  [${f.doc}] ${f.claim}`);
      console.log(`      ${f.detail}`);
    }
  }
  if (findings.length === 0) {
    console.log('（零漂移）');
  } else if (fail) {
    console.log('\n--fail：存在漂移（exit 1）');
  }
}

if (fail && findings.length > 0) process.exitCode = 1;
