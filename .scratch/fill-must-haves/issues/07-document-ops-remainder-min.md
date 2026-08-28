# 文档运营余量最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 06

## Question

在 [策略三层最小闭环](./06-strategy-three-layer-min.md) 落地之后，把文档列表补成 P2 运营最小面：Reindex 人选、类型标注、双轴运营标签、废止/归档。这是第二批第二张执行工单。

### 做

- **Reindex**：文档列表（或行展开）按钮；须 `doc.reindex`。可用策略 ≥2 必须先选再提交（走已落地的 `for-upload` / catalog）；API `POST …/documents/:id/reindex` 已有，本张接 UI + 选择规则。旧文档直到 reindex 才按新切块检索。
- **类型**：列表类型列；PATCH 标注 `docType`（码必须属于该 KB 已有枚举，否则 400）。不重做设置页类型分区 CRUD。现 `PatchDocumentMetaBodySchema` 只允许部门/可见级，按需要扩 `docType`（仍不改 lifecycle、不入队）。
- **双轴标签**：status × lifecycle **分列或组合标签**，映射运营标签（待审 / 处理中 / 需 OCR / 失败 / 就绪未发布 / **现行可问** / 已替代 / 已归档）。禁止合成一个模糊「状态」。原串可保留作次要信息。
- **lifecycle**：契约已含 `archived` / `superseded`；admin 现只有 `active` ↔ `draft`。补废止、归档动作（`doc.lifecycle`）。上架仍须 `status=ready`。检索闸仍 ready∧active，不自动升。
- **测例**：admin Reindex 人选（≥2 未选不可提交）；类型 PATCH 非法码 400；标签映射；归档/废止。api lifecycle 四态若缺测则补。
- 收工：skill `update-module-status`；08-06 **只补本行指针**，禁止平行 Trellis 实现任务。

写代码前读 `.trellis/spec/` 对应包（admin / api / contracts）。权威：功能表 §4.3。落点：`apps/admin/src/app/(ops)/documents/`、`apps/api/src/routes/documents/`、`packages/contracts/src/ingest/document.contract.ts`。

### 明确不做

- 生效区间（更像检索过滤，后批）
- DELETE、替代联动（写 `supersedesDocId` / 旧文自动 superseded）
- 上传标部门
- 类型分区排序/启用/逐条 CRUD
- 独立 `GET /doc-types`
- 在线编写、入库报告、策略审计展示
- 策略三层表与 catalog HTTP（上一张）
- 评测、ask 审计、web 消费、检索补钉

## Answer

文档运营余量最小闭环已落地。

- **Reindex**：行展开按钮（`doc.reindex`）；≥2 走 for-upload 人选，未选不可提交；仅 1 个可自动。API 已有，本张接 UI。
- **类型**：列表类型列；PATCH `docType` 须属于该 KB 枚举（空枚举只能清 null），否则 400。不重做类型分区 CRUD。
- **双轴标签**：运营列映射待审 / 处理中 / 需 OCR / 失败 / 就绪未发布 / 现行可问 / 已替代 / 已归档；原串 `status · lifecycle` 次要。
- **lifecycle**：补废止 / 归档；上架仍须 `status=ready` 且仅 draft。检索闸不自动升。
- **测例**：contracts PATCH/列表 docType；api 非法码 400 + 四态 HTTP；admin 标签映射、Reindex ≥2、归档按钮。
- **08-06**：只补指针。未 `task.py create`。

未做：生效区间、DELETE、替代联动、上传标部门、类型分区 CRUD、GET /doc-types、在线编写、入库报告、策略审计展示。

## Comments

- 2026-08-28 按图顺序认领本工单并执行。不开启裁定第三批 P2 执行顺序。
- 2026-08-28 落盘如上。
