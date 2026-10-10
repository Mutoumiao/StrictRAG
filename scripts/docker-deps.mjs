/**
 * `docker compose ps --format json` 的纯解析与状态判定。
 * 两处共用，避免同一套解析写两遍：
 *   - `dev-all.mjs` 起栈前等硬依赖（postgres / redis）healthy，可选服务不阻塞；
 *   - `verify-stack.mjs` 体检查五服务 running / healthy。
 * 本模块不跑命令、不碰文件系统，便于测例覆盖。
 */

export const COMPOSE_SERVICES = ['postgres', 'redis', 'elasticsearch', 'mongo', 'rustfs'];
/** 与 api `/ready` 的硬依赖同一口径：这两个不 up 就没有可服务的栈。 */
export const HARD_DEPS = ['postgres', 'redis'];

/** 容器已到终态失败：再等也不会自己好，应当立即报错而不是耗到超时。 */
const FAILED_STATES = new Set(['exited', 'dead', 'removing']);

function serviceKey(row) {
  return row?.Service ?? row?.service ?? row?.Name ?? row?.name ?? '';
}

function stateOf(row) {
  return String(row?.State ?? row?.state ?? '').toLowerCase();
}

function healthOf(row) {
  return String(row?.Health ?? row?.health ?? '')
    .toLowerCase()
    .replace(/^\(|\)$/g, '');
}

/** 「running(healthy)」这类一行状态，供人读输出与诊断文案。 */
export function serviceStateText(row) {
  if (!row) return 'missing';
  const state = stateOf(row) || 'unknown';
  const health = healthOf(row);
  return health ? `${state}(${health})` : state;
}

/**
 * healthy：running 且（无 healthcheck 或已 healthy）
 * starting：还在起（created / restarting / running+starting）
 * failed：已到终态（exited / dead / removing）
 * missing：ps 里根本没这个服务
 */
export function serviceVerdict(row) {
  if (!row) return 'missing';
  const state = stateOf(row);
  if (FAILED_STATES.has(state)) return 'failed';
  const health = healthOf(row);
  if (state && state !== 'running') return 'starting';
  if (health && health !== 'healthy') return 'starting';
  return 'healthy';
}

/** docker compose ps --format json 可能是 JSON 数组，也可能是每行一个对象。 */
export function parseComposePs(stdout) {
  const rows = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) rows.push(...parsed);
      else if (parsed && typeof parsed === 'object') rows.push(parsed);
    } catch {
      /* 非 JSON 行（提示 / 警告）忽略 */
    }
  }
  return rows;
}

export function evaluateDockerServices(rows, expected = COMPOSE_SERVICES) {
  const byService = new Map(rows.map((row) => [serviceKey(row), row]));
  const missing = expected.filter((s) => !byService.has(s));
  const bad = [];
  for (const service of expected) {
    const row = byService.get(service);
    if (!row) continue;
    const state = stateOf(row);
    const health = healthOf(row);
    if (state && state !== 'running') bad.push(`${service}:state=${state}`);
    else if (health && health !== 'healthy') bad.push(`${service}:health=${health}`);
  }
  return { ok: missing.length === 0 && bad.length === 0, missing, bad };
}

/**
 * 硬依赖就绪门：ok 表示全部 healthy；failed 是终态失败（应立即报错）；
 * pending 是仍在起（可继续等）。optional* 只作提示，不参与判定。
 */
export function classifyHardDeps(rows, { hard = HARD_DEPS } = {}) {
  const byService = new Map(rows.map((row) => [serviceKey(row), row]));
  const optionalServices = COMPOSE_SERVICES.filter((name) => !hard.includes(name));
  const verdicts = hard.map((service) => ({ service, row: byService.get(service) ?? null }));
  const failed = verdicts
    .filter((v) => serviceVerdict(v.row) === 'failed')
    .map((v) => `${v.service}=${serviceStateText(v.row)}`);
  const pending = verdicts
    .filter((v) => ['starting', 'missing'].includes(serviceVerdict(v.row)))
    .map((v) => `${v.service}=${serviceStateText(v.row)}`);
  const optionalDown = optionalServices
    .map((service) => ({ service, row: byService.get(service) ?? null }))
    .filter((v) => serviceVerdict(v.row) !== 'healthy')
    .map((v) => `${v.service}=${serviceStateText(v.row)}`);
  return {
    ok: failed.length === 0 && pending.length === 0,
    failed,
    pending,
    optionalDown,
    detail: [
      failed.length ? `硬依赖失败：${failed.join(',')}` : '',
      pending.length ? `硬依赖未就绪：${pending.join(',')}` : '',
      optionalDown.length ? `可选未就绪：${optionalDown.join(',')}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}
