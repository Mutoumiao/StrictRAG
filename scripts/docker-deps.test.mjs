import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPOSE_SERVICES,
  HARD_DEPS,
  classifyHardDeps,
  evaluateDockerServices,
  parseComposePs,
  serviceStateText,
  serviceVerdict,
} from './docker-deps.mjs';

test('服务清单：硬依赖是 postgres / redis，可选服务由硬依赖推导且不重叠', () => {
  assert.deepEqual(HARD_DEPS, ['postgres', 'redis']);
  const optional = COMPOSE_SERVICES.filter((name) => !HARD_DEPS.includes(name));
  assert.deepEqual(optional, ['elasticsearch', 'mongo', 'rustfs']);
  assert.deepEqual([...HARD_DEPS, ...optional].sort(), [...COMPOSE_SERVICES].sort());
  assert.deepEqual(classifyHardDeps([]).optionalDown, [
    'elasticsearch=missing',
    'mongo=missing',
    'rustfs=missing',
  ]);
});

test('parseComposePs 同时吃 JSON 数组与 NDJSON，忽略非 JSON 行', () => {
  const array = '[{"Service":"redis","State":"running"},{"Service":"mongo","State":"running"}]';
  assert.equal(parseComposePs(array).length, 2);
  const ndjson = '{"Service":"redis","State":"running"}\nWARN 提示行\n{"Service":"mongo","State":"running"}\n';
  assert.equal(parseComposePs(ndjson).length, 2);
  assert.deepEqual(parseComposePs(''), []);
  assert.deepEqual(parseComposePs(undefined), []);
});

test('serviceVerdict：分 healthy / starting / failed / missing 四态', () => {
  assert.equal(serviceVerdict({ State: 'running', Health: 'healthy' }), 'healthy');
  assert.equal(serviceVerdict({ State: 'running' }), 'healthy');
  assert.equal(serviceVerdict({ State: 'running', Health: '(healthy)' }), 'healthy');
  assert.equal(serviceVerdict({ State: 'running', Health: 'starting' }), 'starting');
  assert.equal(serviceVerdict({ State: 'created' }), 'starting');
  assert.equal(serviceVerdict({ State: 'running', Health: 'unhealthy' }), 'starting');
  assert.equal(serviceVerdict({ State: 'exited' }), 'failed');
  assert.equal(serviceVerdict({ State: 'dead' }), 'failed');
  assert.equal(serviceVerdict(undefined), 'missing');
});

test('serviceStateText：一行状态，缺行时明确写 missing', () => {
  assert.equal(serviceStateText({ State: 'running', Health: 'starting' }), 'running(starting)');
  assert.equal(serviceStateText({ State: 'exited' }), 'exited');
  assert.equal(serviceStateText(undefined), 'missing');
});

test('evaluateDockerServices：全 running/healthy 才算通过', () => {
  const expected = ['postgres', 'redis'];
  const ok = evaluateDockerServices(
    [
      { Service: 'postgres', State: 'running', Health: 'healthy' },
      { Service: 'redis', State: 'running', Health: '' },
    ],
    expected,
  );
  assert.equal(ok.ok, true);

  const missing = evaluateDockerServices([{ Service: 'postgres', State: 'running' }], expected);
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missing, ['redis']);

  const exited = evaluateDockerServices(
    [
      { Service: 'postgres', State: 'exited' },
      { Service: 'redis', State: 'running' },
    ],
    expected,
  );
  assert.equal(exited.ok, false);
  assert.deepEqual(exited.bad, ['postgres:state=exited']);

  const starting = evaluateDockerServices(
    [
      { Service: 'postgres', State: 'running', Health: 'starting' },
      { Service: 'redis', State: 'running', Health: 'healthy' },
    ],
    expected,
  );
  assert.equal(starting.ok, false);
  assert.deepEqual(starting.bad, ['postgres:health=starting']);
});

test('classifyHardDeps：就绪才放行，终态失败与未就绪分开报', () => {
  const ready = classifyHardDeps([
    { Service: 'postgres', State: 'running', Health: 'healthy' },
    { Service: 'redis', State: 'running', Health: 'healthy' },
    { Service: 'elasticsearch', State: 'running', Health: 'starting' },
  ]);
  assert.equal(ready.ok, true);
  assert.deepEqual(ready.failed, []);
  assert.deepEqual(ready.pending, []);
  assert.deepEqual(ready.optionalDown, ['elasticsearch=running(starting)', 'mongo=missing', 'rustfs=missing']);

  const starting = classifyHardDeps([{ Service: 'postgres', State: 'running', Health: 'starting' }]);
  assert.equal(starting.ok, false);
  assert.deepEqual(starting.pending, ['postgres=running(starting)', 'redis=missing']);
  assert.deepEqual(starting.failed, []);

  const failed = classifyHardDeps([
    { Service: 'postgres', State: 'exited' },
    { Service: 'redis', State: 'running', Health: 'healthy' },
  ]);
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.failed, ['postgres=exited']);
  assert.deepEqual(failed.pending, []);

  const allUp = classifyHardDeps([
    { Service: 'postgres', State: 'running', Health: 'healthy' },
    { Service: 'redis', State: 'running', Health: 'healthy' },
    { Service: 'elasticsearch', State: 'running', Health: 'healthy' },
    { Service: 'mongo', State: 'running', Health: 'healthy' },
    { Service: 'rustfs', State: 'running', Health: 'healthy' },
  ]);
  assert.deepEqual(allUp.optionalDown, []);
  assert.equal(allUp.detail, '');
  assert.match(ready.detail, /可选未就绪：elasticsearch=running\(starting\)/);
});
