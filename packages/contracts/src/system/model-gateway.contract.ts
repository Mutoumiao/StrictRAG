import { z } from 'zod';

/** 模型类型（ADR-055） */
export const ModelTypeSchema = z.enum(['llm', 'embedding', 'rerank']);
export type ModelType = z.infer<typeof ModelTypeSchema>;

/** 供应商预设 */
export const ModelPresetKeySchema = z.enum(['deepseek', 'ollama', 'custom']);
export type ModelPresetKey = z.infer<typeof ModelPresetKeySchema>;

/** Provider 下单模型 */
export const ModelItemSchema = z.object({
  name: z.string().min(1).max(200),
  type: ModelTypeSchema,
  enabled: z.boolean().default(true),
  dimensions: z.number().int().positive().optional(),
});
export type ModelItem = z.infer<typeof ModelItemSchema>;

/**
 * ModelRef：`providerId#modelName`
 * 禁止含第二个 # 歧义（name 内允许 # 时仅按首个 # 切分）。
 */
export const ModelRefSchema = z
  .string()
  .min(3)
  .refine((v) => {
    const i = v.indexOf('#');
    return i > 0 && i < v.length - 1;
  }, { message: 'ModelRef must be providerId#modelName' });
export type ModelRef = z.infer<typeof ModelRefSchema>;

/** 平台 / 消费端 purpose（本切片平台绑定用） */
export const BindingPurposeSchema = z.enum([
  'generate',
  'claim_split',
  'judge',
  'judge_aux',
  'embed',
  'rerank',
  'route',
  'rewrite',
]);
export type BindingPurpose = z.infer<typeof BindingPurposeSchema>;

export const PLATFORM_BINDING_PURPOSES = BindingPurposeSchema.options;

/** GET 公开 Provider（永不含 apiKey） */
export const ModelProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  presetKey: ModelPresetKeySchema,
  baseUrl: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  enabled: z.boolean(),
  notes: z.string().nullable().optional(),
  models: z.array(ModelItemSchema),
  hasApiKey: z.boolean(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

const modelsNonEmptyUnique = z
  .array(ModelItemSchema)
  .min(1, '至少配置一个模型')
  .refine((arr) => new Set(arr.map((m) => m.name)).size === arr.length, {
    message: 'models[].name must be unique',
  });

/** POST body（可含只写 apiKey） */
export const CreateModelProviderBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    presetKey: ModelPresetKeySchema,
    baseUrl: z.string().min(1).max(2000),
    apiKey: z.string().min(1).max(2000).optional(),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
    enabled: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
    models: modelsNonEmptyUnique,
  })
  .strict();
export type CreateModelProviderBody = z.infer<typeof CreateModelProviderBodySchema>;

/** PATCH body（strict；apiKey 只写） */
export const PatchModelProviderBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    presetKey: ModelPresetKeySchema.optional(),
    baseUrl: z.string().min(1).max(2000).optional(),
    apiKey: z.string().min(1).max(2000).nullable().optional(),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
    enabled: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
    models: modelsNonEmptyUnique.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个可写字段' });
export type PatchModelProviderBody = z.infer<typeof PatchModelProviderBodySchema>;

export const ModelProviderPresetSchema = z.object({
  key: ModelPresetKeySchema,
  label: z.string(),
  defaultBaseUrl: z.string(),
  supportsFetchModels: z.boolean(),
});
export type ModelProviderPreset = z.infer<typeof ModelProviderPresetSchema>;

export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    key: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    supportsFetchModels: false,
  },
  {
    key: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://127.0.0.1:11434',
    supportsFetchModels: false,
  },
  {
    key: 'custom',
    label: '自定义 OpenAI 兼容',
    defaultBaseUrl: '',
    supportsFetchModels: false,
  },
];

/** 单 purpose 绑定 */
export const PurposeBindingSchema = z.object({
  primary: ModelRefSchema,
  fallbacks: z.array(ModelRefSchema).optional(),
});
export type PurposeBinding = z.infer<typeof PurposeBindingSchema>;

/** GET 平台绑定 map（键为 purpose 字符串） */
export const PlatformBindingsSchema = z.record(z.string(), PurposeBindingSchema);
export type PlatformBindings = Partial<Record<BindingPurpose, PurposeBinding>>;

/** PUT 平台绑定 body：部分或全部 purpose；未知 purpose 拒绝 */
export const PutPlatformBindingsBodySchema = z
  .object({
    bindings: z
      .record(z.string(), PurposeBindingSchema)
      .superRefine((obj, ctx) => {
        for (const key of Object.keys(obj)) {
          if (!BindingPurposeSchema.safeParse(key).success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `invalid purpose: ${key}`,
              path: [key],
            });
          }
        }
      }),
  })
  .strict();
export type PutPlatformBindingsBody = {
  bindings: Partial<Record<BindingPurpose, PurposeBinding>>;
};

/** 已启用模型池（无凭证） */
export const ModelCatalogItemSchema = z.object({
  ref: ModelRefSchema,
  providerId: z.string().uuid(),
  providerName: z.string(),
  modelName: z.string(),
  type: ModelTypeSchema,
});
export type ModelCatalogItem = z.infer<typeof ModelCatalogItemSchema>;

/** purpose → 所需 model type */
export function requiredModelTypeForPurpose(purpose: BindingPurpose): ModelType {
  if (purpose === 'embed') return 'embedding';
  if (purpose === 'rerank') return 'rerank';
  return 'llm';
}

export function parseModelRef(ref: string): { providerId: string; modelName: string } | null {
  const i = ref.indexOf('#');
  if (i <= 0 || i >= ref.length - 1) return null;
  return { providerId: ref.slice(0, i), modelName: ref.slice(i + 1) };
}

export function formatModelRef(providerId: string, modelName: string): string {
  return `${providerId}#${modelName}`;
}
