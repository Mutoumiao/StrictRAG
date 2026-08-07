# B3 · 模型供应商 + 平台 purpose 绑定（ADR-055 最小）

> 路径：`apps/api/src/routes/model-gateway.ts` · `services/model-gateway.ts`  
> 契约：`packages/contracts/src/system/model-gateway.contract.ts`  
> 表：`model_providers` · `model_bindings`（migration `0003_b3_model_gateway`）

## 1. Scope / Trigger

- 新建 admin 模型网关生产端 / 平台绑定 API  
- 跨层：contracts → db schema → api service/route → admin UI  
- **本切片不**改 Gateway 运行时 resolve（仍 env）

## 2. Signatures

```http
GET/POST   /api/v1/admin/model-providers
GET/PATCH/DELETE /api/v1/admin/model-providers/:id
GET    /api/v1/admin/model-providers/presets
GET/PUT /api/v1/admin/model-bindings
GET    /api/v1/model-catalog
```

权限：**始终** `requirePermission('model.gateway.manage')`（platform scope，无 kb 成员闸）。

## 3. Contracts

| 资源 | 要点 |
|------|------|
| Provider GET | `hasApiKey`；**禁止** `apiKey` 字段 |
| POST/PATCH | 可含 `apiKey` 只写；models ≥1 且 name 唯一 |
| ModelRef | `providerId#modelName` |
| Binding PUT | `{ bindings: { [purpose]: { primary, fallbacks? } } }` |
| Catalog | 仅 enabled provider ∩ enabled model；无凭证 |

Purpose → 类型：`embed→embedding` · `rerank→rerank` · 其余 chat 类 → `llm`。

## 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无 `model.gateway.manage` | 403 | FORBIDDEN |
| body Zod 失败 | 400 | VALIDATION_ERROR |
| provider 不存在 | 404 | NOT_FOUND |
| embed 绑 llm 等类型错 | 400 | VALIDATION_ERROR |
| judge 与 judge_aux 同 ModelRef | 400 | VALIDATION_ERROR |
| DELETE 仍被平台绑定引用 | 400 | VALIDATION_ERROR |
| 未知 ModelRef / 已禁用 | 400 | VALIDATION_ERROR |

## 5. Good / Base / Bad

- **Good**：super_admin 建 Provider（含 Key）→ 列表 `hasApiKey:true` 无明文 → 绑 generate/embed/rerank  
- **Base**：空 bindings `{}` 清空平台绑定  
- **Bad**：kb_admin 调 API；GET 响应出现 apiKey；judge≡judge_aux

## 6. Tests Required

`routes/model-gateway.test.ts`：

- 无码 403  
- POST 201 + 密钥不回显  
- PATCH 保留/更新 Key  
- 类型闸 + ADR-042  
- DELETE 引用闸  
- catalog 过滤 disabled  
- presets 三件套  

## 7. Wrong vs Correct

#### Wrong
```ts
return ok(c, { ...row, apiKey: row.apiKeyEnc }); // 泄露
```

#### Correct
```ts
return ok(c, toPublicProvider(row)); // hasApiKey only
```

## 实现备注

- 测例注入 `createMemoryModelGatewayRepo`  
- 租户：`auth.tenantId` 或 `DEV_DEFAULT_TENANT`  
- 日志：`model_provider_*` / `model_bindings_put`，**禁止**打 Key  
- 未做：fetch-models 真代理、Gateway 读 DB、KB bindings  
