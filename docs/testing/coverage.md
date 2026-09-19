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

登记日：2026-08-24（补测批次同日回写）· **2026-09-20**（回写 11 行过期标注 + 修四处汇总/行级计数矛盾 + 登记 23 行不可离线补的阻塞行 + 补掉最后 3 行 `缺测`：N2 / Z3 / C4 + S6 改判 `缺实现`）· **2026-09-20 第三轮**（批 2 补测：`部分测` → `已测` 17 行（ingest L1–L5 / L9 · M1 / M5 / M6 · Q1 / Q2 / Q5 / Q10 · V1 / V2 / V6 / V8；M2 / AA6 因 Then 仍有未断言的一截**保持 `部分测`**）· **K5 由 `缺实现` 改 `已测`** · **V4 由 `已测` 退回 `部分测`**（Then 后半「其后 M/L 链可绿」只有分段证据））· **2026-09-20 第四轮**（批 3 补测：acl **20 行** / ops **10 行** `部分测` → `已测`；**8 行保持 `部分测`**——acl 的 S3 / S5（读面 `doc.view` 口径冲突 / 成员角色粒度）、ops 的 G1 / G2 / O2 / T1 / T2 / T3（Then 仍有一截无法断言），剩余半截逐条写进各行「缺口」列）。数字须与分册**行级行数**一致，本表不按分册旧子表照抄。本表不是完成度 SSOT。

| 分册 | 步骤数 | 已测 | 部分测 | 缺测 | 缺实现 | 延后 | UAT |
|------|--------|------|--------|------|--------|------|-----|
| [ask](./coverage/00-ask.md) | 64 | 26 | 25 | 0 | 0 | 11 | 2 |
| [ingest](./coverage/01-ingest.md) | 53 | 34 | 14 | 0 | 1 | 4 | 0 |
| [acl](./coverage/02-acl.md) | 69 | 45 | 19 | 0 | 2 | 0 | 3 |
| [ops](./coverage/03-ops.md) | 93 | 40 | 18 | 0 | 3 | 23 | 9 |
| **合计** | **279** | **145** | **76** | **0** | **6** | **38** | **14** |

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

P2 必签的 `部分测` 仍多（行级合计 **76 行**）。补测时先信任环（A/D/F/H/K/U），再入库闸（L/M/V），再运营壳。不要按行级 `部分测` 全量机械铺开。

P2 必签**仍缺实现**的（不写假装测；仍挂 QUAL-* task）：M7→QUAL-2（真扫描引擎未接，无 5xx 重试矩阵）、P2→QUAL-PLANE（`validatePlatformBindings` 无 env 分档 warning）、R4 / R6-b→QUAL-PLANE（`env.ts` 无 `maxEmbedCalls` 字段；worker 无 ingest TPM）。**K5 已移出本清单**：审计口非成员 403 已测（`apps/api/tests/ask/http-audit.test.ts`），Langfuse 侧**无读取面** → 原 `缺实现` 改 `已测`（见 `00-ask.md` K5 行 · `status.md` §2.5.2 QUAL-K5）。

**本批已回写（2026-09-20，源码 + 测例可核对）**：原标 `部分测` → `已测`：E4 E5 Q4（ingest；**V4 已于第三轮退回 `部分测`**）；原标 `缺实现` → `已测`：V3 AA1（ingest）· O4 R10 AB8 AC7（ops）。L7（ingest）由 `缺实现` 改 `部分测`：清理 job 已落（failed 触发），剩「周期触发」无调度基建 + 真 ES 侧清理属 B8（`apps/worker/src/ingest/orphan-clean.ts:9`）。AD1–AD3 引导已测（wayfinder 启动引导超管）。

**第三轮（2026-09-20，批 2 补测 + 反向复核回收）**：`部分测` → `已测` 17 行——ingest **L1 L2 L3 L4 L5 L9**（双就绪对账 / ES 失败不外泄 / 重试恢复对账 / N+1 原子切换 / 账本链序 / embed→es_index 顺序）· **M1 M5 M6**（complete 体积闸 handler 路径 + Head 权威 + 预签名不替代）· **Q1 Q2 Q5 Q10**（needs_ocr 三面 / 文本层 PDF 到 ready / stage 与错误码分码 / 缺 OCR 不阻断启动）· **V1 V2 V6 V8**（complete 不入队 scan / 未审批不可检 / 伪造 ready 负向 / approve ≠ ready）。**退回 `部分测` 1 行**：`V4`（Then 后半「其后 M/L 链可绿」仍只有分段证据）。**保持 `部分测` 2 行**：`M2`（Then 末段「审计可查」仓内无落点）· `AA6`（Then 末段「检索用新切块」无测例）。另 **K5 `缺实现` → `已测`**（审计口非成员 403 已测；Langfuse 无读取面）。

**第四轮（2026-09-20，批 3 补测）**：`部分测` → `已测` **30 行**——acl **B1-2 B1-3 B1-5 B1-8 B1-A3**（read 打 upload-url/complete 403 · doc_operator 邀请/移除成员 403 且无副作用 · 超管非成员管库管文档 200 + 落 `admin_write` · approve/reject 403 · 他库 chunk 混入负向）· **S2 S8 S9**（六类写入口逐条 403 · 绕过壳仍 403 · web 无上传面且 API 403）· **Y2 Y3 Y5**（doc_operator complete 进 pending 不入队 scan · 同用户 approve 403 · 超管非成员列文档 200）· **W6 W8**（面板写路由 404 / 授 `dashboard.view` 后同一令牌 200）· **Z4 Z5 Z6 Z8**（点击才拉 body · 授 `chunk.view` 后 list/detail 200 · 显式历史 version 被忽略 · 薄页 RTL）· **AE1**（建树 + M 负责人 + E 主部门同一剧本）· **X2 X7**（hr scope answered citation 仅 hr · 场外 chunk 负向护栏）；ops **G3**（gold.yaml 写路径护栏）· **P6**（硬门无 `aux_*` + 类型层不可互赋）· **AB1 AB2 AB5 AB7**（六分区 · PATCH 后 ask 用新白名单 · 质量区只读 · doc-types 同 app 往返）· **AC6**（KB 选择进解析结果）· **AD5 AD9 AD10**（自定义角色并集 · 菜单无空壳 · Key 掩码 RTL）。

**保持 `部分测` 8 行**（剩余半截逐条写进各行「缺口」列，不许抹掉）：acl **S3**（读面 `doc.view` 与 Then「read 列文档可达」冲突，按现状记录待裁口径）· **S5**（`kb_members.role` 不参与写闸，只能按「库成员资格 + 码」断言）· ops **G1**（`feedback.ts` 不读轮次状态，负向「仅 abstained 可开单」无闸可断言，只补正例）· **G2**（无上传联动代码，「上传后关闭」无从断言）· **O2**（写侧落点超出批 3 允许范围，只补 api 查侧）· **T1 / T2 / T3**（纯函数与落盘裁决已断言，运行时加载 / 发布口仍无落点；`l1RerunBound` 以 `kbId && ranAt` 回退为真，使「无 evalRunId 即不得 bindable」不成立）。

**已划出（无实现对象 / 无口径，不作补测项）**：`B1-A4`（`allowedDocIds` 全仓无生产者；覆盖值仍记 `缺实现`）· `R4` / `R6-b`（无落点 / 无口径）。`G3` 已由批 3 的 `docs-guard/gold-review-guard.test.ts` 文件写路径护栏闭环（原「`gold.yaml` 是静态 seed、无生成器」不再是缺口）。

**不可离线补的阻塞行（登记在各分册「缺口」列，写明阻塞方 + 出处）**：真 ES / 真双节点 / 真进程 6 行（E1 E2 H5b H5d P1 AC4）；人签与 live 真跑 T4 + 签字剧 C1 C2 C3；**源码与 Then 不一致或源码无落点 16 行**（D-拼句 H1 H5e M8 S1 S4 Y6 X4 X5 R9 T6 V5 U8/J7c P3 AC2）——该组写「**源码侧待定**：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径」，**禁止**写成「待补测」。

## 附录

基建（`基建:`）与回归（`回归:`）测例**不进本表**，见各包 `tests/index.md`。  
仓库根 `scripts/*.test.mjs` 护脚本本身，见本目录 [README.md](./README.md)。
