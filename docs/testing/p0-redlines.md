# P0 业务红线必绿表

> SSOT 产品语义仍以 `prds/00–11` 为准。  
> 本表 = **本地合并前**可勾选、可自动化的 P0 测例清单（eng-review 修订版）。  
> 测例组织 HOW：`.trellis/spec/guides/testing.md`；全量导航：`docs/testing/README.md`。  
> 门禁命令：`pnpm check-types` && `pnpm test`（**不**强制远程 CI，见 D2）。

**来源：** office-hours design + `/plan-eng-review`（2026-08-07）

## 完成谓词

- R1–R10 每一行状态为 `PASS`（附 test 路径 + 含 `R#:` 的关键 `it` 标题）。
- 无新增 E2E 依赖、无覆盖率 KPI 门禁。
- R1–R10 **不**要求 `AUTH_ENFORCE` stub（API 中间件 enforce → 总 backlog **QUAL-1**）。

## 冻结表

| id | package | Given / When / Then | 期望观测 | 状态 | 证据路径 |
|----|---------|---------------------|----------|------|----------|
| R1 | web | stream `ready` 且无合法 final | view → `error` | PASS | `apps/web/src/hooks/use-knowledge-ask.test.ts` · `R1:` |
| R2 | web | mock abstain 终态 | `role=alert` 拒答，非普通答案 | PASS | `apps/web/src/components/ask-panel.test.tsx` · `R2:` |
| R3 | web | mapBizError 已知 code | 保留 code + message | PASS | `apps/web/src/lib/map-biz-error.test.ts` · `R3:` |
| R4 | web | clear / 坏 JSON / 无 token | `readClientSession()` → null（非 expires 产品闸） | PASS | `apps/web/src/auth/client-session.test.ts` · `R4:` |
| R5 | admin | `ApiHttpError(code,msg,shouldRefresh)` | `.code` / `.shouldRefresh` 字段保留 | PASS | `apps/admin/src/lib/http-error.test.ts` · `R5:` |
| R6 | admin | mapBizError | 同 R3 | PASS | `apps/admin/src/lib/map-biz-error.test.ts` · `R6:` |
| R7 | api | corpus 装载：未 ready∧active | 文档被滤出检索集 | PASS | `apps/api/src/services/retrieve/corpus.test.ts` · `R7:` |
| R8 | api | min 否决 | `abstained` / `unsupported_claims`，非 answered | PASS | `apps/api/src/graph/graph.test.ts` · `R8:` |
| R9 | api | 合法 draft 必经 verify；负向未完整 verify | 不得 answered | PASS | `apps/api/src/graph/graph.test.ts` · `R9:` |
| R10 | contracts+web | 共享 testing fixture | `AskResponseSchema.safeParse` + 拒答 UI 同工厂 | PASS | `packages/contracts` testing + ask-panel |

## 附录（只勾不补）

| 能力 | 证据 | 备注 |
|------|------|------|
| db 双就绪纯函数 | `packages/db/src/query/retrieval-gate.test.ts` | R7 生产锚在 api corpus；db 为底层 |
| admin 菜单 clip | `apps/admin/src/components/admin-shell.test.tsx` | 非 A1 必补 |
| worker 入库 | `apps/worker/src/ingest/pipeline.test.ts` | 非 A1 必补 |

## 约定

- 关键 `it` 标题含 `R#:`（同文件其它用例可不改）。
- 禁止实网；默认 mock。
- 共享 ask final 工厂：`@strict-rag/contracts/testing`。
- Follow-up（权威）：`.trellis/tasks/08-06-project-backlog/status.md`  
  - **QUAL-1**：`AUTH_ENFORCE=true` 无 Bearer → 401 自动化测  
  - **DEC-1**：客户端 `expiresAtMs` 过期闸（待产品确认）  
  - 红线过滤脚本：**不**进总表；见下方可选命令

## 本地门禁

```bash
pnpm check-types
pnpm test
```

### 可选：只跑红线 `it`（非门禁）

关键 `it` 标题约定含 `R#:`。合并前仍以全仓 type + test 为准。

```bash
pnpm --filter @strict-rag/web test -- -t 'R[0-9]+:'
pnpm --filter @strict-rag/admin test -- -t 'R[0-9]+:'
pnpm --filter @strict-rag/api test -- -t 'R[0-9]+:'
pnpm --filter @strict-rag/contracts test -- -t 'R[0-9]+:'
```
