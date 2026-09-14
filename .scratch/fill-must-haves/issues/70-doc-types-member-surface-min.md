# 文档类型成员面最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 69

## Question

补 P2 文档类型成员面真空：无独立 `GET /doc-types`，成员读不到枚举；类型收窄后空集误标 `kb_not_ready`。这是本批唯一一张执行工单。

权威：[裁定删除与 purge 后下一步](./69-after-delete-purge-order.md)。删除与 purge 最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- 无 `GET /api/v1/knowledge-bases/:kbId/doc-types`
- `GET …/settings` 要 `kb.config.write`；`AskReasonSchema` 无 `no_docs_in_scope`
- `runRetrieve` 语料空一律 `kb_not_ready`（含类型收窄后空）
- web 类型为自由逗号输入，不读枚举

口径：

- `GET /knowledge-bases/:kbId/doc-types`；成员闸（与 ask-modes 同）；无 body
- 缺库 404；非成员 403；无令牌 401
- 响应 `{ items: [{ code, label }] }`；`label` 暂等于 `code`；空枚举 `items: []` 仍 200
- 不经此口回 τ / settings 其它字段
- `AskReason` 增 `no_docs_in_scope`
- retrieve：第一次 loadCorpus 空且 `scope.docTypes` 非空时，再 load 一次不带类型；无类型语料非空 → `no_docs_in_scope`；否则仍 `kb_not_ready`
- 无类型 scope 的空语料仍 `kb_not_ready`
- ACL 滤空不改 reason
- `isDefaultRetrievable` **不**改
- web：有枚举才出 ClosedSelect（含「不按类型收窄」）；选项只来自本次 GET；失败不挡提问、不传 scope；禁止原生 `<select>` 与逗号自由输入当主路径
- 测例禁止依赖墙钟、禁止真集群

### 做

- contracts：`KbDocTypesSchema`；`AskReasonSchema` 含 `no_docs_in_scope`
- api：GET doc-types；`reasonPresentation`；retrieve 空语料细分
- web：`getKbDocTypes`；AskPanel ClosedSelect
- 测例：
  - contracts：items 形状；reason 接受 `no_docs_in_scope`
  - api HTTP：成员 200 与 settings 枚举一致；空枚举 `[]`；非成员 403；缺库 404；无 τ
  - retrieve：无 scope 空语料仍 `kb_not_ready`；有类型且无类型再 load 非空 → `no_docs_in_scope`
  - 语料：`scope.docTypes` 仍在双闸之后滤（R7 主锚仍双闸文件）
  - web：有码列出关闭列表；选一类型后 body.scope.docTypes 为该码；空选项不写 scope；失败不挡提问

### 不做

- 类型分区增删改/排序/启用 CRUD
- 上传表单标部门 / MIME 白名单
- ES `doc_type` terms / dense 查询期 WHERE
- 多选勾选组（本张单选或不收窄）
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api directory-structure + ask-pipeline checklist + web directory-structure；`docs/module-status/` api · web · contracts。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/api/backend/ask-pipeline.md`、`.trellis/spec/web/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

文档类型成员面最小闭环已落地。

- `GET /knowledge-bases/:kbId/doc-types`：成员闸；`{ items: [{ code, label }] }`；`label` 等于 `code`；空枚举 `[]`；不回 τ。
- `AskReason` 含 `no_docs_in_scope`。retrieve：类型 scope 滤空且无类型语料非空 → `no_docs_in_scope`；无 scope 或双闸已空仍 `kb_not_ready`。
- web：有枚举才出 ClosedSelect；默认「不按类型收窄」；选一码写 `scope.docTypes`；失败不挡提问。
- `isDefaultRetrievable` 未改。设置 GET 仍要 `kb.config.write`。
- 未做类型分区 CRUD / 上传表单标部门 / ES `doc_type` terms / 多选勾选组 / BlockNote。

证据：`apps/api/src/routes/ask.ts` · `apps/api/src/services/retrieve/retrieve.ts` · `apps/web/src/components/ask-panel.tsx` · `apps/api/tests/ask/http-doc-types.test.ts` · `apps/api/tests/ask/retrieve-run.test.ts` · `apps/web/tests/ask/ask-doc-types.test.tsx`。

未 `task.py create`。未 push。

## Comments

- 2026-09-14 认领并在主分支执行。权威切边见 [裁定删除与 purge 后下一步](./69-after-delete-purge-order.md)。
