# L1 业务黄金集 · RACI（B10-RACI）

> **挡业务签字页**：无本文件具名 owner + 题面审核记录，**不得**宣称 L1 **业务**签字完成。  
> **不挡**工程 task 关单 / mock dogfood。

| 字段 | 内容 |
|------|------|
| **路径** | `fixtures/l1/RACI.md`（与 `gold.yaml` 同目录，可归档） |
| **最近更新** | 2026-08-11 |

---

## 1. 具名 Owner

| 角色 | 姓名 / 账号 | 职责 |
|------|-------------|------|
| **业务 owner（A）** | mutou | 题面业务正确性；假前提/不可答边界；签字页业务侧确认 |
| **测试 owner（R）** | mutou | 跑批脚本、环境、2×2 归档；live profile 合规（见 OPS-1） |
| **工程（C）** | mutou / 后端 | gold 格式、CLI、`retrieve_mode` 门禁实现 |
| **产品（I）** | mutou | 知悉签字范围；DEC 未决不混入本集 |

> 单人项目可一人兼 A/R；多人时须改上表实名。**换人须改本文件日期并追加 §2 记录。**

---

## 2. 题面审核记录（可归档）

| 日期 | 审核人 | 范围 | 结论 | 备注 |
|------|--------|------|------|------|
| 2026-08-11 | mutou | `fixtures/l1/gold.yaml` seed 30 题（工程窗） | **工程 seed 通过**；**≠ 业务签字题面** | 业务签字规模见 B10-followup；真跑前须再审并补行 |

模板（追加一行即可）：

```text
| YYYY-MM-DD | <名> | gold / 扩集路径 | 通过 \| 驳回 | 说明 |
```

---

## 3. 业务签字页检查项（硬）

在宣称「L1 **业务**签字完成」前，须全部为是：

- [ ] §1 业务 owner、测试 owner **具名**（非空、非「TBD」）
- [ ] §2 至少一条 **业务题面**审核记录（日期+人+通过），覆盖签字用 gold
- [x] L1 报告 `retrieve_mode=live` 且 `signoffEligible=true`（OPS-1；2026-08-14 全量 ×2）
- [x] 规模满足 B10-followup（可答/不可答各≥30 真跑）；mock 数字 **未**写入本页
  - 注意：本跑 2×2 为 B=30 / D=30、coverage=0、reason=`internal_guard`（Gateway 空 URL → mock 生成）。**禁止**当业务成绩单；人签 + ADR-046 快照仍缺。

任一项否 → **拒绝**业务签字页绿灯。

---

## 4. 关联

| 文档 | 用途 |
|------|------|
| `fixtures/l1/README.md` | 工程 seed 说明 |
| `docs/ops/live-retrieve-profile.md` | live / mock 归因 |
| `08-06` §1.1 B10-RACI / B10-followup | 总 backlog |
