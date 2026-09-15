# KB 消费绑定最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 77

## Question

补 P2 知识库消费绑定真空：PUT 可写 judge；设置页只手填 embed。这是本批唯一一张执行工单。

权威：[裁定上传表单标部门后下一步](./77-after-upload-dept-order.md)。上传表单标部门最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `PUT /knowledge-bases/:kbId/model-bindings` 用 `PutPlatformBindingsBodySchema`（含 judge / judge_aux 等）
- `replaceKbBindings` 先删该库全部行再插入 body
- admin 设置页仅 embed `Input`；保存 `{ bindings: { embed } }` 或 `{}`，会抹其它 purpose
- GET `/model-catalog` 要 `model.gateway.manage`

口径：

- KB 只可覆盖 **generate / embed / rerank**
- body 含其它 purpose（含 `judge` / `judge_aux` / `route` / `rewrite` / `claim_split`）→ **400** `VALIDATION_ERROR`
- 某 purpose 不出现 = **跟随平台**（该 purpose 不写行）
- PUT 仍整表替换该库消费绑定（只含允许的三 purpose）
- 类型闸仍走既有 `validatePlatformBindings`（embed→embedding，rerank→rerank，generate→llm）
- admin：三档 `ClosedSelect`（跟随平台 + 目录/当前 ref）；禁止新原生 `<select>`；禁止新手填 ModelRef
- 目录 GET 403：选项 = 跟随平台 + 当前已绑 ref
- 未改不提交绑定（与现 embed 行为一致：三档都未变则不 PUT）
- 不改平台 `PUT /admin/model-bindings`
- 不改 catalog 权限
- `isDefaultRetrievable` **不**改
- 测例禁止依赖墙钟、禁止真集群

### 做

- contracts：`KB_CONSUME_PURPOSES` + `PutKbConsumeBindingsBodySchema`（禁写非三 purpose）
- api：KB PUT 改用该 schema
- admin：设置页三档 ClosedSelect；保存发当前三档态
- 测例：
  - contracts：generate/embed/rerank 合法；judge 拒
  - api HTTP：KB PUT generate 200；judge 400 且不落行
  - admin：加载后可见三档；选 generate 覆盖后保存 PUT 不含 judge；跟随平台不进 map

### 不做

- 再认证 / 改 judge 平台绑定 / `GENERATE_MIN_NODES`
- 改 catalog 权限 / 平台绑定页
- paramSchema 动态表单
- fallbacks 多行编辑
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api directory-structure + contracts directory-structure + admin directory-structure；`docs/module-status/` api · admin · contracts。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/contracts/library/directory-structure.md`、`.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

KB 消费绑定最小闭环已落地。

- PUT `…/model-bindings` 只收 generate / embed / rerank；judge 等 400 且不落行。
- 某 purpose 不出现 = 跟随平台。
- admin 设置页三档 ClosedSelect；保存发当前三档态，不含 judge。
- 目录 403 时选项 = 跟随平台 + 当前已绑 ref。未改平台绑定页 / catalog 权限。

证据：`packages/contracts/src/system/model-gateway.contract.ts` · `apps/api/src/routes/kb-settings.ts` · `apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx` · `apps/api/tests/kb/kb-consume-bindings-http.test.ts` · `apps/admin/tests/ops/kb-settings-workspace.test.tsx`。

未 `task.py create`。未 push。

## Comments

- 2026-09-15 认领并在主分支执行。权威切边见 [裁定上传表单标部门后下一步](./77-after-upload-dept-order.md)。
