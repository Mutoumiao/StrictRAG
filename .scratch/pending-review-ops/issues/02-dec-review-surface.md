# 裁定：审阅面落点 · 发现路径 · 权限 · 审计

Type: grilling
Status: resolved
Blocked by: 01

## Question

按工单 01 的现状核清结果，逐条裁定（每条给**依据出处**，不改 `prds/00–11`）：

1. **发现路径**：运营从哪看到「有 `pending_review` 待审块」？
   - a) 复用文档页已读的**入库报告**区（`conflictPairs` 已带 `heldChunkId`）；
   - b) 新开 api 读端点「列 KB 内待审冲突」；
   - c) 文档列表加「待审」标志列。
   给出选择与理由；**明确哪些不做**。
2. **落点**：处置控件放哪（文档行展开详情内 / 报告区块内 / 独立页）？匹配 `prds/12-delivery-guides/03-功能地图.md` §4.3 的措辞（「文档页抽屉或同页」）。
3. **语义**：`winner='this'|'other'` 的运营文案怎么讲？`reindexRequired=true` 时前端怎么提示（不代跑 reindex）？处置后需要运营再做什么才算「上架生效」？
4. **权限**：沿用 `doc.editor`（既有端点）还是新增码？（默认沿用 → 但须确认 UI 显隐判据与 API 一致。）
5. **审计**：处置动作要不要加审计？若加，走 Pino（ARCH-P1b-2 口径）还是落表？（默认 Pino，除非 PRD 要求落表。）
6. **暴露面（簇 14）**：`GET …/ingest-jobs` 今天「成员即可读全量账本」是否收紧？收紧会改哪些调用点？**建议**：不改语义、只纠镜像，除非有 PRD 依据。
7. **不做清单**：本图明确不做的项（worker 自动处置 / 聚合指标 / 对方块侧面对话 / 跨文档运维面）。

## Answer

依据 = 工单 01 的现状核实（[`research/01-is-verify.md`](../research/01-is-verify.md)）。

### 1. 发现路径：复用文档页已读的**入库报告**（选 a）

**理由**：`IngestReportItem.conflictPairs` 里 `pending_review` 项**必带** `heldChunkId`（worker 写入端 `pipeline.ts:580-598`；契约层标可选是给 `skip_index` 项留的），而报告 DTO 已由 admin 的 `listIngestReports` 拉到手（`report.services.ts`）。今天 UI 只把 `otherDocId` 拼成一行文本、**不显示 `action` 与 `heldChunkId`**，所以运营**无法区分** `skip_index` 与 `pending_review` —— 缺的是**渲染与动作**，不是数据。

- **不新开 api 读端点**：全仓**无**「列待审冲突」读端点（01 已核），但数据已在手；新端点会引入新的暴露面（成员可见范围 / 分页 / 跨库）需要另一轮裁定，属**无生产者的半接线**。
- **不做 (c) 列表标志列**：要改 GET 列表契约加列，且报告区已能定位；牵动面更大、收益不增。

### 2. 落点：文档行展开详情内的**入库报告区块**

匹配 `prds/12-delivery-guides/03-功能地图.md` §4.3 的「文档页抽屉或同页」；同一区块已经渲染 `conflictPairs`，就地扩写的最小改动面。

### 3. 语义

- `winner='this'`（**本块为正牌**）：清 `duplicate_of`；本块下次 reindex 会进检索面 → 端点回 `reindexRequired=true`，UI **必须**提示「须对本文档发起 Reindex 才生效」，且**不代跑**（reindex 需 `doc.reindex`，端点刻意不替调用方升级权限）。
- `winner='other'`（**本块为重复**）：保留 `duplicate_of`，块继续不入 index → `reindexRequired=false`。
- 文案避免「删除 / 丢弃」，用「保留本块 / 保留对方块」，与端点只动两列的事实一致。

### 4. 权限：沿用 `doc.editor`（不新增码）

端点已是 `requirePermission('doc.editor')`（**始终**验，与 `AUTH_ENFORCE` 无关）+ 成员闸 `always`。UI 显隐判据与既有「保存」按钮同源（`me.permissions.includes('doc.editor')`），**不引入第二套判据**。

### 5. 审计：**本图不做**，单列一条债

处置动作今天**零审计**（不落表、`admin-write-audit.ts` 白名单不含该路径、路由内无 logger）。但白名单当前覆盖的是成员 / 审批 / 生命周期 / 平台 admin / KB 设置写；**同类不同待**：`PATCH /documents/:docId`（元数据写）与 `POST /documents/:docId/supersede`（状态迁移）同样不在内。只给 `resolve` 开一个口会造成同类路径口径分裂。**裁定**：本图只做「可见可办」；要不要把「文档内容处置类」整体纳入 Pino 写审计白名单，须先定「哪些路径属管理写」的口径 → 记入本图 `Not yet specified`。

### 6. 暴露面（簇 14）：**不改语义，只纠镜像**

`GET …/ingest-jobs` = `doc.view`（WhenEnforced）+ 成员闸 `whenEnforced`，成员可读该 doc 全部账本行（倒序、上限 20）。PRD `05-api` 未定义更细的暴露面；收紧属**产品取向**且无依据。**只做**：把 `worker.md` / `db.md` / `README.md` 里「无查询面 / 无查询 API」一类与源码不符的旧句按源码纠正（per-doc 只读已落、跨文档面仍未落）。

### 7. 不做清单

worker 自动处置 · 待审积压聚合指标 · 「对方块」侧面对话 / 跨库读面 · 跨文档运维查询面 · 审计落表 · 生产 LSH / 阈值调整 · 视觉回归（本机无浏览器）。

