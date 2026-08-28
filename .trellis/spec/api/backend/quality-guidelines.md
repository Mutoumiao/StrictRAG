# api · 质量指南

## 运行时与栈（冻结）

- Node.js ≥ 20 + **Hono**  
- 日志：**Pino**  
- 校验：**Zod**（contracts + 本地 env）  
- ORM：仅经 `@strict-rag/db`  

## 必须遵守

| 规则 | 来源 |
|------|------|
| 禁止 route 内 SQL / ES DSL / 长 Prompt | 架构 PRD |
| 授权 **以码为准** | `requirePermission(code)`；禁止 `roles.includes` 单独放行 |
| 身份与授权分离 | 双 token / Better Auth 只证明身份；码在服务端求值 |
| access JWT | 必须带唯一 `jti`（同秒续签可区分） |
| refresh | 有状态 jti；replay → 吊销整 session |
| 契约 | TokenPair 在 `@strict-rag/contracts`；细节见 [auth-authorization](./auth-authorization.md) |
| ask `options` 白名单 | **仅** stream / debug / mode / locale；禁客户端改 tau 等 |
| ask `scope` | **顶层**可选字段（如 `scope.docTypes`）；**禁止**塞进 `options`（ADR-050） |
| UI ≠ API 授权 | handler **独立验码**；菜单有无改变不了 API |
| admin 壳 | 根中间件验 **`admin.shell`**；无码 → 403/302→web（ADR-045 经 **051** 修订） |
| 租户 | JWT 内 tenant_id，禁止只靠 body |
| 建库 | `POST /knowledge-bases` body **必填** `initialAdminUserId`，写入 `kb_members(role=admin)`；`tenantId` 只认令牌（无令牌时 `DEV_DEFAULT_TENANT`），**忽略** body 租户 |

> 壳准入 **不要**再写 `platform_admin` ∨ KB write/admin。  
> 权威：`prds/05-api` §1.2 · `prds/09-security` §3.5。工程 PRD §4 旧伪代码若未回写，以本表与安全/API PRD 为准。

## 以码为准（ADR-051）

| 规则 | 说明 |
|------|------|
| 求值 | 有效权限码 = 角色模板默认 ∪ grants − denies |
| 平台级 action | 要求对应 platform 码（如 `kb.create`、`user.manage`） |
| KB 内容 | 要求 **kb scope** 码；**`super_admin` 模板显式全权**（可免成员行，须审计） |
| 面板等 | 如 `dashboard.view` 等按安全 PRD 默认与授码 |
| 禁止 | 仅判断 `platform_role` / `kb_members.role` 字符串就放行，跳过 permission code |

码表与模板 SSOT：`@strict-rag/admin-catalog` + `prds/09-security`。

## 已落地阶段（勿回退）

| 阶段 | 能力 |
|------|------|
| P0 | health/ready · env · Pino · requestId · compose 依赖检查 |
| P1 | 入库 API · 审批/体积闸 · worker 入队 |
| S2 最小 | ask 图/SSE · 会话壳 · 反馈 · Gateway 切片 · 检索 mock · 观测骨架 |
| 08-11 | B2-W mode/docTypes · B3-W/B4-W · B12 策略 · B13 UI 闭环 · QUAL-1/3 · OPS-1 · B10 工程（**≠** 签字真跑） |

S2 / ask 细节见 [ask-pipeline](./ask-pipeline.md)。  
分片策略见 [chunk-strategies](./chunk-strategies.md)。  
L1 工程 seed 见 [l1-eval](./l1-eval.md)（**≠** 业务签字门禁）。  
扫描真引擎在 **worker** 侧安全债，勿在 api 宣称 QUAL-2 完成。
下一刀：按 backlog（B6/B8…）**新建** feature 任务；禁止宣称全文 Phase 2 / 生产 ES / L1 签字完成。

## 编码风格

- `type: module` · TypeScript strict  
- Prettier 仓库统一  
- 包依赖版本 `catalog:` / `workspace:*`  

## 测试红线（P0 · 可执行）

> 清单 SSOT：`docs/testing/p0-redlines.md`（R1–R10）。  
> 本地门禁：`pnpm check-types` && `pnpm test`。  
> **R1–R10 不要求** 测内 stub `AUTH_ENFORCE`（中间件 enforce → 总 backlog **QUAL-1**）。

| id | 锚点 | 断言要点 |
|----|------|----------|
| **R7** | `services/retrieve/corpus.ts` · `filterDocsForRetrieve` | 未 `ready∧active` **不得**进语料；测例 `tests/ask/ready-active-corpus.test.ts`（**生产装载路径**） |
| **R8** | `tests/ask/min-veto.test.ts` | 低分 claim → `abstained` / `unsupported_claims`，**非** answered |
| **R9** | graph verify | happy：合法 draft 经 verify；**负向**：未完整 verify（如 claim_split 失败）→ `status !== 'answered'` |

测例落点与文件头：[testing](../../guides/testing.md)。P0 证据路径以 `docs/testing/p0-redlines.md` 为准。

### Convention: 检索闸测钉生产路径（R7）

**What**：P0 R7 的 **PASS 主锚**是 api `filterDocsForRetrieve`（corpus 装载），不是单独的 db 纯函数测。

**Why**：`packages/db` 的 `isDefaultRetrievable` 绿 **拦不住** corpus 漏调/绕过；db 测仅作附录勾选。

```ts
// Good — R7 钉装载过滤
filterDocsForRetrieve([{ status: 'ready', lifecycle: 'draft', ... }]) // 不含该 id

// Bad — 只绿 db retrieval-gate 就标 R7 PASS，忽略 api 是否调用
```

### Convention: R9 禁止仅用 llmCalls 代理

**What**：happy 路径可 assert `debug.llmCalls === 3`（generate+claim_split+judge），但 **必须**另有负向：短路 verify 链不得 `answered`。

**Why**：多一次无意义 LLM 调用仍可能保持 `llmCalls===3` 形状；负向才锁「禁止未 verify 成功态」。

### Convention: 红线 it 标题

关闭 R7/R8/R9 的关键 `it` 标题含 `R7:` / `R8:` / `R9:`（同文件其它用例可不改）。

## 反模式

- **Bad**：为 demo 在 api 同步跑 embed 全流程占死事件循环  
- **Bad**：引入 Prisma  
- **Bad**：前端可调的 debug 开关关闭 verify  
- **Bad**：admin 壳用旧 ADR-045 role 公式  
- **Bad**：相对 `STORAGE_LOCAL_DIR` 依赖 api 进程 cwd（与 worker 分裂）  
- **Bad**：route 内展开 Prompt / ES DSL；rerank 失败仍 `answered`  
- **Bad**：`SESSION_REWRITE_ENABLED=true` 或把历史当 evidence  
- **Bad**：`RETRIEVE_ES_MODE=mock` 时对外说「生产 ES」  
- **Bad**：R7 只认 db 纯函数、不认 corpus 装载测  
- **Bad**：R9 仅 `llmCalls===3` 无负向「不得 answered」  
- **Bad**：L1 `mode=mock` 的 coverage/A–D 写入业务签字页或宣称「L1 门禁 PASS」  
- **Bad**：L1 批跑省略 `skipTrace`（污染 ask_traces）或 CI 强制 live 全量 LLM  
- **Bad**：把 `outcome=error` 塞进 A–D 扭曲覆盖率  
- **Good**：重活入队 worker；api 只做受理与查询；权限以码为准  
- **Good**：`STORAGE_LOCAL_DIR` 相对路径解析到 monorepo 根  
- **Good**：ask 走 `executeAsk` → `runAskGraph`；同步 DTO ≡ 流式 `data-ask-final`
- **Good**：GET list/query 用 contracts `*QuerySchema.safeParse`；非法 400
- **Good**：L1 复用 `eval/l1-matrix` + CLI `runL1Golden`；CI 钉纯函数/注入测（见 [l1-eval](./l1-eval.md)）
- **Bad**：自写 SSE 分帧 / 只推 `data-status` 无终态 final / 推未校验 text-delta 当答案
- **Bad**：contracts 已有 QuerySchema，route 仍手写 `Number(query)` / status if 链
