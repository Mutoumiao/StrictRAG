import { z } from 'zod';

/** 问答档位（ADR-054 / ask mode） */
export const AskModeSchema = z.enum(['strict', 'balanced', 'fast']);
export type AskMode = z.infer<typeof AskModeSchema>;

/** 默认允许档位 */
export const DEFAULT_ALLOWED_MODES: AskMode[] = ['strict', 'balanced', 'fast'];
export const DEFAULT_DEFAULT_MODE: AskMode = 'balanced';

/** KB 语料分级；缺省 / 旧行 = internal。sensitive 入池闸见 complete，≠ 已解禁 */
export const DataClassSchema = z.enum(['internal', 'sensitive']);
export type DataClass = z.infer<typeof DataClassSchema>;

/** GET 只读：质量 snapshot（禁止经 settings 写 τ） */
export const QualitySnapshotSchema = z.object({
  tauClaim: z.number().min(0).max(1),
  gatePackageId: z.string().nullable().optional(),
  effectiveAt: z.string().nullable().optional(),
});
export type QualitySnapshot = z.infer<typeof QualitySnapshotSchema>;

/** GET 只读：会话 rewrite 锁（P2 强制关） */
export const SessionRewriteLockSchema = z.object({
  enabledDefault: z.literal(false),
  locked: z.literal(true),
});
export type SessionRewriteLock = z.infer<typeof SessionRewriteLockSchema>;

/** GET …/knowledge-bases/:kbId/settings 成功 data */
export const KbSettingsSchema = z.object({
  kbId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  allowedModes: z.array(AskModeSchema).min(1),
  defaultMode: AskModeSchema,
  /** KB 允许的 doc_type 枚举；空数组 = 未限制（ask scope 任意） */
  docTypes: z.array(z.string().min(1).max(64)).max(32).default([]),
  /** 缺省 internal，旧 GET 无此字段仍 parse */
  dataClass: DataClassSchema.default('internal'),
  qualitySnapshot: QualitySnapshotSchema,
  sessionRewrite: SessionRewriteLockSchema,
});
export type KbSettings = z.infer<typeof KbSettingsSchema>;

/**
 * PATCH body 白名单（strict）。
 * 禁：tauClaim / crag* / allowDegradedGenerate / sessionRewrite* / retrieveK / route / 密钥等。
 */
export const PatchKbSettingsBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    allowedModes: z
      .array(AskModeSchema)
      .min(1)
      .refine((arr) => new Set(arr).size === arr.length, {
        message: 'allowedModes must be unique',
      })
      .optional(),
    defaultMode: AskModeSchema.optional(),
    /** 写入允许的 doc_type 列表；[] 表示清除限制 */
    docTypes: z.array(z.string().min(1).max(64)).max(32).optional(),
    dataClass: DataClassSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个可写字段' });

export type PatchKbSettingsBody = z.infer<typeof PatchKbSettingsBodySchema>;
