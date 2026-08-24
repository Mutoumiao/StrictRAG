# 阶段流程覆盖目录

> **角色**：验收剧本步骤 → 自动化证据的**派生对照**。  
> **不是**产品语义 SSOT（仍是 `prds/00–11`）；**不是**完成度 SSOT（仍是源码 + `docs/module-status/`）；**不是**存货闸（仍是各包 `tests/index.md`）。  
> **期望原文**：[`prds/10-delivery/03-acceptance-scenarios.md`](../../prds/10-delivery/03-acceptance-scenarios.md)  
> **合并 10 条**：[`p0-redlines.md`](./p0-redlines.md)（本表不展开 R1–R10）  
> **HOW**：`.trellis/spec/guides/testing.md` §1.1

冲突采信：**源码 > module-status > 本表 > index 叙事**。禁止用本表宣称「P2 已测全」或抬成熟度。

## 读法

1. 默认只扫 **P2 必签** 且覆盖为 `缺测` / `部分测` 的行——那是下一批补测清单。
2. `延后` / `缺实现` / `UAT` **不是**欠债清单：阶段未到、代码未做、或本来就是人签/部署。
3. 「同能力目录有文件」≠ 已测。必须断言覆盖该步骤的 Then。
4. mock 路径不得标成生产 ES / 真杀毒已测。

## 覆盖值（闭集）

| 值 | 含义 |
|----|------|
| **已测** | 有自动化证据，断言对应该步骤期望 |
| **部分测** | 只盖住切片；缺口列写清缺哪条 Then |
| **缺测** | 源码已具备，无对应能力测 |
| **缺实现** | PRD 要求但源码未做；禁止写假装测 |
| **延后** | 明确非本阶段（P3 / P2.5 开 rewrite / P4 等） |
| **UAT** | 人工签字 / 部署检查表 / 恢复演练 |

形态：`单测` · `注入` · `契约` · `文档护栏` · `UAT` · `部署检查表`

## 分册

| 分册 | 剧本 | 表 |
|------|------|----|
| ask | A · D · F · H · K · U · J | [coverage/00-ask.md](./coverage/00-ask.md) |
| ingest | E · L · M · Q · V · AA | [coverage/01-ingest.md](./coverage/01-ingest.md) |
| acl | B · S · Y · W · Z · AE · X | [coverage/02-acl.md](./coverage/02-acl.md) |
| ops | C · G · N · O · P · R · T · AB · AC · AD · I | [coverage/03-ops.md](./coverage/03-ops.md) |

## 未编号步骤的稳定 ID

剧本里已有 `B1-1`、`H5f`、`D-拼句` 的沿用。无编号的步骤用下表，**不另发明产品语义**。

| 剧本 | ID |
|------|-----|
| A | A1 建 KB；A2 成员+上传就绪；A3 库内题 answered；A4 库外题拒答 |
| C | C1 黄金集 2×2；C2 τ 扫描；C3 Judge 校准；C4 Hit@k；C5 签字页 |
| D | D1 寒暄 chitchat；D2 制度题不得 chitchat；D-拼句；D-fast；D3 库外假前提；D4 P2 必有 verify；D5 P3 极弱检索；D6 全非法 citation；D7 P3 multi_hop；D8 预算耗尽；D-F1…D-F7 |
| E | E1 ready+active 可查；E2 supersede；E3 删除/archived；E4 近重复；E5 L1 故障 L0 回退；E6 无 active → 409 |
| F | F1 四真一假整答拒答；F2 citations∈evidence；F3 历史 requestId 仍有 snapshot |
| G | G1 missing_doc 开单；G2 管理员闭环；G3 提名黄金集须审核 |

## 汇总

登记日：2026-08-24（补测批次同日回写）。数字须与分册行数一致。本表不是完成度 SSOT。

| 分册 | 步骤数 | 已测 | 部分测 | 缺测 | 缺实现 | 延后 | UAT |
|------|--------|------|--------|------|--------|------|-----|
| [ask](./coverage/00-ask.md) | 64 | 24 | 26 | 0 | 1 | 11 | 2 |
| [ingest](./coverage/01-ingest.md) | 53 | 10 | 29 | 0 | 6 | 8 | 0 |
| [acl](./coverage/02-acl.md) | 69 | 22 | 37 | 2 | 1 | 4 | 3 |
| [ops](./coverage/03-ops.md) | 93 | 19 | 24 | 1 | 16 | 24 | 9 |
| **合计** | **279** | **75** | **116** | **3** | **24** | **47** | **14** |

`延后` / `缺实现` / `UAT` 不是欠债清单。P2 必签 `缺测` 本批已补（2026-08-24）；剩余 `缺测` 为建议项 S6/Z3 与部署检查表 N2。下一批优先信任环上的 `部分测`。

`缺实现` 调度：总 backlog [§2.5.2](../../.trellis/tasks/08-06-project-backlog/status.md) · HOW [research/coverage-gap-impl.md](../../.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md)。禁止假绿。

### P2 必签 · 缺测（已关闭本批）

不含建议项（S6、Z3）、不含部署检查表（N2）。

| ID | 分册 | 本批 |
|----|------|------|
| H3 H4 H7 K4 K6 | ask | 已测 |
| M3 Q3 | ingest | 已测 |
| V5 | ingest | 部分测（reject+禁 scan；可重提 API 未做） |
| Y4 Z7 X3 | acl | 已测 |
| O1 R1–R3 T7 | ops | 已测 |
| AD3 | ops | 部分测（跳过重种子；补码 → QUAL-SUPER-BOOT） |

P2 必签的 `部分测` 仍多。补测时先信任环（A/D/F/H/K/U），再入库闸（L/M/V），再运营壳。不要按 116 行机械铺开。

P2 必签但 **缺实现** 的（不写假装测；已挂 QUAL-* task）：K5→QUAL-K5、E4→QUAL-E4、E5→QUAL-E5、L7→QUAL-L7、V3→QUAL-V3、AA1→QUAL-AA1、B1-A4→QUAL-ACL-CAP、O4→QUAL-TENANT-Q、AD1/AD2/AD3 补码→QUAL-SUPER-BOOT、R4–R10→QUAL-PLANE、G3→QUAL-G3、AB8→QUAL-AB8、AC7→QUAL-AC7。M7 仍归 QUAL-2。详见各分册。

## 附录

基建（`基建:`）与回归（`回归:`）测例**不进本表**，见各包 `tests/index.md`。  
仓库根 `scripts/*.test.mjs` 护脚本本身，见本目录 [README.md](./README.md)。
