#!/usr/bin/env node
/**
 * 栈体检：对正在运行的一键栈做就绪与可用性核查，产出人读摘要 + 机器可读报告。
 * 用途：全自动化测试的前置门 —— 先确认"栈可达且就绪"，再跑业务烟测（smoke:half / demo:ingest）。
 *
 *   pnpm verify:stack              人读摘要；任一 FAIL 则退出码非零
 *   pnpm verify:stack --json       只打 JSON（供 Agent / CI 解析）
 *   pnpm verify:stack --no-docker  跳过 docker compose 服务健康项
 *   pnpm verify:stack --report=D:\path\report.json
 *
 * 报告默认落 .data/run/verify-report.json。
 * 边界：只证明栈级可用性（api /ready 的硬依赖、web / admin 可服务、worker 就绪、日志齐全、容器健康），
 * **不**证明业务正确性，**不**证明生产可用。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APP_NAMES,
  composePsArgs,
  httpGet,
  isApiReady,
  isHttpReadyStatus,
  logFilePath,
  readStatus,
  repoRoot,
  statusFilePath,
} from './dev-all.mjs';
import { COMPOSE_SERVICES, HARD_DEPS, evaluateDockerServices, parseComposePs } from './docker-deps.mjs';

const DEFAULT_REPORT = path.join(repoRoot, '.data', 'run', 'verify-report.json');
/** 判定口径与 dev-all 的就绪探针同一个实现，这里只换名字。 */
export const isHttpOk = isHttpReadyStatus;
export { evaluateDockerServices, parseComposePs };

export function parseArgs(argv) {
  const opts = { json: false, docker: true, report: DEFAULT_REPORT, help: false };
  const errors = [];
  for (const raw of argv) {
    const [flag, value] = raw.split('=');
    switch (flag) {
      case '--json':
        opts.json = true;
        break;
      case '--no-docker':
        opts.docker = false;
        break;
      case '--report':
        if (!value) errors.push('--report 需要路径，如 --report=.data/run/r.json');
        else opts.report = value;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        errors.push(`未知参数：${raw}`);
    }
  }
  return { opts, errors };
}

/** api /ready 的 checks 分档：postgres / redis 是硬依赖；其余未配置时 skipped 属正常。 */
export function classifyReadyChecks(checks = {}) {
  const hard = {};
  for (const name of HARD_DEPS) hard[name] = checks[name] ?? 'missing';
  const optional = Object.entries(checks)
    .filter(([name]) => !HARD_DEPS.includes(name))
    .map(([name, state]) => `${name}=${state}`);
  return {
    hard,
    hardOk: HARD_DEPS.every((name) => hard[name] === 'up'),
    optional,
    optionalDown: Object.entries(checks)
      .filter(([name, state]) => !HARD_DEPS.includes(name) && state === 'down')
      .map(([name]) => name),
  };
}

/**
 * 日志跨次追加，所以只看本次运行段：锚点是 dev-all 记在 status.json 里的起始偏移。
 * offset 缺失时退回全文（调用方会在无记录时改判 warn，避免拿上一轮日志冒充当次）。
 */
export function sliceFromOffset(text, offset) {
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset <= 0) return text;
  return text.slice(offset);
}

/** worker 无 HTTP，就绪信号只能来自本次运行段的日志行；无运行记录或栈已停时不臆断。 */
export function evaluateWorkerReady({ text, startOffset, hasRecord, stoppedAt = null }) {
  if (!hasRecord) {
    return { status: 'warn', detail: '无运行记录（栈可能不是由 pnpm dev 起的），worker 就绪未判定' };
  }
  if (stoppedAt) {
    return { status: 'warn', detail: `运行记录已于 ${stoppedAt} 停止，worker 就绪未判定` };
  }
  const chunk = sliceFromOffset(text ?? '', startOffset);
  if (!chunk) return { status: 'fail', detail: '本次运行段无输出 → pnpm logs worker -n 40' };
  return /worker running/.test(chunk)
    ? { status: 'pass', detail: '本次运行段出现「worker running」' }
    : { status: 'fail', detail: '本次运行段未见「worker running」→ pnpm logs worker -n 40' };
}

/** 日志新鲜度同理：要求本次运行段非空，历史文件不算数。 */
export function evaluateLogFreshness({ sizes, startOffsets, hasRecord }) {
  if (!hasRecord) return { status: 'warn', detail: '无本次运行记录，日志新鲜度未判定' };
  const stale = Object.keys(sizes).filter(
    (name) => sizes[name] === null || sizes[name] <= (startOffsets[name] ?? 0),
  );
  return stale.length
    ? { status: 'fail', detail: `本次运行段无内容：${stale.join(',')}` }
    : { status: 'pass', detail: `${Object.keys(sizes).length} 份日志均有本次运行输出` };
}

export function summarize(items) {
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const entry of items) counts[entry.status] += 1;
  return { ...counts, passed: counts.fail === 0 };
}

function makeItem(id, status, detail) {
  return { id, status, detail };
}

function fileSize(file) {
  try {
    return statSync(file).size;
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function composePsRows() {
  const res = spawnSync('docker', composePsArgs(), {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    return { ok: false, rows: [], error: (res.stderr || '').trim().split('\n')[0] || 'docker 不可用' };
  }
  return { ok: true, rows: parseComposePs(res.stdout || '') };
}

export async function collect(opts) {
  const items = [];
  const status = readStatus();

  if (!status) {
    items.push(
      makeItem('stack.status', 'warn', `没找到 ${path.relative(repoRoot, statusFilePath())}（栈可能不是由 pnpm dev 起的）`),
    );
  } else if (status.stoppedAt) {
    items.push(makeItem('stack.status', 'warn', `记录显示已于 ${status.stoppedAt} 停止，以实时探针为准`));
  } else {
    items.push(makeItem('stack.status', 'pass', `startedAt=${status.startedAt} mode=${status.mode} ready=${status.ready}`));
  }

  const health = await httpGet('http://127.0.0.1:4000/health', 3000);
  let healthOk = false;
  try {
    healthOk = health.status === 200 && JSON.parse(health.body).status === 'ok';
  } catch {
    healthOk = false;
  }
  items.push(
    makeItem(
      'api.health',
      healthOk ? 'pass' : 'fail',
      healthOk ? 'HTTP 200 status=ok' : `不可用（HTTP ${health.status}）→ pnpm logs api -n 40`,
    ),
  );

  const ready = await httpGet('http://127.0.0.1:4000/ready', 3000);
  const readyOk = ready.status === 200 && isApiReady(ready.body);
  items.push(
    makeItem('api.ready', readyOk ? 'pass' : 'fail', readyOk ? 'ready=true' : `非就绪（HTTP ${ready.status}）`),
  );
  let checks = {};
  try {
    checks = JSON.parse(ready.body).checks ?? {};
  } catch {
    checks = {};
  }
  const deps = classifyReadyChecks(checks);
  items.push(
    makeItem(
      'api.deps.hard',
      deps.hardOk ? 'pass' : 'fail',
      deps.hardOk
        ? HARD_DEPS.map((name) => `${name}=${deps.hard[name]}`).join(' ')
        : `硬依赖异常：${JSON.stringify(deps.hard)}`,
    ),
  );
  items.push(
    makeItem(
      'api.deps.optional',
      deps.optionalDown.length ? 'warn' : 'pass',
      `${deps.optional.join(' ') || '（无）'}${deps.optionalDown.length ? ` · down：${deps.optionalDown.join(',')}` : ''}`,
    ),
  );

  for (const [id, app, port] of [
    ['web.http', 'web', 3005],
    ['admin.http', 'admin', 3006],
  ]) {
    const res = await httpGet(`http://127.0.0.1:${port}/`, 3000);
    items.push(
      makeItem(
        id,
        isHttpReadyStatus(res.status) ? 'pass' : 'fail',
        isHttpReadyStatus(res.status) ? `HTTP ${res.status}` : `不可访问（HTTP ${res.status}）→ pnpm logs ${app} -n 40`,
      ),
    );
  }

  const workerLog = logFilePath('worker');
  let workerText = '';
  try {
    workerText = readFileSync(workerLog, 'utf8');
  } catch {
    workerText = '';
  }
  const hasRecord = Boolean(status?.apps?.length);
  const workerEntry = status?.apps?.find((app) => app.name === 'worker');
  const workerVerdict = evaluateWorkerReady({
    text: workerText,
    startOffset: workerEntry?.startOffset,
    hasRecord,
    stoppedAt: status?.stoppedAt ?? null,
  });
  items.push(makeItem('worker.ready', workerVerdict.status, workerVerdict.detail));

  const sizes = Object.fromEntries(APP_NAMES.map((name) => [name, fileSize(logFilePath(name))]));
  const startOffsets = Object.fromEntries(
    APP_NAMES.map((name) => [name, status?.apps?.find((app) => app.name === name)?.startOffset ?? 0]),
  );
  const logVerdict = evaluateLogFreshness({ sizes, startOffsets, hasRecord });
  items.push(makeItem('logs.files', logVerdict.status, logVerdict.detail));

  if (!status?.apps?.length) {
    items.push(makeItem('processes.alive', 'skip', '无状态文件记录，跳过进程存活检查'));
  } else {
    const dead = status.apps.filter((app) => !pidAlive(app.pid)).map((app) => app.name);
    items.push(
      makeItem(
        'processes.alive',
        dead.length ? 'fail' : 'pass',
        dead.length ? `已退出：${dead.join(',')}` : `${status.apps.map((app) => app.name).join('/')} pid 存活`,
      ),
    );
  }

  if (!opts.docker) {
    items.push(makeItem('docker.services', 'skip', '--no-docker'));
  } else {
    const ps = composePsRows();
    if (!ps.ok) {
      items.push(makeItem('docker.services', 'skip', `docker 不可用（${ps.error}）`));
    } else {
      const evaluated = evaluateDockerServices(ps.rows);
      const detail = evaluated.ok
        ? `${COMPOSE_SERVICES.length} 个服务 running/healthy`
        : [
            evaluated.missing.length ? `缺失：${evaluated.missing.join(',')}` : '',
            evaluated.bad.join(' '),
          ]
            .filter(Boolean)
            .join(' · ');
      items.push(makeItem('docker.services', evaluated.ok ? 'pass' : 'fail', detail));
    }
  }

  return { status, items };
}

function printHuman(reportPath, report) {
  const width = Math.max(...report.items.map((entry) => entry.id.length));
  for (const entry of report.items) {
    console.log(`  ${entry.status.toUpperCase().padEnd(5)} ${entry.id.padEnd(width)}  ${entry.detail}`);
  }
  const s = report.summary;
  console.log(
    `\n[verify] PASS ${s.pass} · FAIL ${s.fail} · WARN ${s.warn} · SKIP ${s.skip} → ${report.passed ? '栈可用' : '栈不可用'}`,
  );
  console.log(`[verify] 报告：${path.relative(repoRoot, reportPath).split(path.sep).join('/')}`);
  if (!report.passed) {
    console.log('[verify] 看失败项对应的日志：pnpm logs <api|worker|web|admin> -n 40');
  }
}

async function main() {
  process.stdout.on('error', () => {});
  const { opts, errors } = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('用法：pnpm verify:stack [--json] [--no-docker] [--report=<路径>]');
    console.log(
      '核查：栈状态记录 · api /health 与 /ready（含硬依赖）· web / admin 可服务 · worker 就绪 · 日志齐全 · 进程存活 · 容器健康',
    );
    return 0;
  }
  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    console.error('     用法：pnpm verify:stack --help');
    return 1;
  }

  const { status, items } = await collect(opts);
  const summary = summarize(items);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    passed: summary.passed,
    summary,
    stack: status
      ? {
          startedAt: status.startedAt,
          mode: status.mode,
          ready: status.ready,
          stoppedAt: status.stoppedAt ?? null,
        }
      : null,
    items,
  };

  mkdirSync(path.dirname(opts.report), { recursive: true });
  writeFileSync(opts.report, `${JSON.stringify(report, null, 2)}\n`);

  if (opts.json) console.log(JSON.stringify({ ...report, reportPath: opts.report }, null, 2));
  else printHuman(opts.report, report);

  return report.passed ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error('FAIL:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
