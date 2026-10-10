import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_NAMES,
  appStartArgs,
  composeDownArgs,
  composePsArgs,
  composeUpArgs,
  detectRunningStack,
  escapeRegExp,
  exitLabel,
  firstFatalLine,
  isApiReady,
  isHttpReadyStatus,
  killTree,
  logFilePath,
  missingStartBuilds,
  nonzeroExits,
  parseArgs,
  parsePosixProcesses,
  parseWindowsProcesses,
  pidLooksLikeApp,
  pickRepoAppProcesses,
  prefixLine,
  readyTargets,
  selectApps,
  statusFilePath,
  stripAnsi,
  turboDevArgs,
  waitForDockerDeps,
  waitForReady,
} from './dev-all.mjs';

test('parseArgs 默认：中间件/迁移都开、dev 模式、四个应用', () => {
  const { opts, errors } = parseArgs([]);
  assert.deepEqual(errors, []);
  assert.equal(opts.compose, true);
  assert.equal(opts.migrate, true);
  assert.equal(opts.portCheck, true);
  assert.equal(opts.tui, false);
  assert.equal(opts.stop, false);
  assert.equal(opts.mode, 'dev');
  assert.deepEqual(opts.apps, APP_NAMES);
});

test('parseArgs 识别开关与取值', () => {
  const { opts, errors } = parseArgs([
    '--no-compose',
    '--no-migrate',
    '--no-port-check',
    '--tui',
    '--mode=start',
    '--apps=api,web',
  ]);
  assert.deepEqual(errors, []);
  assert.equal(opts.compose, false);
  assert.equal(opts.migrate, false);
  assert.equal(opts.portCheck, false);
  assert.equal(opts.tui, true);
  assert.equal(opts.mode, 'start');
  assert.deepEqual(opts.apps, ['api', 'web']);
});

test('parseArgs 拒绝坏值而不静默降级', () => {
  assert.equal(parseArgs(['--mode=prod']).errors.length, 1);
  assert.equal(parseArgs(['--apps=api,nope']).errors.length, 1);
  assert.equal(parseArgs(['--apps=']).errors.length, 1);
  assert.equal(parseArgs(['--bogus']).errors.length, 1);
  assert.deepEqual(parseArgs(['--mode=prod']).opts.mode, 'dev');
});

test('parseArgs 支持 --stop 与 --with-volumes', () => {
  const { opts, errors } = parseArgs(['--stop', '--with-volumes']);
  assert.deepEqual(errors, []);
  assert.equal(opts.stop, true);
  assert.equal(opts.volumes, true);
  assert.deepEqual(composeDownArgs(opts), ['compose', '-f', 'docker/docker-compose.yml', 'down', '-v']);
});

test('parseArgs 识别 -h / --help', () => {
  assert.equal(parseArgs(['-h']).opts.help, true);
  assert.equal(parseArgs(['--help']).opts.help, true);
  assert.equal(parseArgs([]).opts.help, false);
});

test('composeUpArgs 起容器但不等待（等硬依赖交给 waitForDockerDeps）', () => {
  assert.deepEqual(composeUpArgs(), ['compose', '-f', 'docker/docker-compose.yml', 'up', '-d']);
  // --all 必须带上：默认 ps 只列运行中的容器，停掉的硬依赖会被当成 missing
  assert.deepEqual(composePsArgs(), [
    'compose',
    '-f',
    'docker/docker-compose.yml',
    'ps',
    '--all',
    '--format',
    'json',
  ]);
});

test('composeDownArgs 默认保卷', () => {
  assert.deepEqual(composeDownArgs(), ['compose', '-f', 'docker/docker-compose.yml', 'down']);
  assert.deepEqual(composeDownArgs({ volumes: true }).at(-1), '-v');
});

test('appStartArgs 按模式选 dev / start', () => {
  const api = selectApps(['api'])[0];
  assert.deepEqual(appStartArgs(api, 'dev'), ['--filter', '@strict-rag/api', 'dev']);
  assert.deepEqual(appStartArgs(api, 'start'), ['--filter', '@strict-rag/api', 'start']);
});

test('turboDevArgs 带 loose env，避开 strict 过滤 operable 变量', () => {
  assert.deepEqual(turboDevArgs('dev'), ['exec', 'turbo', 'run', 'dev', '--ui=tui', '--env-mode=loose']);
});

test('selectApps 保持 APPS 声明顺序并忽略未知名', () => {
  assert.deepEqual(
    selectApps(['web', 'api']).map((a) => a.name),
    ['api', 'web'],
  );
  assert.deepEqual(selectApps(['nope']), []);
});

test('logFilePath 落在 .data/logs 下的 <app>.log', () => {
  assert.match(logFilePath('worker').replaceAll('\\', '/'), /\/\.data\/logs\/worker\.log$/);
});

test('prefixLine 带色与不带色两种形态', () => {
  assert.equal(prefixLine('api', 'hello', null), '[api] hello');
  assert.equal(prefixLine('api', 'hello', 36), '\u001b[36m[api]\u001b[0m hello');
});

test('stripAnsi 去掉颜色码，保留正文', () => {
  assert.equal(stripAnsi('\u001b[32m[web]\u001b[0m ready in 300ms'), '[web] ready in 300ms');
  assert.equal(stripAnsi('plain'), 'plain');
});

test('killTree 对空 / 已退出句柄不抛', () => {
  assert.doesNotThrow(() => killTree(null));
  assert.doesNotThrow(() => killTree({ exitCode: 0, pid: 1, kill() {} }));
});

test('exitLabel：外部收尾不算异常退出', () => {
  assert.equal(exitLabel({ code: 0 }), '已退出');
  assert.equal(exitLabel({ code: 1 }), '异常退出');
  assert.equal(exitLabel({ code: null, signal: 'SIGTERM' }), '异常退出');
  assert.equal(exitLabel({ code: 1, stoppedByOther: true }), '已停（外部收尾）');
});

test('nonzeroExits：Ctrl-C 与外部 stack:down 都不算失败', () => {
  const children = [
    { app: { name: 'api' }, exit: 1 },
    { app: { name: 'web' }, exit: 0 },
  ];
  assert.deepEqual(nonzeroExits(children), ['api=1']);
  assert.deepEqual(nonzeroExits(children, { stopping: true }), []);
  assert.deepEqual(nonzeroExits(children, { stoppedByOther: true }), []);
});

test('parseArgs 支持 --no-wait-ready（默认等就绪）', () => {
  assert.equal(parseArgs([]).opts.waitReady, true);
  const { opts, errors } = parseArgs(['--no-wait-ready']);
  assert.deepEqual(errors, []);
  assert.equal(opts.waitReady, false);
});

test('parseArgs 支持 --ready-timeout（秒），坏值不静默降级', () => {
  assert.equal(parseArgs([]).opts.readyTimeoutMs, 180_000);
  const { opts, errors } = parseArgs(['--ready-timeout=300']);
  assert.deepEqual(errors, []);
  assert.equal(opts.readyTimeoutMs, 300_000);
  assert.equal(parseArgs(['--ready-timeout=0']).errors.length, 1);
  assert.equal(parseArgs(['--ready-timeout=abc']).errors.length, 1);
  assert.equal(parseArgs(['--ready-timeout=1.5']).errors.length, 1);
  // 坏值不改变默认
  assert.equal(parseArgs(['--ready-timeout=0']).opts.readyTimeoutMs, 180_000);
});

test('readyTargets：api 探 /ready，web/admin 探首页，worker 探日志行', () => {
  const targets = readyTargets(selectApps(['api', 'worker', 'web', 'admin']));
  assert.deepEqual(
    targets.map((t) => t.name),
    ['api', 'worker', 'web', 'admin'],
  );
  const api = targets.find((t) => t.name === 'api');
  assert.equal(api.kind, 'http');
  assert.equal(api.url, 'http://127.0.0.1:4000/ready');
  const web = targets.find((t) => t.name === 'web');
  assert.equal(web.url, 'http://127.0.0.1:3005/');
  const worker = targets.find((t) => t.name === 'worker');
  assert.equal(worker.kind, 'log');
  assert.equal(worker.pattern.test('worker running'), true);
});

test('isHttpReadyStatus：连接失败与 5xx 不算就绪，4xx 算可达', () => {
  assert.equal(isHttpReadyStatus(0), false);
  assert.equal(isHttpReadyStatus(200), true);
  assert.equal(isHttpReadyStatus(307), true);
  assert.equal(isHttpReadyStatus(404), true);
  assert.equal(isHttpReadyStatus(500), false);
});

test('isApiReady：只认 ready=true', () => {
  assert.equal(isApiReady('{"ready":true,"checks":{}}'), true);
  assert.equal(isApiReady('{"ready":false}'), false);
  assert.equal(isApiReady(''), false);
  assert.equal(isApiReady('not-json'), false);
});

test('statusFilePath 指向 .data/run/status.json', () => {
  assert.match(statusFilePath().replaceAll('\\', '/'), /\/\.data\/run\/status\.json$/);
});

test('parseWindowsProcesses：吃 ConvertTo-Json 的单对象与数组两种形态', () => {
  const one = JSON.stringify({ ProcessId: 42, CommandLine: 'node D:\\repo\\apps\\api\\src\\index.ts' });
  assert.deepEqual(parseWindowsProcesses(one), [
    { pid: 42, command: 'node D:\\repo\\apps\\api\\src\\index.ts' },
  ]);
  const many = JSON.stringify([
    { ProcessId: 42, CommandLine: 'a' },
    { ProcessId: 43, CommandLine: 'b' },
  ]);
  assert.deepEqual(parseWindowsProcesses(many).map((r) => r.pid), [42, 43]);
  assert.deepEqual(parseWindowsProcesses(''), []);
  assert.deepEqual(parseWindowsProcesses(undefined), []);
  // 回退：拿到 ps 风格文本时也能解析，免得平台判断错就全瞎
  assert.deepEqual(parseWindowsProcesses('42 node x\n43 node y\n').map((r) => r.pid), [42, 43]);
});

test('parsePosixProcesses：pid + 命令行，噪音行忽略', () => {
  const stdout = '  42 node /repo/apps/api/src/index.ts\nabc not-a-row\n 43 bun x\n';
  assert.deepEqual(parsePosixProcesses(stdout), [
    { pid: 42, command: 'node /repo/apps/api/src/index.ts' },
    { pid: 43, command: 'bun x' },
  ]);
});

test('pickRepoAppProcesses：只认本仓 apps/<app>，识别出应用名', () => {
  const root = 'D:\\projects\\ai-stared-project\\StrictRAG';
  const rows = [
    { pid: 1, command: 'node D:\\projects\\ai-stared-project\\StrictRAG\\apps\\api\\src\\index.ts' },
    { pid: 2, command: 'node D:/projects/ai-stared-project/StrictRAG/apps/web/node_modules/next/dist/bin/next dev' },
    { pid: 3, command: 'node C:\\other\\apps\\api\\index.ts' },
    { pid: 4, command: 'node D:\\projects\\ai-stared-project\\StrictRAG\\packages\\db\\x.ts' },
  ];
  assert.deepEqual(
    pickRepoAppProcesses(rows, root).map((p) => `${p.app}#${p.pid}`),
    ['api#1', 'web#2'],
  );
  assert.deepEqual(pickRepoAppProcesses([], root), []);
});

test('pidLooksLikeApp：认本仓路径形态与 pnpm --filter 包装层，不认无关进程', () => {
  const root = 'D:\\projects\\ai-stared-project\\StrictRAG';
  assert.equal(
    pidLooksLikeApp({ command: `${root}\\apps\\api\\src\\index.ts` }, 'api', root),
    true,
  );
  assert.equal(
    pidLooksLikeApp({ command: 'cmd.exe /d /s /c "pnpm --filter @strict-rag/web start"' }, 'web', root),
    true,
  );
  // 包名相近但不是同一个应用
  assert.equal(pidLooksLikeApp({ command: 'pnpm --filter @strict-rag/web-admin start' }, 'web', root), false);
  assert.equal(pidLooksLikeApp({ command: 'node C:\\other\\app.js' }, 'web', root), false);
  assert.equal(pidLooksLikeApp(null, 'web', root), false);
});

test('missingStartBuilds：只对 web / admin 要求 .next，缺则点名', () => {
  const apps = selectApps(['api', 'worker', 'web', 'admin']);
  const noneBuilt = missingStartBuilds(apps, { root: 'R', exists: () => false });
  assert.deepEqual(noneBuilt, ['web', 'admin']);
  const allBuilt = missingStartBuilds(apps, { root: 'R', exists: () => true });
  assert.deepEqual(allBuilt, []);
  const onlyWeb = missingStartBuilds(apps, {
    root: 'R',
    exists: (p) => p.replaceAll('\\', '/').includes('/apps/web/.next'),
  });
  assert.deepEqual(onlyWeb, ['admin']);
  // api / worker 不参与判定（它们没有 next start 这一步）
  assert.deepEqual(missingStartBuilds(selectApps(['api', 'worker']), { root: 'R', exists: () => false }), []);
});

test('detectRunningStack：记录在案且编排进程还活着才算有栈在跑', () => {
  const live = { orchestratorPid: 100, startedAt: 't0', ready: true, apps: [{ name: 'api' }, { name: 'web' }] };
  const alive = () => true;
  assert.deepEqual(detectRunningStack(live, alive), {
    pid: 100,
    startedAt: 't0',
    ready: true,
    apps: ['api', 'web'],
  });
  assert.equal(detectRunningStack(live, () => false), null);
  assert.equal(detectRunningStack({ ...live, stoppedAt: 't1' }, alive), null);
  assert.equal(detectRunningStack(null, alive), null);
  assert.equal(detectRunningStack({ startedAt: 't0' }, alive), null);
});

test('waitForDockerDeps：硬依赖 healthy 即放行，不理会可选服务', async () => {
  const outcome = await waitForDockerDeps({
    intervalMs: 0,
    wait: async () => {},
    now: () => 0,
    ps: () => [
      { Service: 'postgres', State: 'running', Health: 'healthy' },
      { Service: 'redis', State: 'running', Health: 'healthy' },
      { Service: 'elasticsearch', State: 'running', Health: 'starting' },
    ],
  });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.kind, 'ready');
  // 未起 / 未就绪的可选服务都报出来，但都不参与放行判定
  assert.deepEqual(outcome.optionalDown, [
    'elasticsearch=running(starting)',
    'mongo=missing',
    'rustfs=missing',
  ]);
});

test('waitForDockerDeps：容器终态失败立即返回，不等超时', async () => {
  let calls = 0;
  const outcome = await waitForDockerDeps({
    intervalMs: 0,
    wait: async () => {},
    now: () => 0,
    ps: () => {
      calls += 1;
      return [
        { Service: 'postgres', State: 'exited' },
        { Service: 'redis', State: 'running', Health: 'healthy' },
      ];
    },
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.kind, 'failed');
  assert.deepEqual(outcome.failed, ['postgres=exited']);
  assert.equal(calls, 1);
});

test('waitForDockerDeps：超时返回各硬依赖当前状态', async () => {
  const ticks = [];
  const outcome = await waitForDockerDeps({
    timeoutMs: 6000,
    intervalMs: 0,
    wait: async () => {},
    now: (() => {
      let clock = 0;
      return () => (clock += 3000);
    })(),
    onProgress: (v) => ticks.push(v.pending.join(',')),
    ps: () => [{ Service: 'postgres', State: 'running', Health: 'starting' }],
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.kind, 'timeout');
  assert.deepEqual(outcome.pending, ['postgres=running(starting)', 'redis=missing']);
  assert.equal(ticks.length >= 1, true);
});

test('waitForDockerDeps：compose ps 跑不起来时按 unavailable 收敛', async () => {
  const outcome = await waitForDockerDeps({ intervalMs: 0, wait: async () => {}, now: () => 0, ps: () => null });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.kind, 'unavailable');
  assert.match(outcome.detail, /docker compose ps 失败/);
});

test('escapeRegExp：路径反斜杠与正则元字符都要能安全进正则', () => {
  assert.equal(escapeRegExp('D:\\a\\b'), 'D:\\\\a\\\\b');
  assert.equal(escapeRegExp('a.b+c'), 'a\\.b\\+c');
  assert.equal(escapeRegExp('x[y]'), 'x\\[y\\]');
});

test('waitForReady：全部目标就绪即返回 ready', async () => {
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api', 'worker'])),
    intervalMs: 0,
    wait: async () => {},
    now: () => 0,
    probe: async () => ({ status: 200, body: '{"ready":true}' }),
    readLog: () => 'worker running',
  });
  assert.equal(outcome.ready, true);
  assert.deepEqual(
    outcome.results.map((r) => r.ready),
    [true, true],
  );
});

test('waitForReady：worker 日志后到也算就绪，readyMs 反映耗时', async () => {
  let reads = 0;
  let clock = 0;
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api', 'worker'])),
    intervalMs: 0,
    wait: async () => {},
    now: () => (clock += 1000),
    probe: async () => ({ status: 200, body: '{"ready":true}' }),
    readLog: (file) => (/worker/.test(file) ? (++reads >= 2 ? 'worker running' : 'booting') : ''),
  });
  assert.equal(outcome.ready, true);
  assert.equal(outcome.readyMs, 2000);
  assert.equal(outcome.results.find((r) => r.name === 'worker').ready, true);
});

test('waitForReady：api 返回 ready=false 时不判就绪并给出 detail', async () => {
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api'])),
    intervalMs: 0,
    wait: async () => {},
    timeoutMs: 2000,
    now: (() => {
      let clock = 0;
      return () => (clock += 1000);
    })(),
    probe: async () => ({ status: 200, body: '{"ready":false}' }),
    readLog: () => '',
  });
  assert.equal(outcome.ready, false);
  assert.match(outcome.results[0].detail, /ready 不为 true/);
});

test('firstFatalLine：认仓库里的启动致命标记，普通行不认', () => {
  assert.match(
    firstFatalLine('[api] env 校验失败:\n  - STORAGE_MODE: Invalid option'),
    /env 校验失败/,
  );
  assert.match(firstFatalLine('{"msg":"Redis 不可达，worker 退出"}'), /Redis 不可达/);
  assert.match(firstFatalLine('Error: listen EADDRINUSE: address already in use'), /EADDRINUSE/);
  assert.equal(firstFatalLine('api listening on http://127.0.0.1:4000'), null);
  // 正常关停不算启动即崩
  assert.equal(firstFatalLine('api shutting down'), null);
  assert.equal(firstFatalLine(''), null);
  assert.equal(firstFatalLine(undefined), null);
});

test('waitForReady：日志出现致命标记，宽限期后立即收敛并带回原文', async () => {
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api'])),
    intervalMs: 0,
    timeoutMs: 180_000,
    wait: async () => {},
    now: (() => {
      let clock = 0;
      return () => (clock += 1000);
    })(),
    probe: async () => ({ status: 0, body: '' }),
    readLog: () => '[api] env 校验失败:\n  - STORAGE_MODE: Invalid option',
    fatalGraceMs: 3000,
  });
  assert.equal(outcome.ready, false);
  assert.equal(outcome.aborted.name, 'api');
  assert.match(outcome.aborted.reason, /日志出现致命错误：.*env 校验失败/);
  // 远早于 180s 超时
  assert.equal(outcome.readyMs < 180_000, true);
});

test('waitForReady：日志有致命行但已就绪时不误判失败（watch 重启成功）', async () => {
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api'])),
    intervalMs: 0,
    timeoutMs: 60_000,
    wait: async () => {},
    now: (() => {
      let clock = 0;
      return () => (clock += 5000);
    })(),
    probe: async () => ({ status: 200, body: '{"ready":true}' }),
    readLog: () => '[api] env 校验失败: 上一轮的残留',
    fatalGraceMs: 1000,
  });
  assert.equal(outcome.ready, true);
  assert.equal(outcome.aborted, null);
});

test('waitForReady：shouldAbort 报提前终止时立即收敛，带回原因', async () => {
  let probes = 0;
  let clock = 0;
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api', 'worker'])),
    intervalMs: 0,
    timeoutMs: 180_000,
    wait: async () => {},
    now: () => (clock += 1000),
    probe: async () => {
      probes += 1;
      return { status: 0, body: '' };
    },
    readLog: () => '',
    shouldAbort: () => (probes >= 1 ? { name: 'api', reason: '进程已退出（exit=1）' } : null),
  });
  assert.equal(outcome.ready, false);
  assert.equal(outcome.aborted.name, 'api');
  assert.match(outcome.aborted.reason, /exit=1/);
  // 一轮探测后即收敛，没有空等 180s
  assert.equal(outcome.readyMs < 180_000, true);
  assert.equal(probes, 1);
});

test('waitForReady：不传 shouldAbort 时行为不变，aborted 为 null', async () => {
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api'])),
    intervalMs: 0,
    wait: async () => {},
    now: () => 0,
    probe: async () => ({ status: 200, body: '{"ready":true}' }),
    readLog: () => '',
  });
  assert.equal(outcome.ready, true);
  assert.equal(outcome.aborted, null);
});

test('waitForReady：超时返回未就绪项，并按 5s 节流报进度', async () => {
  const ticks = [];
  const outcome = await waitForReady({
    targets: readyTargets(selectApps(['api', 'worker'])),
    intervalMs: 0,
    wait: async () => {},
    timeoutMs: 12_000,
    onProgress: (pending) => ticks.push(pending.map((p) => p.name).join(',')),
    now: (() => {
      let clock = 0;
      return () => (clock += 1000);
    })(),
    probe: async () => ({ status: 0, body: '' }),
    readLog: () => '',
  });
  assert.equal(outcome.ready, false);
  assert.deepEqual(
    outcome.results.map((r) => r.name),
    ['api', 'worker'],
  );
  assert.equal(outcome.results[0].detail, '连接失败');
  assert.equal(ticks.length >= 2, true);
  assert.equal(ticks[0], 'api,worker');
});
