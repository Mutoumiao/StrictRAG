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
| E | E1 ready+active 可查；E2 supersede；E3 删除/archived；E4 近重复；E5 L1 故障 L0 回退；E6 无 active → 200 拒答 |
| F | F1 四真一假整答拒答；F2 citations∈evidence；F3 历史 requestId 仍有 snapshot |
| G | G1 missing_doc 开单；G2 管理员闭环；G3 提名黄金集须审核 |

## 汇总

登记日：2026-08-24（补测批次同日回写）· **2026-09-20**（回写 11 行过期标注 + 修四处汇总/行级计数矛盾 + 登记 23 行不可离线补的阻塞行 + 补掉最后 3 行 `缺测`：N2 / Z3 / C4 + S6 改判 `缺实现`）。数字须与分册**行级行数**一致，本表不按分册旧子表照抄。本表不是完成度 SSOT。

| 分册 | 步骤数 | 已测 | 部分测 | 缺测 | 缺实现 | 延后 | UAT |
|------|--------|------|--------|------|--------|------|-----|
| [ask](./coverage/00-ask.md) | 64 | 25 | 25 | 0 | 1 | 11 | 2 |
| [ingest](./coverage/01-ingest.md) | 53 | 18 | 30 | 0 | 1 | 4 | 0 |
| [acl](./coverage/02-acl.md) | 69 | 25 | 39 | 0 | 2 | 0 | 3 |
| [ops](./coverage/03-ops.md) | 93 | 30 | 28 | 0 | 3 | 23 | 9 |
| **合计** | **279** | **98** | **122** | **0** | **7** | **38** | **14** |

`延后` / `缺实现` / `UAT` 不是欠债清单。P2 必签 `缺测` **已清零**（2026-08-24 补一批；2026-09-20 补掉最后三行：N2 · Z3 · C4，另 S6 经复核**改判 `缺实现`** —— 源码侧确无按当前 KB 角色裁菜单，见 `02-acl.md` 该行）。下一批优先信任环与运营壳上的 `部分测`。

`缺实现` 调度：总 backlog [§2.5.2](../../.trellis/tasks/08-06-project-backlog/status.md) · HOW [research/coverage-gap-impl.md](../../.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md)。禁止假绿。

### P2 必签 · 缺测（已关闭本批）

不含建议项（S6、Z3）、不含部署检查表（N2）—— 这三行已于 2026-09-20 处理：**Z3 已补测** · **N2 已补测** · **S6 改判 `缺实现`**（源码侧无按当前 KB 角色裁菜单）。

| ID | 分册 | 本批 |
|----|------|------|
| H3 H4 H7 K4 K6 | ask | 已测 |
| M3 Q3 | ingest | 已测 |
| V5 | ingest | 部分测（reject+禁 scan；可重提 API 未做） |
| Y4 Z7 X3 | acl | 已测 |
| O1 R1–R3 T7 | ops | 已测 |
| AD1 AD2 AD3 | ops | 已测（引导函数；createApp 不跑；≠ 密码登录） |

P2 必签的 `部分测` 仍多。补测时先信任环（A/D/F/H/K/U），再入库闸（L/M/V），再运营壳。不要按 116 行机械铺开。

P2 必签**仍缺实现**的（不写假装测；仍挂 QUAL-* task）：K5→QUAL-K5（Langfuse 默认关，无非成员读 trace 的明文 ACL）、M7→QUAL-2（真扫描引擎未接，无 5xx 重试矩阵）、P2→QUAL-PLANE（`validatePlatformBindings` 无 env 分档 warning）、R4 / R6-b→QUAL-PLANE（`env.ts` 无 `maxEmbedCalls` 字段；worker 无 ingest TPM）。

**本批已回写（2026-09-20，源码 + 测例可核对）**：原标 `部分测` → `已测`：E4 E5 V4 Q4（ingest）；原标 `缺实现` → `已测`：V3 AA1（ingest）· O4 R10 AB8 AC7（ops）。L7（ingest）由 `缺实现` 改 `部分测`：清理 job 已落（failed 触发），剩「周期触发」无调度基建 + 真 ES 侧清理属 B8（`apps/worker/src/ingest/orphan-clean.ts:9`）。AD1–AD3 引导已测（wayfinder 启动引导超管）。

**已划出（无实现对象 / 无口径，不作补测项）**：`B1-A4`（`allowedDocIds` 全仓无生产者；覆盖值仍记 `缺实现`）· `G3`（`gold.yaml` 是静态 seed、无生成器；运营表回流已部分测）· `R4` / `R6-b`（无落点 / 无口径）。

**不可离线补的阻塞行（登记在各分册「缺口」列，写明阻塞方 + 出处）**：真 ES / 真双节点 / 真进程 6 行（E1 E2 H5b H5d P1 AC4）；人签与 live 真跑 T4 + 签字剧 C1 C2 C3；**源码与 Then 不一致或源码无落点 16 行**（D-拼句 H1 H5e M8 S1 S4 Y6 X4 X5 R9 T6 V5 U8/J7c P3 AC2）——该组写「**源码侧待定**：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径」，**禁止**写成「待补测」。

## 附录

基建（`基建:`）与回归（`回归:`）测例**不进本表**，见各包 `tests/index.md`。  
仓库根 `scripts/*.test.mjs` 护脚本本身，见本目录 [README.md](./README.md)。
