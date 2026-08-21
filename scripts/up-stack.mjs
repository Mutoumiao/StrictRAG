#!/usr/bin/env node
/**
 * HALF-UP：一键 docker compose（中间件）+ api + worker。
 * 第三人不必手拼四进程。不改 Zod 默认 mock。
 *
 *   pnpm up:apps
 *   node scripts/up-stack.mjs --compose-only
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function composeArgs() {
  return ['compose', '-f', 'docker/docker-compose.yml', 'up', '-d'];
}

export function appFilters() {
  return ['@strict-rag/api', '@strict-rag/worker'];
}

export function pnpmStartArgs(filter) {
  return ['--filter', filter, 'start'];
}

/** AC3：任一子进程非零即视为拉起失败。 */
export function stackFailed(codes) {
  return codes.some((code) => code !== 0);
}

function waitChild(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(0);
      else reject(new Error(`exit ${code ?? signal}`));
    });
  });
}

function waitChildCode(child) {
  return new Promise((resolve) => {
    child.once('error', () => resolve(1));
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

function spawnInherit(cmd, args, extra = {}) {
  return spawn(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...extra,
  });
}

async function main() {
  const composeOnly = process.argv.includes('--compose-only');
  console.log('HALF-UP compose', composeArgs().join(' '));
  const compose = spawnInherit('docker', composeArgs());
  try {
    await waitChild(compose);
  } catch (err) {
    console.error('FAIL: docker compose:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
  if (composeOnly) {
    console.log(
      'PASS: compose up -d. Next: pnpm db:migrate && pnpm up:apps (without --compose-only)',
    );
    return;
  }
  const children = appFilters().map((filter) => {
    console.log(`HALF-UP start ${filter}`);
    return spawnInherit('pnpm', pnpmStartArgs(filter));
  });
  const shutdown = () => {
    for (const c of children) c.kill('SIGTERM');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  const codes = await Promise.all(
    children.map(async (c) => {
      const code = await waitChildCode(c);
      shutdown();
      return code;
    }),
  );
  if (stackFailed(codes)) {
    console.error('FAIL: api/worker exited non-zero:', codes.join(','));
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('FAIL:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
