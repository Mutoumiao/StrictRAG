# 裁定本图第一批执行顺序

Type: grilling
Status: resolved
Blocked by: 01

## Question

依据 [核定 §2.5.2 各 ID 在 HEAD 的真实缺口](./01-verify-gap-is.md) 的结果，裁定本图的第一批执行顺序：哪几张**直接动手**（无硬前置）、哪几张**必须先出决定**、哪几张应**划出范围**。

裁定须同时处理四个已知约束：

1. **映射表口径**：目标是清「缺口 ID」行，不是抬成熟度；「已做待测」的项按补测收口，不得写成新实现。
2. **门禁只加严不放宽**：任何为过测而放宽既有闸（`kbId` 过滤 / 成员闸 / min 否决 / 双就绪闸）的方案一律否决。
3. **QUAL-ACL-CAP 的存废**：前图裁定 103 已把 `allowedDocIds` 下调为雾（语义已冻但仓库无生产者，ES PRD 自标「可选」，客户端禁传）。它是仍做「入参闸」，还是随之下调为雾？须给理由。
4. **QUAL-G3 的存废**：前图裁定 93 记录过「功能表无此行」的观点。它是仍做「`gold.yaml` 审核闸」，还是划出？须给理由。

节奏可沿用前图的「一批 2–3 张串行 + 一张裁定票」模式。

答案要给出：**第一批的 2–3 张**（含各自前置）+ **本轮明确不做的项与理由** + **下一批的候选**（不必切细）。

## Answer

依据 [01 的复核](./01-verify-gap-is.md)（[gap-is-a](../research/gap-is-a.md) · [gap-is-b](../research/gap-is-b.md)），本图从「11 张实现票」收缩为下面的路线。

### 一批（串行三张 · 无硬前置 · 可直接开工）

1. **[QUAL-PLANE R4 + R10](./07-qual-plane-quota.md)**：`maxEmbedCalls` 配置存在时启动 warning 且行为 ≡ 无该字段；staging 缺配额时 warning + 安全默认。这两条是**真未做**（源码 0 命中），不需要先决定。R6（mock embed TPM）拆出另票。
2. **[QUAL-E5 补测](./11-qual-e5-contextualize-evidence.md)**：源码已满足剧本，补「故障 → 文档仍 ready」的**端到端**断言 + 5xx 单独注入。
3. **[QUAL-AA1 补测](./13-qual-aa1-kb-strategy-params.md)**：把「旧文档 chunk 边界 / version 不变」从代理断言升为**数据级**断言。

三张全为「不动默认开关、不加宽门禁」的收口型工单，任一张都不阻塞其余两张，串行只为一次只动一处。

### 立即关闭（判定见 01，本图不写新实现）

- **[QUAL-ACL-CAP](./06-qual-acl-cap.md) → 划出范围**：全仓无 `allowedDocIds` 生产者（10 处全是文档或负向测试，DB 无列，`retrieve` 无该 reason 出口）→ 实现等于造无生产者的半接线，与前图裁定 103 同口径。
- **[QUAL-G3](./14-qual-g3-gold-review-gate.md) → 划出范围**：`gold.yaml` 是静态手写 seed、全仓**无生成器**，功能表内「审核 / 提名」0 命中 → 没有可加闸的对象。
- **[QUAL-AC7](./12-qual-ac7-kb-judge-ban.md) → 已由前图 78 收口**：KB 绑定白名单对 `judge` 已返回 400 `VALIDATION_ERROR` 并有测。
- **[QUAL-AB8](./15-qual-ab8-strategy-dialog.md) → 已由前图 06 + 82 收口**：设置页「设置」已开 053 弹窗、保存走 PATCH 落审计、旧文档不变。残留 `chunk-strategy-panel.tsx:149-163` 一处原生 `<select>` 归**站规余量**（图上 Not yet specified 已记，非映射表缺口）。

### 需先出决定（雾已 graduate 成新票）

- 已在本图：[03 激活 version 表示](./03-dec-active-version.md) → 解锁 [09 L7](./09-qual-l7-orphan-clean.md)；[04 `pending_review`](./04-dec-pending-review.md) → 解锁 [10 E4](./10-qual-e4-pending-review.md)。
- 本批新开：[17 TENANT-Q 门禁口径](./17-dec-tenant-q-scope.md) · [18 K5 与超管旁路的关系](./18-dec-k5-trace-acl.md) · [16 签字包数据来源](./16-dec-signoff-package-source.md) · [19 embed TPM 口径（研究）](./19-research-embed-tpm.md)。

### 本轮明确不做

- 不为「已收口 / 登记滞后」的项写新实现充数。
- 不发明「高度重复」阈值、不发明白名单上限、不上生产 LSH。
- 不动任何默认开关（`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite / OCR / `INGEST_CONTEXTUALIZE_MODE`）。
- 不把「已具备最小 / 默认关」写成「生产已上」。
