/**
 * module-status 获取环：输出本包代码事实清单，供人工裁决回写 <包>.md。
 * 用法：node scripts/module-status/draft.mjs <pkg>
 * 覆盖：env 默认值 / 导出符号 / 路由端点（api）/ 表（db）/ 测试文件。
 */
import { PKG_ROOT, pkgRoot, extractEnv, extractExports, extractRoutes, extractTables, extractTests } from './extract.mjs';

const pkg = process.argv[2];
if (!pkg || !PKG_ROOT[pkg]) {
  console.error(`用法: node scripts/module-status/draft.mjs <pkg>\n可用包: ${Object.keys(PKG_ROOT).join(' ')}`);
  process.exit(2);
}

const out = [`# ${pkg} · 代码事实清单（draft 素材，人工裁决后回写）`];

const env = extractEnv(pkg);
if (env) {
  out.push(`\n## env 默认值 / 枚举（${pkg}/src/env.ts）`);
  out.push('| 字段 | 默认值 | 枚举 |');
  out.push('|------|--------|------|');
  for (const [k, v] of Object.entries(env)) {
    out.push(`| ${k} | ${v.default ?? '—'} | ${v.enum ? v.enum.join(' / ') : '—'} |`);
  }
}

const exportsList = extractExports(pkg).sort();
if (exportsList.length) {
  out.push(`\n## 导出符号（${exportsList.length}）`);
  out.push(exportsList.join(' · '));
}

if (pkg === 'api') {
  const routes = extractRoutes();
  out.push(`\n## 路由端点（${routes.length}）`);
  for (const r of routes) out.push(`- ${r.method} ${r.path}`);
}

if (pkg === 'db') {
  const tables = extractTables();
  out.push(`\n## 表（${tables.length}）`);
  out.push(tables.join(' · '));
}

const tests = extractTests(pkg);
if (tests.length) {
  out.push(`\n## 测试文件（${tests.length}）`);
  for (const t of tests.sort()) out.push(`- ${t}`);
}

console.log(out.join('\n'));
