/**
 * 目标：缺 OCR 引擎不得阻断 worker 启动，而缺杀毒引擎必须 fail-closed——两者启动口径必须对照成立。
 * 需求：剧本 Q10 · ADR-043 · DEC-SCAN / X-01 · QUAL-2
 * 被测：checkScanModeStartupPolicy · ocrStartupWarning · stackEnvIssues · src/env.ts 启动拒绝路径
 * 简介：杀毒侧：mode=on 在任何 APP_ENV 拒绝、staging/production 连 mock/off 都拒绝；
 *       OCR 侧：未开闸或 dev 无告警、staging/production 缺 ADR_REF 只告警（logger.warn），启动校验不挂 OCR 条件。
 *       ≠ 真引擎 / ≠ 真杀毒。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ocrStartupWarning } from '../../src/ocr-policy.js';
import { APP_ENVS, checkScanModeStartupPolicy } from '../../src/scan-mode-policy.js';
import { stackEnvIssues } from '../../src/env.js';

describe('剧本 Q10 · 缺杀毒 fail-closed', () => {
  it('mode=on 在任何 APP_ENV 都拒绝启动', () => {
    for (const appEnv of APP_ENVS) {
      expect(checkScanModeStartupPolicy(appEnv, 'on'), appEnv).toMatch(/QUAL-2|real scan engine/i);
    }
  });

  it('staging/production 连 mock/off 都拒绝（不得灰态起服务）', () => {
    for (const appEnv of ['staging', 'production'] as const) {
      for (const mode of ['mock_clean', 'mock_infected', 'off'] as const) {
        expect(checkScanModeStartupPolicy(appEnv, mode), `${appEnv}+${mode}`).toMatch(
          /fail-closed|forbids/i,
        );
      }
    }
  });
});

describe('剧本 Q10 · 缺 OCR 引擎不阻断启动', () => {
  it('未开闸 / dev 开闸 → 无告警；staging 开闸缺 ADR_REF → 只告警', () => {
    expect(
      ocrStartupWarning({
        APP_ENV: 'production',
        INGEST_OCR_ENABLED: false,
        INGEST_OCR_ADR_REF: '',
      }),
    ).toBeNull();
    expect(
      ocrStartupWarning({
        APP_ENV: 'development',
        INGEST_OCR_ENABLED: true,
        INGEST_OCR_ADR_REF: '',
      }),
    ).toBeNull();
    expect(
      ocrStartupWarning({
        APP_ENV: 'staging',
        INGEST_OCR_ENABLED: true,
        INGEST_OCR_ADR_REF: '',
      }),
    ).toMatch(/INGEST_OCR_ADR_REF/);
    expect(
      ocrStartupWarning({
        APP_ENV: 'staging',
        INGEST_OCR_ENABLED: true,
        INGEST_OCR_ADR_REF: 'ADR-043',
      }),
    ).toBeNull();
  });

  it('启动拒绝路径只由扫描策略与栈校验产生，OCR 不参与 fail-closed', async () => {
    const srcDir = path.join(process.cwd(), 'src');
    const envSrc = await readFile(path.join(srcDir, 'env.ts'), 'utf8');
    const refine = envSrc.slice(
      envSrc.indexOf('.superRefine('),
      envSrc.indexOf('export type WorkerEnv'),
    );
    expect(refine).toMatch(/checkScanModeStartupPolicy\(/);
    expect(refine).toMatch(/stackEnvIssues\(/);
    expect(refine, 'superRefine 不得挂 OCR 条件').not.toMatch(/OCR/);
    // OCR 默认关闸（无引擎时不得假抽正文）
    expect(envSrc).toMatch(/INGEST_OCR_ENABLED: z[\s\S]{0,120}default\('false'\)/);

    const indexSrc = await readFile(path.join(srcDir, 'index.ts'), 'utf8');
    expect(indexSrc).toMatch(/ocrStartupWarning\(\{[\s\S]{0,320}logger\.warn\(ocrWarn\)/);
    expect(indexSrc, 'OCR 告警不得升级为退出').not.toMatch(/ocrWarn[\s\S]{0,80}process\.exit/);

    // 栈启动校验只覆盖 ES / 对象存储接线，OCR 无必填项
    expect(
      stackEnvIssues({
        INGEST_ES_MODE: 'mock',
        ELASTICSEARCH_URL: '',
        STORAGE_MODE: 'local',
        S3_ENDPOINT: '',
      }),
    ).toEqual([]);
  });
});
