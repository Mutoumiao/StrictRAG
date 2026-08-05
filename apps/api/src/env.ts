import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// 优先 monorepo 根 .env，再包内 .env
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(monorepoRoot, '.env') });
loadDotenv();

const AppEnvSchema = z.enum(['development', 'test', 'staging', 'production']);

/**
 * API 进程环境变量（Zod 校验，失败快速退出）。
 * 密钥仅服务端；tauClaim 唯一源：`TAU_CLAIM`。
 */
const EnvSchema = z
  .object({
    APP_ENV: AppEnvSchema.default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
    REDIS_URL: z.string().min(1, 'REDIS_URL 不能为空'),
    /** 声明验证唯一门槛（服务端配置；禁止客户端覆盖） */
    TAU_CLAIM: z.coerce.number().min(0).max(1).default(0.5),
    /**
     * 若误设旧名/第二源，须与 TAU_CLAIM 完全一致，否则启动失败。
     * 正常部署应只设 TAU_CLAIM，不设本字段。
     */
    TAU_CLAIM_LEGACY: z.coerce.number().min(0).max(1).optional(),
    GATEWAY_BASE_URL: z.string().optional().default(''),
    GATEWAY_API_KEY: z.string().optional().default(''),
    /**
     * mock | http；空=按 BASE_URL 推断（有 URL→http，否则 mock）。
     * CI/单测默认无 BASE_URL → mock。
     */
    GATEWAY_MODE: z.enum(['mock', 'http', '']).optional().default(''),
    GATEWAY_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    /** 同模型 maxAttempts（含首跳）；ADR-032 默认 2 */
    GATEWAY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
    GATEWAY_CHAT_MODEL: z.string().optional().default('gpt-4o-mini'),
    GATEWAY_EMBED_MODEL: z.string().optional().default('text-embedding-3-small'),
    GATEWAY_RERANK_MODEL: z.string().optional().default('bge-reranker-v2-m3'),
    /** mock 向量维；http 以上游返回为准 */
    GATEWAY_EMBED_DIMS: z.coerce.number().int().positive().default(8),
    /** rerank 第二节点（staging/prod RERANK_MIN_NODES=2 时需要） */
    GATEWAY_RERANK_FALLBACK_URL: z.string().optional().default(''),
    /**
     * rerank 链最小节点数：dev/test 默认 1；staging/production 默认 2。
     * 显式设置可覆盖。
     */
    RERANK_MIN_NODES: z.coerce.number().int().positive().optional(),
    ELASTICSEARCH_URL: z.string().optional().default(''),
    /**
     * 检索 sparse 适配：mock=PG chunk 文本替身；http=真 ES（B8，未实现）。
     * 默认 mock，与 P1 INGEST_ES_MODE 精神一致。禁止无 B8 时宣称生产 ES。
     */
    RETRIEVE_ES_MODE: z.enum(['mock', 'http']).default('mock'),
    /** 上传默认上限 50 MiB；硬天花板 200 MiB（ADR-039） */
    INGEST_MAX_FILE_BYTES: z.coerce.number().int().positive().default(52_428_800),
    INGEST_MAX_FILE_BYTES_CEILING: z.coerce.number().int().positive().default(209_715_200),
    /** local mock 对象存储目录（P1 无 RustFS 时） */
    STORAGE_MODE: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('.data/objects'),
    S3_ENDPOINT: z.string().optional().default(''),
    S3_ACCESS_KEY: z.string().optional().default(''),
    S3_SECRET_KEY: z.string().optional().default(''),
    S3_BUCKET: z.string().default('strict-rag'),
    /**
     * 身份 JWT。
     * 接入 Better Auth 后可弃用签发，仍可暂时兼容校验。
     */
    JWT_ACCESS_SECRET: z.string().min(16).default('dev-only-access-secret-change-me'),
    JWT_REFRESH_SECRET: z.string().min(16).default('dev-only-refresh-secret-change-me'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(604_800),
    /**
     * true：文档/KB 业务路由走 requirePermissionWhenEnforced（须 Bearer + 权限码）。
     * false：放行无鉴权（demo-ingest 默认）。
     */
    AUTH_ENFORCE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /**
     * 会话近窗 rewrite（ADR-047）。P2 **强制 false**；
     * 误设 true → 启动失败（U8 配置拒绝）。
     */
    SESSION_REWRITE_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.INGEST_MAX_FILE_BYTES > data.INGEST_MAX_FILE_BYTES_CEILING) {
      ctx.addIssue({
        code: 'custom',
        path: ['INGEST_MAX_FILE_BYTES'],
        message: 'INGEST_MAX_FILE_BYTES 不得超过天花板 INGEST_MAX_FILE_BYTES_CEILING',
      });
    }
    // U8：P2 无 L2 不得开启 rewrite
    if (data.SESSION_REWRITE_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_REWRITE_ENABLED'],
        message:
          'P2 禁止 SESSION_REWRITE_ENABLED=true（ADR-047 / SESSION_REWRITE_DISABLED）。P2.5+ L2 准出后再开。',
      });
    }
    if (data.TAU_CLAIM_LEGACY !== undefined && data.TAU_CLAIM_LEGACY !== data.TAU_CLAIM) {
      ctx.addIssue({
        code: 'custom',
        path: ['TAU_CLAIM'],
        message:
          'tauClaim 双源冲突：TAU_CLAIM 与 TAU_CLAIM_LEGACY 不一致。仅允许 TAU_CLAIM 为唯一配置源。',
      });
    }
    if (data.APP_ENV === 'production') {
      if (!data.DATABASE_URL || data.DATABASE_URL.includes('strict_rag:strict_rag@')) {
        ctx.addIssue({
          code: 'custom',
          path: ['DATABASE_URL'],
          message: 'production 禁止使用默认本地凭证',
        });
      }
      if (
        data.JWT_ACCESS_SECRET.includes('dev-only') ||
        data.JWT_REFRESH_SECRET.includes('dev-only')
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_ACCESS_SECRET'],
          message: 'production 禁止使用默认 JWT 密钥',
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof EnvSchema>;

function resolveLocalStorageDir(dir: string): string {
  // 相对路径统一锚定 monorepo 根，避免 api/worker 不同 cwd 读写分裂
  if (path.isAbsolute(dir)) return dir;
  return path.resolve(monorepoRoot, dir);
}

function parseEnv(): ApiEnv {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`[api] env 校验失败:\n${details}`);
    process.exit(1);
  }
  return {
    ...result.data,
    STORAGE_LOCAL_DIR: resolveLocalStorageDir(result.data.STORAGE_LOCAL_DIR),
  };
}

export const env: ApiEnv = parseEnv();

/** 对外 Health/Ready 的 env 枚举 */
export function toHealthEnv(appEnv: ApiEnv['APP_ENV']): 'development' | 'test' | 'staging' | 'production' {
  return appEnv;
}
