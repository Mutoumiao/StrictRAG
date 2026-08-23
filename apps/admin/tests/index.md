# @strict-rag/admin · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：运营壳与薄页交互。HTTP 闸、验码、入库状态机分别在 api / worker。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与验收剧本。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `shell/` | 壳准入、菜单裁剪、Guard | ADR-045/051 · `admin.shell` |
| `auth/` | 客户端 session、HttpError 字段 | P0 R5 |
| `error-map/` | 业务码文案 | P0 R6 |
| `ops/` | 文档/审批/设置/部门/面板薄页行为 | `prds/12-delivery-guides/04-交付控制台.md`（交互，非 API 真值） |
| `kb/` | 当前 KB 选择 | 壳下拉 / 粘贴 uuid |

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 待处理

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/lib/http-error.test.ts` | ApiHttpError 保留 code / shouldRefresh | P0 R5 | 三参构造直断言字段 | 待处理 |
| `../src/lib/map-biz-error.test.ts` | 已知码文案含 code | P0 R6 | 不透出 shouldRefresh | 待处理 |
| `../src/lib/kb-context.test.ts` | 当前 KB 选择读写 | 壳 KB 上下文 | localStorage key | 待处理 |
| `../src/auth/client-session.test.ts` | admin session 隔离 web key | 双端 key 分轨 | 不写 web session key | 待处理 |
| `../src/components/auth-guard.test.tsx` | 无壳权限跳转登录 | `admin.shell` | mock 须持续 resolve | 待处理 |
| `../src/components/admin-shell.test.tsx` | 菜单按码裁剪 | ADR-056 clip | 非完整运营台 | 待处理 |
| `../src/app/(ops)/approvals/_components/approvals-workspace.test.tsx` | 审批页显隐与操作入口 | 审批闸 UI | 不替代 api 闸测 | 待处理 |
| `../src/app/(ops)/documents/_components/documents-workspace.test.tsx` | 文档列表薄页 | 文档运营 UI | 部门列展示 | 待处理 |
| `../src/app/(ops)/documents/lifecycle.services.test.ts` | 文档生命周期服务调用 | complete/reindex 入口 | 不测策略执行 | 待处理 |
| `../src/app/(ops)/documents/upload.services.test.ts` | 上传服务调用 | 上传入口 | 体积闸真值在 api | 待处理 |
| `../src/app/(ops)/kb/settings/_components/settings-workspace.test.tsx` | KB 设置薄页 | B2 设置 UI | mode 真值在 api | 待处理 |
| `../src/app/(ops)/kb/settings/services.test.ts` | 设置服务调用 | KB settings | 不写 URL | 待处理 |
| `../src/app/(ops)/departments/_components/departments-workspace.test.tsx` | 部门薄页 | B5 UI | ACL 真值在 api | 待处理 |
| `../src/app/(ops)/dashboard/_components/dashboard-workspace.test.tsx` | 面板只读展示 | B6 UI | 指标真值在 api | 待处理 |
