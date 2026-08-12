/**
 * INGEST_SCAN_MODE × APP_ENV 启动策略（X-01 / X-02 · ADR-039 族）。
 * 真引擎未接（QUAL-2 开）：staging/production 与 mode=on 均 fail-closed。
 */

export const APP_ENVS = ['development', 'test', 'staging', 'production'] as const;
export type AppEnvName = (typeof APP_ENVS)[number];

/** 与 PRD 对齐：on | mock_clean | off；mock_infected 为工程测感染路径 */
export const INGEST_SCAN_MODES = [
  'mock_clean',
  'mock_infected',
  'on',
  'off',
] as const;
export type IngestScanMode = (typeof INGEST_SCAN_MODES)[number];

const DEV_LIKE: ReadonlySet<string> = new Set(['development', 'test']);
const PROD_LIKE: ReadonlySet<string> = new Set(['staging', 'production']);
const MOCK_OR_OFF: ReadonlySet<string> = new Set([
  'mock_clean',
  'mock_infected',
  'off',
]);

/**
 * @returns null = 允许启动；string = 拒绝原因（应 process.exit / zod issue）
 */
export function checkScanModeStartupPolicy(
  appEnv: string,
  scanMode: string,
): string | null {
  // X-02：on = 真引擎位；QUAL-2 未清前任何环境不得当 clean 启动
  if (scanMode === 'on') {
    return (
      'INGEST_SCAN_MODE=on requires a real scan engine (QUAL-2 not cleared). ' +
      'Do not treat on as mock_clean. ' +
      'Use mock_clean|mock_infected|off only when APP_ENV is development|test; ' +
      'staging|production must fail closed until the engine is wired.'
    );
  }

  // X-01：prod/staging 禁止 mock / off 灰态
  if (PROD_LIKE.has(appEnv) && MOCK_OR_OFF.has(scanMode)) {
    return (
      `APP_ENV=${appEnv} forbids INGEST_SCAN_MODE=${scanMode} (fail-closed). ` +
      'Production/staging require a healthy real scan engine; ' +
      'mock_clean|mock_infected|off are development|test only (DEC-SCAN / QUAL-2).'
    );
  }

  if (!DEV_LIKE.has(appEnv) && !PROD_LIKE.has(appEnv)) {
    return `unknown APP_ENV=${appEnv}`;
  }

  if (!INGEST_SCAN_MODES.includes(scanMode as IngestScanMode)) {
    return `unknown INGEST_SCAN_MODE=${scanMode}`;
  }

  return null;
}

/** pipeline 防御：运行时 mode=on 不得 clean 放行 */
export function isScanModeRuntimeBlocked(scanMode: string): boolean {
  return scanMode === 'on';
}
