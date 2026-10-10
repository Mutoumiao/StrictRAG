import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseArgs, resolveTarget, tailLines } from './logs.mjs';

test('resolveTarget 覆盖应用 / all / docker / 服务名 / 未知', () => {
  assert.deepEqual(resolveTarget(undefined), { kind: 'list' });
  assert.deepEqual(resolveTarget('all'), { kind: 'all' });
  assert.deepEqual(resolveTarget('docker'), { kind: 'docker' });
  assert.deepEqual(resolveTarget('compose'), { kind: 'docker' });
  assert.deepEqual(resolveTarget('postgres'), { kind: 'docker', service: 'postgres' });
  assert.deepEqual(resolveTarget('worker'), { kind: 'app', app: 'worker' });
  assert.deepEqual(resolveTarget('nope'), { kind: 'unknown', target: 'nope' });
});

test('parseArgs 默认值', () => {
  const { opts, errors } = parseArgs([]);
  assert.deepEqual(errors, []);
  assert.equal(opts.target, null);
  assert.equal(opts.service, null);
  assert.equal(opts.follow, false);
  assert.equal(opts.lines, 100);
});

test('parseArgs 读目标 / 跟随 / 行数', () => {
  const short = parseArgs(['api', '-f', '-n', '50']);
  assert.deepEqual(short.errors, []);
  assert.equal(short.opts.target, 'api');
  assert.equal(short.opts.follow, true);
  assert.equal(short.opts.lines, 50);

  const inline = parseArgs(['docker', 'postgres', '--lines=20']);
  assert.deepEqual(inline.errors, []);
  assert.equal(inline.opts.target, 'docker');
  assert.equal(inline.opts.service, 'postgres');
  assert.equal(inline.opts.lines, 20);
});

test('parseArgs 拒绝坏值', () => {
  assert.equal(parseArgs(['-n', '0']).errors.length, 1);
  assert.equal(parseArgs(['-n', 'abc']).errors.length, 1);
  assert.equal(parseArgs(['--bogus']).errors.length, 1);
  assert.equal(parseArgs(['a', 'b', 'c']).errors.length, 1);
});

test('tailLines 取末尾 N 行', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'strict-rag-logs-'));
  const file = path.join(dir, 'api.log');
  try {
    writeFileSync(file, 'l1\nl2\nl3\nl4\nl5\n');
    assert.deepEqual(tailLines(file, 2), ['l4', 'l5']);
    assert.deepEqual(tailLines(file, 99), ['l1', 'l2', 'l3', 'l4', 'l5']);
    writeFileSync(file, '');
    assert.deepEqual(tailLines(file, 10), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tailLines 截断时丢掉首个残行', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'strict-rag-logs-'));
  const file = path.join(dir, 'api.log');
  try {
    writeFileSync(file, 'aaaa\nbbbb\ncccc\n');
    // 只读末尾 6 字节：起点落在 "bbbb" 中间，残行 "bb" 应被丢弃。
    assert.deepEqual(tailLines(file, 10, 6), ['cccc']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
