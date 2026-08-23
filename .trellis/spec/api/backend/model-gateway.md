# B3 · 模型供应商 + 平台 purpose 绑定（ADR-055 最小）

> 路径：`apps/api/src/routes/model-gateway.ts` · `services/model-gateway.ts`  
> 契约：`packages/contracts/src/system/model-gateway.contract.ts`  
> 表：`model_providers` · `model_bindings`（migration `0003_b3_model_gateway`）

## 1. Scope / Trigger

- 新建 admin 模型网关生产端 / 平台绑定 API  
- 跨层：contracts → db schema → api service/route → admin UI  
- **B3-W（已接线）**：ask 运行时 `getGatewayForTenant(tenant, kbId?)` = env + platform（+ **KB** 若有绑定行）经 `applyBindingsToGatewayConfig`  
- **QUAL-3（已接线）**：rerank 双节点链 + `RERANK_MIN_NODES`；全链失败 → 禁 `answered`

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

`tests/gateway/bindings-http.test.ts`：

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

## 8. Runtime resolve（B3-W）

| 符号 | 路径 | 说明 |
|------|------|------|
| `loadPlatformBindingSnapshot` | `gateway/bindings.ts` | 读 `model_bindings` scope=platform + providers；≤5s 缓存 |
| `applyBindingsToGatewayConfig` | `gateway/resolve.ts` | 单一 SSOT；DB primary → env 回退 |
| `getGatewayForTenant` | `gateway/client.ts` | ask `executeAsk` 主路径 |
| `bindingSource` | `GatewayConfig` | `env` \| `mixed` \| `db`；platform 叠 env 后为 **`mixed`**（`buildGatewayConfig` 恒 `env`，当前几乎不产出纯 `db`）；签字 profile **人审**禁「仅 env 绿灯」（§ docs/ops live §4.5）；**机读 `signoffEligible` 仅绑 retrieve live** |
| 缓存 | `bindings.ts` ≤5s snapshot + `client.ts` tenant client ≤5s | 双层；改绑后最多约 5s 可见；测用 `resetGatewayForTests` / `clearBindingCache` |
| DB 失败 | `getGatewayForTenant` `catch` | **回退 env**（不抛）；保证 ask 可继续；**不**自动改 `GATEWAY_MODE` |

**禁止**：第二套 purpose map；日志打印 `apiKey`/`apiKeyEnc`；静默把 mode 从 mock 改 http。

## 9. Rerank 双节点（QUAL-3）

| 键 / 符号 | 说明 |
|-----------|------|
| `RERANK_MIN_NODES` | 可选显式；**默认** dev/test=`1`，staging/production=`2`（`defaultRerankMinNodes`） |
| `GATEWAY_RERANK_FALLBACK_URL` | 第二节点 base；与 primary `GATEWAY_BASE_URL` 组成 `rerankEndpoints[]` |
| `buildGatewayConfig` | `http` 且 endpoints.length < min → **抛**（启动/构建失败 loud） |
| mock/http client | 按 endpoints 顺序试；primary 失败 → fallback；全失败 → `GatewayError` → `rerank_unavailable` |

### Validation

| 条件 | 行为 |
|------|------|
| staging/prod min=2 且仅 1 个 endpoint | 构建/解析抛错（禁「ADR N/A 冒充双节点」） |
| primary 失败、fallback 成功 | 返回分数；可记 `fallbackUsed` |
| 全链失败 | graph/ask → `abstained` + `rerank_unavailable`；**禁止** `answered` |

### Tests

`tests/gateway/resolve-mock.test.ts`：staging 单节点拒 · primary 失败 fallback 成功 · 全失败无假 answered；graph 层 `rerank_unavailable` 回归。

### Wrong vs Correct

```ts
// Wrong — 全失败静默跳过 rerank 仍 answered
// Correct — mapGatewayFailureToAskReason → rerank_unavailable → abstained
```

## 实现备注

- 测例注入 `createMemoryModelGatewayRepo`；runtime 单测见 `tests/gateway/resolve-mock.test.ts`  
- 租户：`auth.tenantId` 或 `DEV_DEFAULT_TENANT`  
- 日志：`model_provider_*` / `model_bindings_put`，**禁止**打 Key  
- 已做：platform 写 API · runtime platform+KB resolve（B3-W/B2-W）· QUAL-3 双节点  
- 未做：fetch-models 真代理、**admin KB 绑定写 UI**（schema/resolve 已支持）  

