import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import {
  checkScanModeStartupPolicy,
  INGEST_SCAN_MODES,
} from './scan-mode-policy.js';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(monorepoRoot, '.env') });
loadDotenv();

const AppEnvSchema = z.enum(['development', 'test', 'staging', 'production']);

const EnvSchema = z
  .object({
    APP_ENV: AppEnvSchema.default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
    REDIS_URL: z.string().min(1, 'REDIS_URL 不能为空'),
    TAU_CLAIM: z.coerce.number().min(0).max(1).default(0.5),
    TAU_CLAIM_LEGACY: z.coerce.number().min(0).max(1).optional(),
    WORKER_PROBE_ON_START: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    GATEWAY_BASE_URL: z.string().optional().default(''),
    GATEWAY_API_KEY: z.string().optional().default(''),
    /**
     * mock_clean | mock_infected | off = 仅 development|test
     * on = 真引擎（QUAL-2 未清前启动失败，禁同 clean）
     */
    INGEST_SCAN_MODE: z.enum(INGEST_SCAN_MODES).default('mock_clean'),
    /**
     * mock | fail | http — http=真 ES bulk（可运行栈）；默认 mock 保 CI。
     * http 须 ELASTICSEARCH_URL。
     */
    INGEST_ES_MODE: z.enum(['mock', 'fail', 'http']).default('mock'),
    ELASTICSEARCH_URL: z.string().optional().default(''),
    ELASTIC_INDEX: z.string().optional().default('strict_rag_dev'),
    INGEST_EMBED_MODE: z.enum(['mock', 'fail', 'http']).default('mock'),
    GATEWAY_EMBED_MODEL: z.string().optional().default('text-embedding-3-small'),
    INGEST_MIN_EXTRACTED_CHARS: z.coerce.number().int().positive().default(40),
    STORAGE_MODE: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('.data/objects'),
    S3_ENDPOINT: z.string().optional().default(''),
    S3_ACCESS_KEY: z.string().optional().default(''),
    S3_SECRET_KEY: z.string().optional().default(''),
    S3_BUCKET: z.string().default('strict-rag'),
    /** 空=parse 仍写 mongoDocId=local:；有值才写真 Mongo */
    MONGODB_URL: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.TAU_CLAIM_LEGACY !== undefined && data.TAU_CLAIM_LEGACY !== data.TAU_CLAIM) {
      ctx.addIssue({
        code: 'custom',
        path: ['TAU_CLAIM'],
        message:
          'tauClaim 双源冲突：TAU_CLAIM 与 TAU_CLAIM_LEGACY 不一致。仅允许 TAU_CLAIM 为唯一配置源。',
      });
    }

    const scanPolicy = checkScanModeStartupPolicy(data.APP_ENV, data.INGEST_SCAN_MODE);
    if (scanPolicy) {
      ctx.addIssue({
        code: 'custom',
        path: ['INGEST_SCAN_MODE'],
        message: scanPolicy,
      });
    }

    for (const issue of stackEnvIssues(data)) {
      ctx.addIssue({
        code: 'custom',
        path: [issue.path],
        message: issue.message,
      });
    }
  });

export type WorkerEnv = z.infer<typeof EnvSchema>;

/** 可运行栈开关校验（单测可直接调） */
export function stackEnvIssues(data: {
  INGEST_ES_MODE: string;
  ELASTICSEARCH_URL?: string;
  STORAGE_MODE?: string;
  S3_ENDPOINT?: string;
}): Array<{ path: 'INGEST_ES_MODE' | 'STORAGE_MODE'; message: string }> {
  const issues: Array<{ path: 'INGEST_ES_MODE' | 'STORAGE_MODE'; message: string }> = [];
  if (data.INGEST_ES_MODE === 'http' && !(data.ELASTICSEARCH_URL ?? '').trim()) {
    issues.push({
      path: 'INGEST_ES_MODE',
      message: 'INGEST_ES_MODE=http requires ELASTICSEARCH_URL',
    });
  }
  if (data.STORAGE_MODE === 's3' && !(data.S3_ENDPOINT ?? '').trim()) {
    issues.push({
      path: 'STORAGE_MODE',
      message: 'STORAGE_MODE=s3 requires S3_ENDPOINT',
    });
  }
  return issues;
}

function resolveLocalStorageDir(dir: string): string {
  // 相对路径统一锚定 monorepo 根，避免 api/worker 不同 cwd 读写分裂
  if (path.isAbsolute(dir)) return dir;
  return path.resolve(monorepoRoot, dir);
}

function parseEnv(): WorkerEnv {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`[worker] env 校验失败:\n${details}`);
    process.exit(1);
  }
  return {
    ...result.data,
    STORAGE_LOCAL_DIR: resolveLocalStorageDir(result.data.STORAGE_LOCAL_DIR),
  };
}

export const env: WorkerEnv = parseEnv();
