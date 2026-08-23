# @strict-rag/contracts · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：Zod 形状与错误码短名。HTTP 接线在 api/web/admin。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | ask 请求/响应/options/scope、测试工厂 | `prds/05-api` · ADR-050 · P0 R10 |
| `ingest/` | 文档/分片/任务契约、分片策略枚举 | `prds/04-pipelines` · B12 |
| `kb/` | KB 设置形状 | B2 |
| `system/` | 部门、面板、模型网关、平台用户 | B3–B6 |
| `async/` | 入库任务 DTO | `prds/06-async` |

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 遗留（待迁）

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/ask/ask.contract.test.ts` | options 白名单；拒 tauClaim；scope 顶层 | ADR-050 · `prds/05-api` §1.1 | 形状 SSOT | 遗留 |
| `../src/ask/fixtures.test.ts` | answered/abstained 工厂可通过 schema | P0 R10 | `@strict-rag/contracts/testing` | 遗留 |
| `../src/ingest/chunk-strategy.test.ts` | 策略枚举与未实现 | B12 | | 遗留 |
| `../src/ingest/chunk.contract.test.ts` | 分片只读 DTO | ADR-052 | | 遗留 |
| `../src/ingest/document.contract.test.ts` | 文档 DTO | 入库 HTTP | | 遗留 |
| `../src/async/ingest-job.test.ts` | 任务 DTO | `prds/06-async` | | 遗留 |
| `../src/kb/kb-settings.contract.test.ts` | KB 设置形状 | B2 | | 遗留 |
| `../src/system/dashboard.contract.test.ts` | 面板 summary | B6 | | 遗留 |
| `../src/system/departments.contract.test.ts` | 部门 DTO | B5 | | 遗留 |
| `../src/system/dept-grants.contract.test.ts` | grant DTO | DEPT_ACL | | 遗留 |
| `../src/system/model-gateway.contract.test.ts` | 网关绑定 DTO | B3 | | 遗留 |
| `../src/system/platform-users-roles.contract.test.ts` | 平台用户角色 DTO | B4 | | 遗留 |
