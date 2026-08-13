/**
 * module-status 漂移报告生成器（本地手动执行）。
 *
 * 运行 check 拿漂移报告，落点二选一：
 *   - 默认（task）：创建/更新 Trellis task（.trellis/tasks/<MM-DD>-module-status-drift），
 *     漂移报告写入该 task 的 prd.md，供人工安排 Agent 查阅并修改 module-status 文档。
 *   - --out <file|dir>：报告写入指定文件或目录（不创建 task）。
 *
 * 用法：
 *   node scripts/module-status/report.mjs                     # task 模式
 *   node scripts/module-status/report.mjs --out drift.md      # 写单文件
 *   node scripts/module-status/report.mjs --out reports/      # 写目录，文件名 drift-YYYY-MM-DD.md
 *   node scripts/module-status/report.mjs --assignee <name>   # task 模式指定 assignee（默认 drift-bot）
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

const outPath = arg('--out', null);
const assignee = arg('--assignee', 'drift-bot');

const now = new Date();
const y = now.getFullYear();
const m = String(now.getMonth() + 1).padStart(2, '0');
const d = String(now.getDate()).padStart(2, '0');
const stamp = `${y}-${m}-${d}`;
const mmdd = `${m}-${d}`;

function runCheckJson() {
  const out = execFileSync(process.execPath, ['scripts/module-status/check.mjs', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

function findingsToText(findings) {
  if (findings.length === 0) return '（零漂移）';
  const byCheck = new Map();
  for (const f of findings) {
    if (!byCheck.has(f.check)) byCheck.set(f.check, []);
    byCheck.get(f.check).push(f);
  }
  const lines = [`module-status 漂移报告 · ${findings.length} 条`];
  for (const [check, list] of byCheck) {
    lines.push(`── ${check}（${list.length}）`);
    for (const f of list) {
      lines.push(`  [${f.doc}] ${f.claim}`);
      lines.push(`      ${f.detail}`);
    }
  }
  return lines.join('\n');
}

function buildPrd(reportText) {
  return [
    `# module-status 漂移报告（${stamp}）`,
    '',
    '## Goal',
    '',
    '以源码为准回写 `docs/module-status/`，消除漂移。',
    '',
    '## 漂移报告（自动扫描）',
    '',
    '```',
    reportText,
    '```',
    '',
    '## Requirements',
    '',
    '- 对每个漂移包：`pnpm draft:module-status <pkg>` 取代码事实清单',
    '- 按 `update-module-status` skill 流程裁决回写 `docs/module-status/<包>.md`',
    '- 回写后 `pnpm check:module-status` 应输出「零漂移」',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] `pnpm check:module-status` 输出「零漂移」',
    '',
  ].join('\n');
}

function taskDir() {
  return join(ROOT, '.trellis', 'tasks', `${mmdd}-module-status-drift`);
}

function ensureTask() {
  const dir = taskDir();
  if (existsSync(dir)) {
    console.log(`已存在 Trellis task：.trellis/tasks/${mmdd}-module-status-drift，更新其 prd.md`);
    return dir;
  }
  const title = `module-status 漂移报告（${stamp}）`;
  let stdout = '';
  try {
    stdout = execFileSync(
      'python',
      [
        '.trellis/scripts/task.py',
        'create',
        title,
        '--slug',
        'module-status-drift',
        '--assignee',
        assignee,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
  } catch (e) {
    console.error('调用 task.py create 失败：', e.message);
    console.error('提示：确认已安装 python，且 .trellis/scripts/task.py 可运行。');
    process.exit(1);
  }
  // task.py create 的 stdout 最后一行是 task 相对路径（.trellis/tasks/<dir>）
  const lines = stdout.trim().split('\n').filter(Boolean);
  const created = lines[lines.length - 1].trim();
  console.log(`已创建 Trellis task：${created}`);
  return join(ROOT, created);
}

function writeOut() {
  const base = resolve(ROOT, outPath);
  const target = outPath.endsWith('.md') ? base : join(base, `drift-${stamp}.md`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buildPrd(findingsToText(findings)), 'utf8');
  console.log(`漂移报告已写入：${target}`);
}

const findings = runCheckJson();

if (findings.length === 0) {
  console.log('（零漂移）无需生成报告。');
  const dir = taskDir();
  if (existsSync(dir)) {
    console.log(`提示：存在活跃漂移 task（.trellis/tasks/${mmdd}-module-status-drift），已零漂移可手动归档：`);
    console.log('  python .trellis/scripts/task.py archive module-status-drift');
  }
  process.exit(0);
}

if (outPath) {
  writeOut();
} else {
  const dir = ensureTask();
  writeFileSync(join(dir, 'prd.md'), buildPrd(findingsToText(findings)), 'utf8');
  console.log('漂移报告已写入 prd.md。');
  console.log('下一步：人工安排 Agent 查阅该 task，按 prd.md 修改 module-status 文档。');
}
