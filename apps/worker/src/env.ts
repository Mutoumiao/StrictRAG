import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

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
    /** mock_clean | mock_infected | on */
    INGEST_SCAN_MODE: z.enum(['mock_clean', 'mock_infected', 'on']).default('mock_clean'),
    /** mock | fail — mock ES 失败路径验证 ADR-038 */
    INGEST_ES_MODE: z.enum(['mock', 'fail']).default('mock'),
    INGEST_EMBED_MODE: z.enum(['mock', 'fail']).default('mock'),
    INGEST_MIN_EXTRACTED_CHARS: z.coerce.number().int().positive().default(40),
    STORAGE_LOCAL_DIR: z.string().default('.data/objects'),
    S3_BUCKET: z.string().default('strict-rag'),
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
  });

export type WorkerEnv = z.infer<typeof EnvSchema>;

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
