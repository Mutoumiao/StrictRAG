#!/usr/bin/env node
/**
 * 本地一键栈：docker 中间件 → 数据库迁移 → 四个应用进程（api / worker / web / admin）。
 * 一个窗口起完：日志带 `[app]` 前缀实时输出，同时追加落盘 `.data/logs/<app>.log`。
 * 就绪后打印一行 `STACK_READY` 并把状态写进 `.data/run/status.json`（供 Agent / 脚本读取）。
 *
 *   pnpm dev                      dev 模式（tsx watch / next dev）
 *   pnpm dev --mode=start         start 模式（web / admin 需先 pnpm build）
 *   pnpm dev --tui                改用 turbo TUI 面板（该模式日志不落盘）
 *   pnpm dev --apps=api,worker --no-compose --no-migrate
 *   pnpm dev --no-wait-ready      起完进程即返回（不做就绪探测）
 *   pnpm dev --stop               停掉上次残留进程 + docker compose down
 *
 * 查看日志：`pnpm logs <api|worker|web|admin|docker|all> [-f]`
 * 栈体检：`pnpm verify:stack`（就绪判定 + 报告，供全自动化测试前置）
 *
 * 收敛口径（全自动化测试要的是「尽快失败」，不是「等满超时」）：
 *   - 中间件分档：postgres / redis 是硬依赖，等 healthy（默认 120s）；es / mongo / rustfs 可选，只报状态不阻塞；
 *   - 容器已到终态（exited / dead）立即失败，不等超时；
 *   - 就绪探测期间任一应用进程退出，立即收敛并打印该进程日志指引；
 *   - compose up / db:migrate / compose down 都有超时，卡住不会拖死整条命令。
 *
 * 为何默认不经 turbo（只有 --tui 走）：turbo 的 `dev` 任务 env 白名单仅 6 个键，
 * strict env 模式下会过滤掉 ELASTICSEARCH_URL / STORAGE_MODE / SUPER_ADMIN_EMAIL 等，
 * api / worker 会静默退回 mock。实测记录见 docs/ops/operable-stack.md §6.1。
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { HARD_DEPS, classifyHardDeps, parseComposePs } from './docker-deps.mjs';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COMPOSE_FILE = 'docker/docker-compose.yml';
export const LOG_DIR = path.join(repoRoot, '.data', 'logs');
const RUN_FILE = path.join(repoRoot, '.data', 'run', 'apps.json');
export const STATUS_FILE = path.join(repoRoot, '.data', 'run', 'status.json');
/** stack:down 在杀进程前留的标记：让正在跑的编排进程把这次收尾认作正常。 */
const STOP_FLAG_FILE = path.join(repoRoot, '.data', 'run', 'stopping');
/** 就绪探测上限：next dev 首次编译 + api 引导通常 < 15s，180s 足够并留诊断余地。 */
export const READY_TIMEOUT_MS = 180_000;
/** 硬依赖（postgres / redis）就绪上限。 */
export const DEPS_TIMEOUT_MS = 120_000;
/** compose up 含首次拉镜像，给足；超时只告警，成败交给硬依赖门判。 */
const COMPOSE_UP_TIMEOUT_MS = 600_000;
/** compose up 已非零退出时，硬依赖不值得再等这么久。 */
const DEPS_TIMEOUT_AFTER_UP_FAIL_MS = 20_000;
const COMPOSE_DOWN_TIMEOUT_MS = 120_000;
const MIGRATE_TIMEOUT_MS = 180_000;
/** runWithTimeout 的超时返回码（沿用 GNU timeout 约定）。 */
export const TIMEOUT_EXIT = 124;
export const WORKER_READY_PATTERN = /worker running/;
/**
 * 「启动即崩」的日志标记：这些路径在仓库里都会 `process.exit(1)`（api / worker 的 env 校验、
 * 超管引导、Redis 不可达、模块解析失败），但 `tsx watch` 会把进程留在原地等文件变更，
 * 于是「子进程退出」这条早收敛信号看不到它们，只能靠日志内容认。
 */
export const FATAL_LOG_PATTERNS = [
  /env 校验失败/,
  /superadmin bootstrap failed/,
  /Redis 不可达，worker 退出/,
  /EADDRINUSE/,
  /Cannot find module/,
];
/** 日志出现致命标记后再给 watch 一次重启的机会；超过这个宽限仍未就绪才收敛。 */
export const FATAL_GRACE_MS = 10_000;

/** color 为 ANSI 前景色码，仅用于本窗口前缀。 */
export const APPS = [
  { name: 'api', pkg: '@strict-rag/api', port: 4000, color: 36 },
  { name: 'worker', pkg: '@strict-rag/worker', port: null, color: 35 },
  { name: 'web', pkg: '@strict-rag/web', port: 3005, color: 32 },
  { name: 'admin', pkg: '@strict-rag/admin', port: 3006, color: 33 },
];

export const APP_NAMES = APPS.map((a) => a.name);

export const USAGE = `StrictRAG 本地一键栈

  pnpm dev                     dev 模式起 api / worker / web / admin（默认先 compose + migrate）
  pnpm dev --mode=start        start 模式（web / admin 需先 pnpm build）
  pnpm dev --tui               改用 turbo TUI 面板（该模式日志不落盘）
  pnpm dev --apps=api,web      只起指定应用
  pnpm dev --no-compose        跳过 docker compose
  pnpm dev --no-migrate        跳过 db:migrate
  pnpm dev --no-port-check     跳过端口占用预检
  pnpm dev --no-wait-ready     不等就绪探测（起完进程即返回）
  pnpm dev --ready-timeout=300 就绪探测上限改成 300s（默认 180s；慢机 / CI 冷启动用）
  pnpm dev --stop [--with-volumes]
                               停记录里的进程 + compose down（--with-volumes 连数据卷一起删）

起完会轮询探针，就绪时打印 STACK_READY 并把状态写入 .data/run/status.json；
未就绪则打印 STACK_NOT_READY + 未就绪项，停掉本次进程并以非零码退出。

中间件分档：postgres / redis 是硬依赖，等 healthy（上限 120s）；es / mongo / rustfs 可选，
只报状态不阻塞；容器已 exited / dead 立即失败。任一应用进程在就绪前退出、或日志出现
致命启动错误（env 校验失败 / Redis 不可达 / EADDRINUSE 等）也立即收敛。
compose up / db:migrate / compose down 均有超时（超时返回码 ${TIMEOUT_EXIT}）。

pnpm dev:all 与 pnpm dev 等价；只要 turbo 面板可用 pnpm dev:turbo。
日志落盘 .data/logs/<app>.log；查看：pnpm logs <api|worker|web|admin|all|docker> [-f] [-n 行数]
栈体检（供自动化）：pnpm verify:stack [--json]`;

export function parseArgs(argv) {
  const opts = {
    compose: true,
    migrate: true,
    tui: false,
    mode: 'dev',
    stop: false,
    volumes: false,
    portCheck: true,
    waitReady: true,
    readyTimeoutMs: READY_TIMEOUT_MS,
    apps: APP_NAMES.slice(),
    help: false,
  };
  const errors = [];
  for (const raw of argv) {
    const [flag, value] = raw.split('=');
    switch (flag) {
      case '--no-compose':
        opts.compose = false;
        break;
      case '--no-migrate':
        opts.migrate = false;
        break;
      case '--no-port-check':
        opts.portCheck = false;
        break;
      case '--no-wait-ready':
        opts.waitReady = false;
        break;
      case '--tui':
        opts.tui = true;
        break;
      case '--stop':
        opts.stop = true;
        break;
      case '--with-volumes':
        opts.volumes = true;
        break;
      case '--mode':
        if (value !== 'dev' && value !== 'start') errors.push('--mode 只接受 dev 或 start');
        else opts.mode = value;
        break;
      case '--ready-timeout': {
        const seconds = Number(value);
        if (!Number.isInteger(seconds) || seconds <= 0) {
          errors.push(`--ready-timeout 需要正整数秒，如 --ready-timeout=300（收到：${value}）`);
        } else {
          opts.readyTimeoutMs = seconds * 1000;
        }
        break;
      }
      case '--apps':
        if (!value) errors.push('--apps 需要列表，如 --apps=api,web');
        else {
          const names = value.split(',').map((s) => s.trim()).filter(Boolean);
          const unknown = names.filter((n) => !APP_NAMES.includes(n));
          if (unknown.length) errors.push(`--apps 未知应用：${unknown.join(',')}（可选 ${APP_NAMES.join('/')}）`);
          else opts.apps = names;
        }
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

/** 起全部中间件容器但不等待：随后由 waitForDockerDeps 只对硬依赖把门，可选服务不阻塞启动。 */
export function composeUpArgs() {
  return ['compose', '-f', COMPOSE_FILE, 'up', '-d'];
}

/** 带 --all：默认 `compose ps` 只列运行中的容器，停掉的硬依赖会被看成 missing 而白等到超时。 */
export function composePsArgs() {
  return ['compose', '-f', COMPOSE_FILE, 'ps', '--all', '--format', 'json'];
}

export function composeDownArgs({ volumes = false } = {}) {
  return ['compose', '-f', COMPOSE_FILE, 'down', ...(volumes ? ['-v'] : [])];
}

export function appStartArgs(app, mode) {
  return ['--filter', app.pkg, mode === 'start' ? 'start' : 'dev'];
}

export function turboDevArgs(mode) {
  return ['exec', 'turbo', 'run', mode, '--ui=tui', '--env-mode=loose'];
}

export function logFilePath(name) {
  return path.join(LOG_DIR, `${name}.log`);
}

export function prefixLine(name, line, color) {
  const tag = color ? `\x1b[${color}m[${name}]\x1b[0m` : `[${name}]`;
  return `${tag} ${line}`;
}

/** 落盘去掉 ANSI 转义，免得日志文件里全是颜色码。 */
export function stripAnsi(s) {
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

export function selectApps(names) {
  return APPS.filter((a) => names.includes(a.name));
}

function isPortBusy(port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

// ---------- 就绪探测 ----------

/** api 探 /ready（硬依赖 PG+Redis 由它自己判）；web / admin 探首页，任何 <500 视为可服务。 */
export function readyTargets(apps) {
  return apps.map((app) => {
    if (app.name === 'worker') {
      return { name: 'worker', kind: 'log', pattern: WORKER_READY_PATTERN, detail: '日志出现「worker running」' };
    }
    return {
      name: app.name,
      kind: 'http',
      url: app.name === 'api' ? `http://127.0.0.1:${app.port}/ready` : `http://127.0.0.1:${app.port}/`,
      detail: app.name === 'api' ? 'GET /ready 且 ready=true' : 'GET / 返回 <500',
    };
  });
}

export function isHttpReadyStatus(status) {
  return status > 0 && status < 500;
}

export function isApiReady(body) {
  try {
    return JSON.parse(body)?.ready === true;
  } catch {
    return false;
  }
}

export function statusFilePath() {
  return STATUS_FILE;
}

export function readStatus() {
  try {
    return JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function writeStatus(payload) {
  mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  writeFileSync(STATUS_FILE, `${JSON.stringify(payload, null, 2)}\n`);
}

/** 探针用的 GET；连接失败 / 超时统一成 status=0（verify:stack 复用同一个实现）。 */
export async function httpGet(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    return { status: res.status, body: await res.text() };
  } catch {
    return { status: 0, body: '' };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 日志里第一行命中致命标记的内容（截断到 160 字，供诊断文案用）。 */
export function firstFatalLine(text, patterns = FATAL_LOG_PATTERNS) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && patterns.some((re) => re.test(trimmed))) return trimmed.slice(0, 160);
  }
  return null;
}

/**
 * 轮询直到全部目标就绪、超时、或提前终止（进程退出 / 日志出现致命标记）。
 * 依赖注入（httpGet / readLog / now / shouldAbort）便于测例覆盖。
 * 返回 { ready, readyMs, results: [{ name, ready, detail }], aborted }；
 * aborted 非空表示提前收敛，此时 ready 必为 false。
 */
export async function waitForReady({
  targets,
  logOffsets = {},
  timeoutMs = READY_TIMEOUT_MS,
  intervalMs = 1000,
  probe = httpGet,
  readLog = (file) => readFileSync(file, 'utf8'),
  now = () => Date.now(),
  onProgress = () => {},
  shouldAbort = () => null,
  fatalPatterns = FATAL_LOG_PATTERNS,
  fatalGraceMs = FATAL_GRACE_MS,
  wait = sleep,
}) {
  const started = now();
  const results = targets.map((t) => ({ name: t.name, kind: t.kind, ready: false, detail: '等待探测' }));
  let lastProgressElapsed = 0;
  for (;;) {
    const aborted = shouldAbort();
    if (aborted) return { ready: false, readyMs: now() - started, results, aborted };
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      const result = results[i];
      if (result.ready) continue;
      // 每个应用的本次运行段都读一遍：既供 worker 判就绪，也供致命标记扫描。
      let chunk = '';
      try {
        chunk = readLog(logFilePath(target.name)).slice(logOffsets[target.name] ?? 0);
      } catch {
        chunk = '';
      }
      if (target.kind === 'http') {
        const res = await probe(target.url);
        if (!isHttpReadyStatus(res.status)) {
          result.detail = res.status === 0 ? '连接失败' : `HTTP ${res.status}`;
        } else if (target.name === 'api' && !isApiReady(res.body)) {
          result.detail = `HTTP ${res.status}，但 ready 不为 true`;
        } else {
          result.ready = true;
          result.detail = `HTTP ${res.status}`;
        }
      } else if (target.pattern.test(chunk)) {
        result.ready = true;
        result.detail = '日志已出现就绪行';
      } else {
        result.detail = '等待日志就绪行';
      }
      if (!result.fatalLine) {
        const line = firstFatalLine(chunk, fatalPatterns);
        if (line) {
          result.fatalLine = line;
          result.fatalSeenMs = now() - started;
        }
      }
    }
    const elapsed = now() - started;
    if (results.every((r) => r.ready)) return { ready: true, readyMs: elapsed, results, aborted: null };
    // 就绪判定优先于收敛判定：日志有致命行但已经服务起来（watch 重启成功）就不算失败。
    const fatal = results.find(
      (r) => r.fatalLine && elapsed - r.fatalSeenMs >= fatalGraceMs,
    );
    if (fatal) {
      return {
        ready: false,
        readyMs: elapsed,
        results,
        aborted: { name: fatal.name, reason: `日志出现致命错误：${fatal.fatalLine}` },
      };
    }
    if (elapsed >= timeoutMs) return { ready: false, readyMs: elapsed, results, aborted: null };
    if (elapsed - lastProgressElapsed >= 5000) {
      lastProgressElapsed = elapsed;
      onProgress(results.filter((r) => !r.ready));
    }
    await wait(intervalMs);
  }
}

// ---------- 中间件硬依赖门 ----------

/** 读 `docker compose ps --all --format json`；命令失败返回 null（区别于「没有容器」）。 */
function readComposeRows() {
  const res = spawnSync('docker', composePsArgs(), {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) return null;
  return parseComposePs(res.stdout ?? '');
}

/**
 * 只对硬依赖（postgres / redis）把门：healthy 即放行，容器到终态失败立即返回，
 * 超时返回各服务当前状态。可选服务状态一并带回，供编排层提示。
 */
export async function waitForDockerDeps({
  timeoutMs = DEPS_TIMEOUT_MS,
  intervalMs = 2000,
  hard = HARD_DEPS,
  ps = readComposeRows,
  wait = sleep,
  now = () => Date.now(),
  onProgress = () => {},
} = {}) {
  const started = now();
  let lastProgressElapsed = -5000;
  for (;;) {
    const rows = ps();
    if (rows === null) {
      return {
        ok: false,
        kind: 'unavailable',
        failed: [],
        pending: [],
        optionalDown: [],
        detail: 'docker compose ps 失败（Docker 未运行或 compose 文件不可读）',
        elapsedMs: now() - started,
      };
    }
    const verdict = classifyHardDeps(rows, { hard });
    const elapsed = now() - started;
    if (verdict.failed.length) return { ...verdict, ok: false, kind: 'failed', elapsedMs: elapsed };
    if (verdict.ok) return { ...verdict, kind: 'ready', elapsedMs: elapsed };
    if (elapsed >= timeoutMs) return { ...verdict, ok: false, kind: 'timeout', elapsedMs: elapsed };
    if (elapsed - lastProgressElapsed >= 5000) {
      lastProgressElapsed = elapsed;
      onProgress(verdict);
    }
    await wait(intervalMs);
  }
}

/** docker 守护进程是否可用（compose 前置预检）。 */
export function dockerAvailable() {
  const res = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return res.status === 0;
}

// ---------- 本仓应用进程识别（含残留清扫） ----------

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Windows：`Get-CimInstance Win32_Process | Select ProcessId, CommandLine | ConvertTo-Json` 的输出。
 * 走 JSON 是为了让命令行里的引号 / 空格由序列化负责转义，不再靠 ForEach 拼字符串。
 */
export function parseWindowsProcesses(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return parsePosixProcesses(stdout);
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .map((row) => ({ pid: Number(row?.ProcessId), command: String(row?.CommandLine ?? '') }))
    .filter((row) => Number.isInteger(row.pid) && row.pid > 0);
}

/** POSIX：`ps -eo pid,args` 输出。 */
export function parsePosixProcesses(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), command: m[2] }));
}

/**
 * 只认命令行确实指向 `<root>/apps/<app>` 的行（严格的仓库路径判据）。
 * 兜底清扫按这条杀进程，所以这里必须严：宁可漏杀，不可误杀。
 */
export function pickRepoAppProcesses(rows, root = repoRoot) {
  const normalizedRoot = String(root).replaceAll('\\', '/').toLowerCase();
  const picked = [];
  for (const row of rows) {
    const command = String(row?.command ?? '').replaceAll('\\', '/');
    if (!command.toLowerCase().includes(normalizedRoot)) continue;
    const matched = command.match(/\/apps\/(api|worker|web|admin)\b/);
    if (matched) picked.push({ pid: row.pid, app: matched[1], command: row.command });
  }
  return picked;
}

/**
 * 这个 pid 像不像我们为 `app` 起的进程？杀记录里的 pid 前用它核对身份（pid 会被系统复用）。
 * 两种合法形态：直接指向 `<root>/apps/<app>` 的子进程，或 `pnpm --filter @strict-rag/<app>` 包装层。
 */
export function pidLooksLikeApp(row, app, root = repoRoot) {
  if (!row) return false;
  const command = String(row.command ?? '').replaceAll('\\', '/');
  const normalizedRoot = String(root).replaceAll('\\', '/').toLowerCase();
  if (command.toLowerCase().includes(normalizedRoot) && new RegExp(`/apps/${app}\\b`).test(command)) {
    return true;
  }
  return new RegExp(`@strict-rag/${app}(?![\\w-])`).test(command);
}

/**
 * 候选进程清单：命令行命中「本仓路径」或「@strict-rag 包名」。
 * pnpm 包装层（`cmd.exe /d /s /c "pnpm --filter @strict-rag/web start"`）不含仓库路径，
 * 只能靠包名进候选，再由 pidLooksLikeApp 决定能不能杀。
 */
export function readAppProcessCandidates() {
  if (process.platform === 'win32') {
    // 单行脚本：分号只出现在语句之间；路径做正则转义后放进单引号，避免命令行解析走样。
    const pattern = `(${escapeRegExp(repoRoot)}|@strict-rag/)`;
    const script =
      'Get-CimInstance Win32_Process | ' +
      `Where-Object { $_.CommandLine -match '${pattern.replaceAll("'", "''")}' } | ` +
      'Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress -Depth 3';
    const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
    });
    if (res.status !== 0) {
      console.warn(
        `[dev:all] WARN: 进程查询失败（powershell exit ${res.status}）：${(res.stderr || '').trim().split('\n')[0]}`,
      );
      return [];
    }
    return parseWindowsProcesses(res.stdout);
  }
  const res = spawnSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8' });
  if (res.status !== 0) return [];
  return parsePosixProcesses(res.stdout).filter(
    (row) => row.command.includes(repoRoot) || row.command.includes('@strict-rag/'),
  );
}

/**
 * 本仓应用进程清单（严格判据，供兜底清扫用）。编排进程被硬杀（关终端窗口）时，
 * pnpm 包装层先死，`tsx watch` / `next dev` 成孤儿，按记录的 pid 做树杀沿不到它们；
 * 这里按命令行特征兜底，连不占端口的 supervisor 一起找出来。
 */
export function readRepoAppProcesses(candidates = readAppProcessCandidates()) {
  return pickRepoAppProcesses(candidates);
}

/** 收尾兜底：把命令行指向本仓应用、却没被记录 pid 收掉的残留（孤儿 supervisor / 子进程）清掉。 */
async function sweepStaleApps(knownPids = [], candidates = readAppProcessCandidates()) {
  const stale = pickRepoAppProcesses(candidates).filter((p) => !knownPids.includes(p.pid));
  if (!stale.length) return;
  console.log(`[dev:all] 兜底清扫本仓应用残留进程：${stale.map((p) => `${p.app}#${p.pid}`).join(', ')}`);
  for (const p of stale) killPidTree(p.pid);
  await sleep(1000);
  const after = readAppProcessCandidates();
  const left = pickRepoAppProcesses(after).filter((p) => !knownPids.includes(p.pid));
  if (left.length) {
    console.warn(
      `[dev:all] WARN: 仍有残留 ${left.map((p) => `${p.app}#${p.pid}`).join(', ')}；手动收尾：taskkill /PID <pid> /T /F`,
    );
  } else {
    console.log('[dev:all] 残留已清理');
  }
}

function spawnInherit(cmd, args, extra = {}) {
  return spawn(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...extra,
  });
}

function waitChildCode(child) {
  return new Promise((resolve) => {
    // 已退出（可能在注册前就结束）时直接给码，避免 once 永久挂住。
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(child.exitCode ?? (child.signalCode ? 1 : 0));
      return;
    }
    child.once('error', () => resolve(1));
    // 用 close：stdio 已结束，readline 的行也已派发完，可安全汇总退出码。
    child.once('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

/** Windows 无进程组信号，用 taskkill /T 连子孙一起收。 */
export function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

function killPidTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* 已退出 */
    }
  }
}

/**
 * 收掉记录里的应用进程前先核对身份：pid 会被系统复用，
 * 只按 pid 杀可能误伤无关进程。核对不上就跳过并说明，交给兜底清扫处理。
 */
function killRecordedAppProcesses(apps = [], candidates = readAppProcessCandidates()) {
  const byPid = new Map(candidates.map((row) => [row.pid, row]));
  const skipped = [];
  let killed = 0;
  for (const app of apps) {
    const row = byPid.get(app.pid);
    if (!row) {
      skipped.push(`${app.name}#${app.pid}（进程已不存在）`);
      continue;
    }
    if (!pidLooksLikeApp(row, app.name)) {
      skipped.push(`${app.name}#${app.pid}（命令行不像本仓该应用，疑为 pid 复用）`);
      continue;
    }
    killPidTree(app.pid);
    killed += 1;
  }
  return { killed, skipped };
}

/** 起子进程并等待；超时按树杀并返回 TIMEOUT_EXIT，避免卡住的命令拖死整条链路。 */
async function runWithTimeout(cmd, args, timeoutMs) {
  const child = spawnInherit(cmd, args);
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      killTree(child);
      resolve(TIMEOUT_EXIT);
    }, timeoutMs);
  });
  try {
    return await Promise.race([waitChildCode(child), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function readRunFile() {
  try {
    return JSON.parse(readFileSync(RUN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 已有栈在跑吗？只看「记录在案 + 编排进程还活着 + 没被标记停止」。
 * 命中就早退，免得两个编排进程抢同一批端口后给出误导性的报错。
 */
export function detectRunningStack(status, isAlive = isPidAlive) {
  if (!status || status.stoppedAt || !status.orchestratorPid) return null;
  if (!isAlive(status.orchestratorPid)) return null;
  return {
    pid: status.orchestratorPid,
    startedAt: status.startedAt,
    ready: status.ready,
    apps: (status.apps ?? []).map((app) => app.name),
  };
}

/** start 模式预检：web / admin 必须先构建过（缺 `apps/<app>/.next` 时 next start 必失败）。 */
export function missingStartBuilds(apps, { root = repoRoot, exists = existsSync } = {}) {
  return apps
    .filter((app) => ['web', 'admin'].includes(app.name) && !exists(path.join(root, 'apps', app.name, '.next')))
    .map((app) => app.name);
}

/** 记下收尾时间，供 verify:stack 判断"这份状态是已停的旧记录"。 */
function markStatusStopped() {
  const cur = readStatus();
  if (cur && !cur.stoppedAt) writeStatus({ ...cur, stoppedAt: new Date().toISOString() });
}

/** 子进程收尾标签：被外部 stack:down 收掉时不算「异常退出」。 */
export function exitLabel({ code = null, signal = null, stoppedByOther = false }) {
  if (stoppedByOther) return '已停（外部收尾）';
  return code === 0 && !signal ? '已退出' : '异常退出';
}

/** 汇总失败项：用户 Ctrl-C 与外部 stack:down 都不算失败。 */
export function nonzeroExits(children, { stopping = false, stoppedByOther = false } = {}) {
  if (stopping || stoppedByOther) return [];
  return children.filter((c) => c.exit !== 0).map((c) => `${c.app.name}=${c.exit}`);
}

async function stopStack(opts) {
  const record = readRunFile();
  // 身份核对与兜底清扫共用一次进程查询，避免同一次收尾反复起 powershell。
  const candidates = readAppProcessCandidates();
  mkdirSync(path.dirname(STOP_FLAG_FILE), { recursive: true });
  writeFileSync(STOP_FLAG_FILE, `${JSON.stringify({ at: new Date().toISOString(), by: process.pid })}\n`);
  try {
    if (record?.apps?.length) {
      console.log(`[dev:all] 停止上次记录的应用进程：${record.apps.map((a) => a.name).join(', ')}`);
      const { killed, skipped } = killRecordedAppProcesses(record.apps, candidates);
      console.log(`[dev:all] 已停 ${killed} 个${skipped.length ? `，跳过 ${skipped.join(' · ')}` : ''}`);
    } else {
      console.log('[dev:all] 没有找到 .data/run/apps.json，跳过应用进程');
    }
    rmSync(RUN_FILE, { force: true });
    if (opts.compose) {
      console.log(`[dev:all] docker ${composeDownArgs(opts).join(' ')}`);
      const code = await runWithTimeout('docker', composeDownArgs(opts), COMPOSE_DOWN_TIMEOUT_MS);
      if (code === TIMEOUT_EXIT) {
        console.error(`FAIL: docker compose down 超过 ${COMPOSE_DOWN_TIMEOUT_MS / 1000}s，已终止；用 docker compose ps 自查`);
        return 1;
      }
      if (code !== 0) {
        console.error('FAIL: docker compose down 非零退出');
        return 1;
      }
    }
    // 没有编排进程在场时（终端被硬关等），状态也要落到「已停」。
    markStatusStopped();
    await sweepStaleApps(record?.apps?.map((a) => a.pid) ?? [], candidates);
    // 标记必须活到编排进程读到为止：等它退出，不靠固定 sleep。
    await waitOrchestratorGone(record?.pid);
    console.log('[dev:all] 已停止（数据卷默认保留；要删卷加 --with-volumes）');
    return 0;
  } finally {
    rmSync(STOP_FLAG_FILE, { force: true });
  }
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 编排进程读到停栈标记后会自己收尾，这里等它退出再删除标记。 */
async function waitOrchestratorGone(orchestratorPid, timeoutMs = 5000, intervalMs = 200) {
  if (!isPidAlive(orchestratorPid)) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(orchestratorPid)) return;
    await sleep(intervalMs);
  }
}

function colorize() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function createAppLogger(app) {
  mkdirSync(LOG_DIR, { recursive: true });
  const file = logFilePath(app.name);
  // 本次运行在日志里的起始偏移，供 worker 就绪探测只看新增内容。
  let startOffset = 0;
  try {
    startOffset = statSync(file).size;
  } catch {
    startOffset = 0;
  }
  const stream = createWriteStream(file, { flags: 'a' });
  stream.write(`\n===== ${app.name} (${app.pkg}) ${new Date().toISOString()} =====\n`);
  const useColor = colorize();
  let closed = false;
  const write = (line) => {
    process.stdout.write(`${prefixLine(app.name, line, useColor ? app.color : null)}\n`);
    if (!closed) stream.write(`${stripAnsi(line)}\n`);
  };
  return {
    file,
    startOffset,
    write,
    /** 只进文件的边界标记，不打控制台。 */
    mark: (line) => {
      if (!closed) stream.write(`${line}\n`);
    },
    close: () => {
      closed = true;
      stream.end();
    },
  };
}

async function main() {
  // 收尾阶段终端可能已关闭，写 stdout 的 EPIPE 不该让编排脚本崩掉。
  process.stdout.on('error', () => {});
  const { opts, errors } = parseArgs(process.argv.slice(2));
  // --help 优先于参数校验：用法本身能答的疑问，不必先看报错。
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    console.error('     用法：pnpm dev --help');
    return 1;
  }
  if (opts.stop) return stopStack(opts);

  const apps = selectApps(opts.apps);

  if (opts.mode === 'start') {
    const notBuilt = missingStartBuilds(apps);
    if (notBuilt.length) {
      console.error(`FAIL: start 模式需要先构建：缺 ${notBuilt.map((name) => `apps/${name}/.next`).join('、')}`);
      console.error('     先 pnpm build，或改回 dev 模式（pnpm dev）');
      return 1;
    }
  }

  if (opts.portCheck) {
    const running = detectRunningStack(readStatus());
    if (running) {
      console.error(
        `FAIL: 已有栈在跑（pid ${running.pid}，起于 ${running.startedAt}，${running.apps.join('/')}）`,
      );
      console.error('     看日志：pnpm logs api -f；要重起先收尾：pnpm stack:down');
      return 1;
    }
    const busy = [];
    for (const app of apps) {
      if (app.port && (await isPortBusy(app.port))) busy.push(`${app.name} (${app.port})`);
    }
    if (busy.length) {
      console.error(`FAIL: 端口已被占用：${busy.join(' · ')}`);
      console.error('     先收尾残留：pnpm stack:down；或换端口后重试');
      return 1;
    }
  }

  if (opts.compose) {
    if (!dockerAvailable()) {
      console.error('FAIL: Docker 未运行（docker info 失败）');
      console.error('     启动 Docker Desktop 后重试；或加 --no-compose 只起应用进程');
      return 1;
    }
    if (!existsSync(path.join(repoRoot, '.env'))) {
      console.warn('[dev:all] WARN: 未找到 .env，api / worker 会按内置默认（mock + local）启动');
      console.warn('[dev:all]       可运行栈：cp .env.example .env，再按 docs/ops/operable-stack.md §2 追加');
    }
    console.log(`[dev:all] docker ${composeUpArgs().join(' ')}（起容器；随后只等硬依赖 ${HARD_DEPS.join(' / ')} healthy）`);
    const upCode = await runWithTimeout('docker', composeUpArgs(), COMPOSE_UP_TIMEOUT_MS);
    if (upCode === TIMEOUT_EXIT) {
      console.warn(`[dev:all] WARN: docker compose up 超过 ${COMPOSE_UP_TIMEOUT_MS / 1000}s 已终止，按实际容器状态判定`);
    } else if (upCode !== 0) {
      console.warn('[dev:all] WARN: docker compose up 非零退出，按实际容器状态判定');
      console.warn('[dev:all]       看容器：docker compose -f docker/docker-compose.yml ps');
    }
    const deps = await waitForDockerDeps({
      // up 已失败时硬依赖不值得再等 120s：只留一点余量让容器状态稳定。
      timeoutMs: upCode === 0 ? DEPS_TIMEOUT_MS : DEPS_TIMEOUT_AFTER_UP_FAIL_MS,
      onProgress: (v) => process.stdout.write(`${prefixLine('dev:all', `等待中间件：${v.detail || '就绪中'}`, null)}\n`),
    });
    if (!deps.ok) {
      console.error(`FAIL: 中间件硬依赖未就绪（${deps.detail || deps.kind}）`);
      console.error(`     看容器日志：pnpm logs docker <${HARD_DEPS.join('|')}>；端口冲突或镜像问题先修 compose`);
      return 1;
    }
    console.log(
      `[dev:all] 中间件硬依赖就绪：${HARD_DEPS.join(' / ')} healthy（${(deps.elapsedMs / 1000).toFixed(1)}s）`,
    );
    if (deps.optionalDown.length) {
      console.warn(`[dev:all] WARN: 可选服务未就绪：${deps.optionalDown.join(', ')}（mock 路径不受影响；真跑需 healthy）`);
    }
  } else {
    console.log('[dev:all] 跳过 docker compose（--no-compose）');
  }

  if (opts.migrate) {
    console.log('[dev:all] pnpm db:migrate');
    const code = await runWithTimeout('pnpm', ['db:migrate'], MIGRATE_TIMEOUT_MS);
    if (code === TIMEOUT_EXIT) {
      console.error(`FAIL: 数据库迁移超过 ${MIGRATE_TIMEOUT_MS / 1000}s，已终止；先确认 postgres 已 healthy：pnpm logs docker postgres`);
      return 1;
    }
    if (code !== 0) {
      console.error('FAIL: 数据库迁移失败，先确认 postgres 已 healthy：pnpm logs docker postgres');
      return 1;
    }
  } else {
    console.log('[dev:all] 跳过迁移（--no-migrate）');
  }

  if (opts.tui) {
    console.log(`[dev:all] turbo TUI：${turboDevArgs(opts.mode).join(' ')}（此模式日志不落盘，用 --tui 之外的默认模式可查文件）`);
    const child = spawnInherit('pnpm', turboDevArgs(opts.mode));
    const forward = () => killTree(child);
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    return waitChildCode(child);
  }

  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(path.dirname(RUN_FILE), { recursive: true });
  const startAt = new Date().toISOString();
  const children = [];
  let shuttingDown = false;
  for (const app of apps) {
    const logger = createAppLogger(app);
    const child = spawn('pnpm', appStartArgs(app, opts.mode), {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    });
    const entry = { app, child, logger, exit: null };
    children.push(entry);
    for (const src of [child.stdout, child.stderr]) {
      readline.createInterface({ input: src, crlfDelay: Infinity }).on('line', (line) => logger.write(line));
    }
    child.once('error', (err) => {
      logger.write(`FAIL: 无法启动进程：${err instanceof Error ? err.message : String(err)}`);
    });
    // 用 close 而非 exit：等 stdio 流全部结束，避免最后几行写进已关闭的文件流。
    child.once('close', (code, signal) => {
      entry.exit = code ?? (signal ? 1 : 0);
      const stoppedByOther = existsSync(STOP_FLAG_FILE);
      const tag = exitLabel({ code, signal, stoppedByOther });
      const color = colorize() ? app.color : null;
      process.stdout.write(`${prefixLine(app.name, `${tag} code=${code ?? signal}`, color)}\n`);
      logger.mark(`----- ${tag} code=${code ?? signal} -----`);
      logger.close();
      if (shuttingDown) return;
      if (children.every((c) => c.exit !== null)) {
        process.stdout.write(`${prefixLine('dev:all', '所有进程已退出，收尾', null)}\n`);
      } else if (!existsSync(STOP_FLAG_FILE)) {
        process.stdout.write(
          `${prefixLine(app.name, `其余进程仍在运行；Ctrl-C 收尾，或另开窗口 pnpm logs ${app.name} -f`, color)}\n`,
        );
      }
    });
    console.log(`${prefixLine(app.name, `${opts.mode} 启动中 → ${logger.file}`, colorize() ? app.color : null)}`);
  }

  writeFileSync(
    RUN_FILE,
    `${JSON.stringify({ pid: process.pid, startedAt: startAt, mode: opts.mode, apps: children.map((c) => ({ name: c.app.name, pid: c.child.pid })) }, null, 2)}\n`,
  );
  const startedLine = apps
    .map((a) => (a.port ? `${a.name} http://127.0.0.1:${a.port}` : `${a.name}（无 HTTP）`))
    .join(' · ');
  console.log(`[dev:all] 已起 ${apps.length} 个进程（${opts.mode}）：${startedLine}`);
  console.log('[dev:all] 看单个程序日志：pnpm logs api -f（worker / web / admin 同理）；docker 日志：pnpm logs docker');

  const statusBase = {
    schemaVersion: 1,
    startedAt: startAt,
    mode: opts.mode,
    orchestratorPid: process.pid,
    apps: children.map((c) => ({
      name: c.app.name,
      pid: c.child.pid,
      port: c.app.port,
      logFile: path.relative(repoRoot, c.logger.file).split(path.sep).join('/'),
      startOffset: c.logger.startOffset,
    })),
  };

  if (opts.waitReady) {
    const targets = readyTargets(apps);
    console.log(
      `[dev:all] 等待就绪（上限 ${Math.round(opts.readyTimeoutMs / 1000)}s）：${targets.map((t) => t.name).join(' / ')}`,
    );
    const outcome = await waitForReady({
      targets,
      timeoutMs: opts.readyTimeoutMs,
      logOffsets: Object.fromEntries(children.map((c) => [c.app.name, c.logger.startOffset])),
      onProgress: (pending) => {
        const detail = pending.map((p) => `${p.name}(${p.detail})`).join(' · ');
        process.stdout.write(`${prefixLine('dev:all', `等待中：${detail}`, null)}\n`);
      },
      // 两条早收敛信号：进程退出（web / admin 这类会真退出的）与日志致命标记（tsx watch 会把进程留住）。
      shouldAbort: () => {
        const dead = children.find((c) => c.exit !== null);
        return dead ? { name: dead.app.name, reason: `进程已退出（exit=${dead.exit}）` } : null;
      },
    });
    const byName = new Map(outcome.results.map((r) => [r.name, r]));
    writeStatus({
      ...statusBase,
      ready: outcome.ready,
      readyAt: outcome.ready ? new Date().toISOString() : null,
      readyMs: outcome.readyMs,
      aborted: outcome.aborted ?? null,
      apps: statusBase.apps.map((a) => ({
        ...a,
        ready: byName.get(a.name)?.ready ?? false,
        detail: byName.get(a.name)?.detail ?? '',
      })),
      pending: outcome.results.filter((r) => !r.ready).map((r) => r.name),
    });
    if (outcome.ready) {
      const line = apps
        .map((a) => (a.port ? `${a.name}=http://127.0.0.1:${a.port}` : `${a.name}=ok`))
        .join(' ');
      process.stdout.write(
        `\n${prefixLine('dev:all', `STACK_READY (${(outcome.readyMs / 1000).toFixed(1)}s) ${line}`, null)}\n`,
      );
      process.stdout.write(
        `${prefixLine('dev:all', '状态已写 .data/run/status.json；体检：pnpm verify:stack', null)}\n\n`,
      );
    } else {
      process.stdout.write(
        `\n${prefixLine('dev:all', `STACK_NOT_READY (${(outcome.readyMs / 1000).toFixed(1)}s)`, null)}\n`,
      );
      if (outcome.aborted) {
        process.stdout.write(
          `${prefixLine('dev:all', `提前收敛：${outcome.aborted.name} ${outcome.aborted.reason} → pnpm logs ${outcome.aborted.name} -n 40`, null)}\n`,
        );
      }
      for (const r of outcome.results.filter((r) => !r.ready)) {
        process.stdout.write(`${prefixLine('dev:all', `未就绪 ${r.name}：${r.detail} → pnpm logs ${r.name} -n 40`, null)}\n`);
      }
      // 半死的栈留着只会误导后续步骤；日志已落盘，这里停掉并以非零码退出。
      shuttingDown = true;
      for (const c of children) killTree(c.child);
      await Promise.all(children.map((c) => waitChildCode(c.child)));
      markStatusStopped();
      rmSync(RUN_FILE, { force: true });
      return 1;
    }
  } else {
    writeStatus({
      ...statusBase,
      ready: null,
      readyAt: null,
      readyMs: null,
      aborted: null,
      apps: statusBase.apps.map((a) => ({ ...a, ready: null, detail: '未探测（--no-wait-ready）' })),
      pending: [],
    });
    console.log('[dev:all] 跳过就绪探测（--no-wait-ready），状态已写 .data/run/status.json');
  }

  const shutdown = (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`\n[dev:all] 收到 ${reason}，停止 ${children.length} 个进程…\n`);
    for (const c of children) killTree(c.child);
    setTimeout(() => {
      markStatusStopped();
      rmSync(RUN_FILE, { force: true });
      process.exit(0);
    }, 1500).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await Promise.all(children.map((c) => waitChildCode(c.child)));
  markStatusStopped();
  await sweepStaleApps(children.map((c) => c.child.pid));
  rmSync(RUN_FILE, { force: true });
  // 用户主动 Ctrl-C 与外部 stack:down 收尾都不算失败。
  const stoppedByOther = existsSync(STOP_FLAG_FILE);
  if (stoppedByOther) {
    process.stdout.write(`${prefixLine('dev:all', '识别到外部停栈（pnpm stack:down），按正常收尾处理', null)}\n`);
  }
  rmSync(STOP_FLAG_FILE, { force: true });
  const failed = nonzeroExits(children, { stopping: shuttingDown, stoppedByOther });
  if (failed.length) {
    console.error(`FAIL: 退出的进程非零：${failed.join(' ')}`);
    return 1;
  }
  return 0;
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
