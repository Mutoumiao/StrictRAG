import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyReadyChecks,
  evaluateLogFreshness,
  evaluateWorkerReady,
  isHttpOk,
  parseArgs,
  sliceFromOffset,
  summarize,
} from './verify-stack.mjs';

test('parseArgs 默认：人读输出 + 查 docker + 默认报告路径', () => {
  const { opts, errors } = parseArgs([]);
  assert.deepEqual(errors, []);
  assert.equal(opts.json, false);
  assert.equal(opts.docker, true);
  assert.match(opts.report.replaceAll('\\', '/'), /\/\.data\/run\/verify-report\.json$/);
});

test('parseArgs 读开关与报告路径，拒绝坏值', () => {
  const { opts, errors } = parseArgs(['--json', '--no-docker', '--report=D:\\tmp\\r.json']);
  assert.deepEqual(errors, []);
  assert.equal(opts.json, true);
  assert.equal(opts.docker, false);
  assert.equal(opts.report, 'D:\\tmp\\r.json');
  assert.equal(parseArgs(['--report=']).errors.length, 1);
  assert.equal(parseArgs(['--bogus']).errors.length, 1);
});

test('isHttpOk：可达即算（含 4xx），5xx 与连接失败不算', () => {
  assert.equal(isHttpOk(200), true);
  assert.equal(isHttpOk(307), true);
  assert.equal(isHttpOk(404), true);
  assert.equal(isHttpOk(503), false);
  assert.equal(isHttpOk(0), false);
});

test('classifyReadyChecks：postgres / redis 为硬依赖，其余允许 skipped', () => {
  const allUp = classifyReadyChecks({
    postgres: 'up',
    redis: 'up',
    elasticsearch: 'skipped',
    gateway: 'skipped',
    s3: 'skipped',
    mongo: 'skipped',
  });
  assert.equal(allUp.hardOk, true);
  assert.deepEqual(allUp.optionalDown, []);
  assert.equal(allUp.optional.length, 4);

  const pgDown = classifyReadyChecks({ postgres: 'down', redis: 'up' });
  assert.equal(pgDown.hardOk, false);
  assert.deepEqual(pgDown.hard, { postgres: 'down', redis: 'up' });

  const missingRedis = classifyReadyChecks({ postgres: 'up' });
  assert.equal(missingRedis.hardOk, false);
  assert.equal(missingRedis.hard.redis, 'missing');

  const optionalDown = classifyReadyChecks({ postgres: 'up', redis: 'up', s3: 'down' });
  assert.equal(optionalDown.hardOk, true);
  assert.deepEqual(optionalDown.optionalDown, ['s3']);
});

test('sliceFromOffset：按本次运行偏移切片，偏移无效时退回全文', () => {
  assert.equal(sliceFromOffset('abcdef', 2), 'cdef');
  assert.equal(sliceFromOffset('abcdef', 0), 'abcdef');
  assert.equal(sliceFromOffset('abcdef', undefined), 'abcdef');
  assert.equal(sliceFromOffset('abcdef', NaN), 'abcdef');
});

test('evaluateWorkerReady：锚定本次运行段，历史段不算数', () => {
  const text = '===== worker (pkg) t1 =====\nworker running\n===== worker (pkg) t2 =====\nstarting\n';
  const offset = text.indexOf('===== worker (pkg) t2');
  const fresh = evaluateWorkerReady({ text, startOffset: offset, hasRecord: true });
  assert.equal(fresh.status, 'fail');
  assert.match(fresh.detail, /未见「worker running」/);

  const ready = evaluateWorkerReady({
    text: `${text}worker running\n`,
    startOffset: offset,
    hasRecord: true,
  });
  assert.equal(ready.status, 'pass');

  const empty = evaluateWorkerReady({ text, startOffset: text.length, hasRecord: true });
  assert.equal(empty.status, 'fail');

  const noRecord = evaluateWorkerReady({ text, startOffset: offset, hasRecord: false });
  assert.equal(noRecord.status, 'warn');
  assert.match(noRecord.detail, /无运行记录/);

  // 已停与「无记录」是两种事实，文案要分开
  const stopped = evaluateWorkerReady({
    text,
    startOffset: offset,
    hasRecord: true,
    stoppedAt: '2026-10-10T14:03:44.239Z',
  });
  assert.equal(stopped.status, 'warn');
  assert.match(stopped.detail, /2026-10-10T14:03:44\.239Z/);
});

test('evaluateLogFreshness：要求本次运行段非空', () => {
  const sizes = { api: 100, worker: 50 };
  const fresh = evaluateLogFreshness({ sizes, startOffsets: { api: 10, worker: 20 }, hasRecord: true });
  assert.equal(fresh.status, 'pass');
  assert.match(fresh.detail, /2 份日志/);

  const stale = evaluateLogFreshness({ sizes, startOffsets: { api: 100, worker: 5 }, hasRecord: true });
  assert.equal(stale.status, 'fail');
  assert.match(stale.detail, /api/);

  const missingFile = evaluateLogFreshness({
    sizes: { api: null, worker: 50 },
    startOffsets: { api: 10, worker: 20 },
    hasRecord: true,
  });
  assert.equal(missingFile.status, 'fail');

  const noRecord = evaluateLogFreshness({ sizes, startOffsets: {}, hasRecord: false });
  assert.equal(noRecord.status, 'warn');
});

test('summarize：只有 fail 决定 passed', () => {
  const items = [
    { id: 'a', status: 'pass' },
    { id: 'b', status: 'warn' },
    { id: 'c', status: 'skip' },
  ];
  assert.deepEqual(summarize(items), { pass: 1, fail: 0, warn: 1, skip: 1, passed: true });
  const withFail = summarize([...items, { id: 'd', status: 'fail' }]);
  assert.equal(withFail.passed, false);
  assert.equal(withFail.fail, 1);
});
