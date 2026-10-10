#!/usr/bin/env node
/**
 * 查看本地栈日志：应用日志来自 `pnpm dev` 落盘的 .data/logs/<app>.log，
 * docker 日志直接透传 `docker compose logs`。
 *
 *   pnpm logs                    列出可用日志（含大小 / 最后写入时间）
 *   pnpm logs api                末尾 100 行
 *   pnpm logs api -n 500        末尾 500 行
 *   pnpm logs api -f            跟随（等价 tail -f）
 *   pnpm logs all               四个应用各末尾 N 行
 *   pnpm logs docker            compose 全部服务
 *   pnpm logs docker postgres   指定服务
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_NAMES, COMPOSE_FILE, LOG_DIR, logFilePath, repoRoot } from './dev-all.mjs';
import { COMPOSE_SERVICES } from './docker-deps.mjs';

/** 只读末尾这么多字节，避免动辄把整个日志读进内存。 */
const TAIL_BYTES = 2 * 1024 * 1024;

export function parseArgs(argv) {
  const opts = { target: null, service: null, follow: false, lines: 100, list: false, help: false };
  const errors = [];
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    const [flag, inline] = raw.split('=');
    switch (flag) {
      case '-f':
      case '--follow':
        opts.follow = true;
        break;
      case '-n':
      case '--lines': {
        const value = inline ?? argv[(i += 1)];
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) errors.push(`--lines 需要正整数，收到：${value}`);
        else opts.lines = n;
        break;
      }
      case '-l':
      case '--list':
        opts.list = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        if (raw.startsWith('-')) errors.push(`未知参数：${raw}`);
        else positional.push(raw);
    }
  }
  if (positional.length > 2) errors.push(`最多两个位置参数（目标 + docker 服务），收到：${positional.join(' ')}`);
  if (positional[0]) opts.target = positional[0];
  if (positional[1]) opts.service = positional[1];
  return { opts, errors };
}

export function resolveTarget(target) {
  if (!target || target === 'list') return { kind: 'list' };
  if (target === 'all') return { kind: 'all' };
  if (target === 'docker' || target === 'compose') return { kind: 'docker' };
  if (APP_NAMES.includes(target)) return { kind: 'app', app: target };
  if (COMPOSE_SERVICES.includes(target)) return { kind: 'docker', service: target };
  return { kind: 'unknown', target };
}

/** 读文件末尾 maxBytes 字节并切成行；返回最后 lines 行。 */
export function tailLines(file, lines, maxBytes = TAIL_BYTES) {
  const size = statSync(file).size;
  const start = Math.max(0, size - maxBytes);
  const length = size - start;
  if (length <= 0) return [];
  const buffer = Buffer.alloc(length);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buffer, 0, length, start);
  } finally {
    closeSync(fd);
  }
  const text = buffer.toString('utf8');
  let body = text;
  if (start > 0) {
    // 截断起点可能落在半行 / 半个 UTF-8 字符上，丢掉首个残行。
    const nl = text.indexOf('\n');
    if (nl === -1) return [];
    body = text.slice(nl + 1);
  }
  const rows = body.split(/\r?\n/);
  while (rows.length && rows[rows.length - 1] === '') rows.pop();
  return rows.slice(-lines);
}

function listLogs() {
  if (!existsSync(LOG_DIR)) {
    console.log(`还没有日志目录 ${path.relative(repoRoot, LOG_DIR)}（先跑 pnpm dev）`);
    return 0;
  }
  const files = readdirSync(LOG_DIR).filter((f) => f.endsWith('.log'));
  if (!files.length) {
    console.log(`还没有应用日志（先跑 pnpm dev）；日志目录：${path.relative(repoRoot, LOG_DIR)}`);
    return 0;
  }
  console.log(`应用日志（${path.relative(repoRoot, LOG_DIR)}）：`);
  for (const f of files.sort()) {
    const st = statSync(path.join(LOG_DIR, f));
    const kb = (st.size / 1024).toFixed(1);
    console.log(`  ${f.padEnd(16)} ${kb.padStart(9)} KB   最后写入 ${st.mtime.toISOString()}`);
  }
  console.log(`\n用法：pnpm logs <${APP_NAMES.join('|')}|all|docker> [-n 行数] [-f]`);
  console.log(`      pnpm logs docker <${COMPOSE_SERVICES.join('|')}>`);
  return 0;
}

function printFileBlock(name, file, lines) {
  console.log(`\n===== ${name} · ${path.relative(repoRoot, file)} =====`);
  if (!existsSync(file)) {
    console.log(`（无日志文件；该程序本次没由 pnpm dev 起过）`);
    return;
  }
  const rows = tailLines(file, lines);
  console.log(rows.length ? rows.join('\n') : '（空）');
}

function followFile(name, file) {
  let offset = existsSync(file) ? statSync(file).size : 0;
  if (!existsSync(file)) console.log(`（等待 ${file} 出现；若程序未启动则不会创建）`);
  console.log(`[logs] 跟随 ${path.relative(repoRoot, file)}（Ctrl-C 退出）`);
  const timer = setInterval(() => {
    if (!existsSync(file)) return;
    const size = statSync(file).size;
    if (size < offset) offset = 0; // 日志被截断/轮转
    if (size === offset) return;
    const length = size - offset;
    const buffer = Buffer.alloc(length);
    const fd = openSync(file, 'r');
    try {
      readSync(fd, buffer, 0, length, offset);
    } finally {
      closeSync(fd);
    }
    offset = size;
    process.stdout.write(buffer.toString('utf8'));
  }, 300);
  process.on('SIGINT', () => {
    clearInterval(timer);
    process.exit(0);
  });
}

function runDocker({ service, follow, lines }) {
  const args = ['compose', '-f', COMPOSE_FILE, 'logs', `--tail=${lines}`, ...(follow ? ['-f'] : [])];
  if (service) args.push(service);
  const child = spawn('docker', args, { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  return new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
}

async function main() {
  process.stdout.on('error', () => {});
  const { opts, errors } = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('用法：pnpm logs [app|all|docker] [docker 服务] [-n 行数] [-f]；不加参数列出可用日志');
    return 0;
  }
  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    console.error('     用法：pnpm logs --help');
    return 1;
  }
  if (opts.service && opts.target !== 'docker' && opts.target !== 'compose') {
    console.error('FAIL: 第二个位置参数只在目标为 docker 时使用，如 pnpm logs docker postgres');
    return 1;
  }
  const resolved = resolveTarget(opts.target);
  switch (resolved.kind) {
    case 'list':
      return listLogs();
    case 'unknown':
      console.error(`FAIL: 未知目标 ${resolved.target}（可选 ${APP_NAMES.join('/')}/all/docker/${COMPOSE_SERVICES.join('/')}）`);
      return 1;
    case 'docker':
      return runDocker({ service: opts.service ?? null, follow: opts.follow, lines: opts.lines });
    case 'all':
      if (opts.follow) {
        console.log('[logs] all 是静态合并输出，不支持 -f；要实时跟随请用 pnpm logs <api|worker|web|admin> -f');
      }
      for (const name of APP_NAMES) printFileBlock(name, logFilePath(name), opts.lines);
      console.log('\n要实时跟随单个程序：pnpm logs api -f');
      return 0;
    case 'app': {
      const file = logFilePath(resolved.app);
      if (opts.follow) {
        printFileBlock(resolved.app, file, opts.lines);
        followFile(resolved.app, file);
        return new Promise(() => {});
      }
      printFileBlock(resolved.app, file, opts.lines);
      return 0;
    }
    default:
      return 1;
  }
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
