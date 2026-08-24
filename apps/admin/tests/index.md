# @strict-rag/admin · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：运营壳与薄页交互。HTTP 闸、验码、入库状态机分别在 api / worker。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `shell/` | 壳准入、菜单裁剪、Guard | ADR-045/051 · `admin.shell` |
| `auth/` | 客户端 session、HttpError 字段 | P0 R5 |
| `error-map/` | 业务码文案 | P0 R6 |
| `ops/` | 文档/审批/设置/部门/面板薄页行为 | `prds/12-delivery-guides/04-交付控制台.md`（交互，非 API 真值） |
| `kb/` | 当前 KB 选择 | 壳下拉 / 粘贴 uuid |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `auth/client-session.test.ts` | admin session 必须与 web key 分轨，失败则两端会话互相覆盖。 | 双端 key 分轨 | `saveClientSession / readClientSession / clearClientSession` | 不写 web session key。 | 现行 |
| `auth/http-error-fields.test.ts` | ApiHttpError 必须保留 code 与 shouldRefresh，失败则刷新闸丢失字段。 | P0 R5 | `ApiHttpError` | 三参构造直断言字段。 | 现行 |
| `error-map/map-biz-error.test.ts` | 已知业务码映射后文案必须含 code，失败则运营页看不到可核对错误码。 | P0 R6 | `mapBizError` | 不透出 shouldRefresh。 | 现行 |
| `kb/current-kb.test.ts` | 当前 KB 选择必须读写 admin 独立 key，失败则污染 web 或选库丢失。 | 壳 KB 上下文 | `readStoredKbId / writeStoredKbId` | localStorage key。 | 现行 |
| `ops/approvals-workspace.test.tsx` | 审批页必须按码显隐操作入口，失败则无 decide 仍露出通过/驳回。 | 审批闸 UI | `ApprovalsWorkspace` | 不替代 api 闸测。 | 现行 |
| `ops/dashboard-workspace.test.tsx` | 数据面板无码须保持 403、有码才加载 summary，失败则指标页对无权限可见。 | B6 UI | `DashboardWorkspace` | 指标真值在 api。 | 现行 |
| `ops/departments-workspace.test.tsx` | 部门薄页必须按码显隐授权与归属入口，失败则无权限用户看到写操作。 | B5 UI | `DepartmentsWorkspace · grantVisibilityLabel / grantExpiresLabel` | ACL 真值在 api。 | 现行 |
| `ops/document-lifecycle.test.ts` | 文档生命周期入口闸必须按状态判断，失败则未就绪也可发布。 | complete/reindex 入口 | `canPublish / canRevertDraft` | 不测策略执行。 | 现行 |
| `ops/document-upload.test.ts` | 上传服务必须按 upload-url → PUT → complete 调用，失败则入口顺序错乱。 | 上传入口 | `uploadAdminDocument` | 体积闸真值在 api。 | 现行 |
| `ops/documents-workspace.test.tsx` | 文档列表薄页必须按码控制详情/保存/部门列，失败则运营交互与权限不符。 | 文档运营 UI | `DocumentsWorkspace · deptLabel / readyColLabel / visibilityLabel` | 部门列展示。 | 现行 |
| `ops/feedback-comment-escape.test.tsx` | 反馈 comment 含 `<script>` 必须当文本展示，不得插入 script 节点。 | K6 | `FeedbackWorkspace` | comment 走文本节点；负向断言 script 不增加。 | 现行 |
| `ops/kb-settings-services.test.ts` | 设置服务必须正确解析文档类型输入，失败则 PATCH 写出错误 docTypes。 | KB settings | `parseDocTypesInput` | 不写 URL。 | 现行 |
| `ops/kb-settings-workspace.test.tsx` | KB 设置薄页必须按 kb.config.write 显隐，未改勾选不得 PATCH 强制/继承。 | B2 设置 UI | `SettingsWorkspace` | mode 真值在 api。 | 现行 |
| `shell/auth-guard.test.tsx` | 无会话或无 admin.shell 必须跳转登录，失败则壳内页对无权限用户可见。 | admin.shell | `AdminAuthGuard` | mock 须持续 resolve。 | 现行 |
| `shell/menu-clip.test.tsx` | 菜单必须按权限码裁剪，失败则无码用户仍看到落地路由。 | ADR-056 clip | `AdminShell` | 非完整运营台。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
