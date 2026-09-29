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

登记日：2026-08-24（补测批次同日回写）· **2026-09-20**（回写 11 行过期标注 + 修四处汇总/行级计数矛盾 + 登记 23 行不可离线补的阻塞行 + 补掉最后 3 行 `缺测`：N2 / Z3 / C4 + S6 改判 `缺实现`）· **2026-09-20 第三轮**（批 2 补测：`部分测` → `已测` 17 行（ingest L1–L5 / L9 · M1 / M5 / M6 · Q1 / Q2 / Q5 / Q10 · V1 / V2 / V6 / V8；M2 / AA6 因 Then 仍有未断言的一截**保持 `部分测`**）· **K5 由 `缺实现` 改 `已测`** · **V4 由 `已测` 退回 `部分测`**（Then 后半「其后 M/L 链可绿」只有分段证据））· **2026-09-20 第四轮**（批 3 补测：acl **20 行** / ops **10 行** `部分测` → `已测`；**8 行保持 `部分测`**——acl 的 S3 / S5（读面 `doc.view` 口径冲突 / 成员角色粒度）、ops 的 G1 / G2 / O2 / T1 / T2 / T3（Then 仍有一截无法断言），剩余半截逐条写进各行「缺口」列）· **2026-09-21 第五轮**（wayfinder 图 `p3b-doc-acl` 收口：acl **10 行** `部分测` → `已测`——B2-1（ask 端到端泄漏）· B2-3（绕过闸喂全量语料的反向构造）· AE4 AE5 AE6 AE7 AE8 AE10 AE11 AE12（ask 端到端 + grant 串联 + 审计专断言）；**B2-2 保持 `部分测`**）· **同轮修正一处**：本表 acl 行原写 45 / 19 与分册第四轮的 46 / 18 差 1（S5 改判未同步到本表），本轮按行级机械重数为准。数字须与分册**行级行数**一致，本表不按分册旧子表照抄。本表不是完成度 SSOT。

| 分册 | 步骤数 | 已测 | 部分测 | 缺测 | 缺实现 | 延后 | UAT |
|------|--------|------|--------|------|--------|------|-----|
| [ask](./coverage/00-ask.md) | 64 | 30 | 21 | 0 | 0 | 11 | 2 |
| [ingest](./coverage/01-ingest.md) | 53 | 34 | 14 | 0 | 1 | 4 | 0 |
| [acl](./coverage/02-acl.md) | 69 | 58 | 6 | 0 | 2 | 0 | 3 |
| [ops](./coverage/03-ops.md) | 94 | 41 | 18 | 0 | 3 | 23 | 9 |
| **合计** | **280** | **163** | **59** | **0** | **6** | **38** | **14** |

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

P2 必签的 `部分测` 仍多（行级合计 **59 行**）。补测时先信任环（A/D/F/H/K/U），再入库闸（L/M/V），再运营壳。不要按行级 `部分测` 全量机械铺开。

P2 必签**仍缺实现**的（不写假装测；仍挂 QUAL-* task）：M7→QUAL-2（真扫描引擎未接，无 5xx 重试矩阵）、P2→QUAL-PLANE（`validatePlatformBindings` 无 env 分档 warning）、R4 / R6-b→QUAL-PLANE（`env.ts` 无 `maxEmbedCalls` 字段；worker 无 ingest TPM）。**K5 已移出本清单**：审计口非成员 403 已测（`apps/api/tests/ask/http-audit.test.ts`），Langfuse 侧**无读取面** → 原 `缺实现` 改 `已测`（见 `00-ask.md` K5 行 · `status.md` §2.5.2 QUAL-K5）。

**本批已回写（2026-09-20，源码 + 测例可核对）**：原标 `部分测` → `已测`：E4 E5 Q4（ingest；**V4 已于第三轮退回 `部分测`**）；原标 `缺实现` → `已测`：V3 AA1（ingest）· O4 R10 AB8 AC7（ops）。L7（ingest）由 `缺实现` 改 `部分测`：清理 job 已落（failed 触发），剩「周期触发」无调度基建 + 真 ES 侧清理属 B8（`apps/worker/src/ingest/orphan-clean.ts:9`）。AD1–AD3 引导已测（wayfinder 启动引导超管）。

**第三轮（2026-09-20，批 2 补测 + 反向复核回收）**：`部分测` → `已测` 17 行——ingest **L1 L2 L3 L4 L5 L9**（双就绪对账 / ES 失败不外泄 / 重试恢复对账 / N+1 原子切换 / 账本链序 / embed→es_index 顺序）· **M1 M5 M6**（complete 体积闸 handler 路径 + Head 权威 + 预签名不替代）· **Q1 Q2 Q5 Q10**（needs_ocr 三面 / 文本层 PDF 到 ready / stage 与错误码分码 / 缺 OCR 不阻断启动）· **V1 V2 V6 V8**（complete 不入队 scan / 未审批不可检 / 伪造 ready 负向 / approve ≠ ready）。**退回 `部分测` 1 行**：`V4`（Then 后半「其后 M/L 链可绿」仍只有分段证据）。**保持 `部分测` 2 行**：`M2`（Then 末段「审计可查」仓内无落点）· `AA6`（Then 末段「检索用新切块」无测例）。另 **K5 `缺实现` → `已测`**（审计口非成员 403 已测；Langfuse 无读取面）。

**第四轮（2026-09-20，批 3 补测）**：`部分测` → `已测` **30 行**——acl **B1-2 B1-3 B1-5 B1-8 B1-A3**（read 打 upload-url/complete 403 · doc_operator 邀请/移除成员 403 且无副作用 · 超管非成员管库管文档 200 + 落 `admin_write` · approve/reject 403 · 他库 chunk 混入负向）· **S2 S8 S9**（六类写入口逐条 403 · 绕过壳仍 403 · web 无上传面且 API 403）· **Y2 Y3 Y5**（doc_operator complete 进 pending 不入队 scan · 同用户 approve 403 · 超管非成员列文档 200）· **W6 W8**（面板写路由 404 / 授 `dashboard.view` 后同一令牌 200）· **Z4 Z5 Z6 Z8**（点击才拉 body · 授 `chunk.view` 后 list/detail 200 · 显式历史 version 被忽略 · 薄页 RTL）· **AE1**（建树 + M 负责人 + E 主部门同一剧本）· **X2 X7**（hr scope answered citation 仅 hr · 场外 chunk 负向护栏）；ops **G3**（gold.yaml 写路径护栏）· **P6**（硬门无 `aux_*` + 类型层不可互赋）· **AB1 AB2 AB5 AB7**（六分区 · PATCH 后 ask 用新白名单 · 质量区只读 · doc-types 同 app 往返）· **AC6**（KB 选择进解析结果）· **AD5 AD9 AD10**（自定义角色并集 · 菜单无空壳 · Key 掩码 RTL）。

**第五轮（2026-09-21，wayfinder 图 `p3b-doc-acl`）**：`部分测` → `已测` **10 行**——acl **B2-1**（真实语料装载 → 模型硬引用被挡文档 → `abstained`，答文 / citations / evidence 均不含；同夹具下可见文档仍 `answered`）· **B2-3**（反向构造：绕过可见性闸喂全量语料时被挡文档确实被召回）· **AE4 AE5 AE6 AE7 AE8 AE10 AE11 AE12**（ask 端到端：KB 覆盖开强制下的祖先继承 / 负责人级别 / 无归属 / grant 串联 / ES 收窄与 PG 语料同源 / 关继承 / 下级不看上级；AE7 另补授权写入的两条审计专断言）。**保持 `部分测` 1 行**：acl **B2-2**（缺口只剩角色码 principal 与须真 ES 的「reindex 覆盖旧 principals」半截；自动 reindex 已裁定为人工触发，不再是欠债）。

**第六轮（2026-09-23，wayfinder 图 `quality-gate-parity`）**：**无行级覆盖值变化**（ops 的 T 行仍 3 已测 / 5 部分测 / 2 延后），只改证据与缺口文字 —— ops **T4** 的证据从「覆盖 >0 即可业务 PASS」换成「五项实测全达标 → 业务 PASS」加「缺测即不得 PASS」的反例（旧断言钉的「未测 = 合格」已按 `prds/08-quality/02-evaluation-and-gates.md` §6 硬门表改写）；**T1** 补上试点常量与 τ* 门限的双写一致性断言。**判据来源一个字未改**：PRD 的门限数字没动，改的是「代码有没有真按它判」。同轮新增三条债并记在 `docs/module-status/api.md`：人工抽检无入口无登记面 · 校准规模实际 8 题对 PRD 的 ≥100 · L2 其余三项零容忍与 `historyLeaked` 的比对宽度（其中第一条已由第七轮清掉）。

**第七轮（2026-09-23，wayfinder 图 `l1-signoff-evidence`）**：**无行级覆盖值变化**（四册合计仍 279 / 156 已测 / 65 部分测 / 0 缺测 / 6 缺实现 / 38 延后 / 14 UAT），只改证据与缺口文字 —— ops **C3** 的证据补上「打分器来源三态进判定（判定只认 live、mock 只打印）」与「PRD §4 规模门 ≥100 进判定（reason 与缺测可分辨）」；ops **C4 / T3 / T6** 同步源码改后的行号、**T4** 由「五项实测」改「六项实测」（PRD §6 表的六项硬门；常量 7 键，人工抽检占条数与错数两键）；ops 分册计数补「第五轮」一段。镜像侧把上一轮记的三条债里的第一条（人工抽检无登记面）改成真相：**已有文件账本登记面（`HumanSpotLedgerSchema`）+ CLI `--human-spot` + 进 `businessPass`**，并新增两条债（真 judge live 跑数缺、≥100 真标注校准集缺 · worker 生产路径不传抽检账本）；能力矩阵「观测 / 评测」行的「人工抽检无登记面 —— 七项硬门里唯一没有数据源的一项」同步改写为「已有文件账本登记面并进判定」。**判据来源一个字未改**：PRD 的门限数字没动，改的是「有没有数据源 + 有没有真按它判」。

**第八轮（2026-09-23，wayfinder 图 `l2-report-determinability`）**：**唯一一次行级变化 = ops 剧本 C 新增派生行 `L2`**（`部分测`）—— 四册合计由 **279**（156 已测 / 65 部分测 / 0 缺测 / 6 缺实现 / 38 延后 / 14 UAT）改为 **280**（156 / **66** / 0 / 6 / 38 / 14），ops 由 93 改 **94**（40 已测 / **19** 部分测）。该行由 PRD 剧本 J 的 P2.5 通过条件「**L2 报告归档**」与角色范围「P2.5：J-P2.5 + **L2**」支撑，登记本轮图工单 03 / 04 / 05 落地的 10 文件 / 65 条 it 与七条缺口（工程绿 ≠ 准出 · `docHitRate` 未映射恒 0 · 四项零容忍 5 处去处只有 **1 处**机械判 · 两个版本键恒 `null` · 夹具 18 条 / `near_coref` 3 条 · 区块与 `repro` 不透 DTO · §8 L2 侧通用字段未落）。**其余四册的所有行、覆盖值与既有轮次叙述一个字未改**；`prds/08-quality` §6.2 / §8 的门限与字段表未动，改的只是「报告里能不能读出判据原料」——`computeL2SignoffEligible` 公式与取值域**一字未动**，本图**没有**为任何记债项开口子。

**第九轮（2026-09-24，wayfinder 图 `acceptance-divergence`）**：把上一批名单里**源码与 Then 不一致或源码无落点 16 行**逐行裁定收口（归属：**已测 7**（`D-拼句` `H1` `U8` `J7c` `S4` `X4` `AC2`）· 保留 `部分测` **9**（`S1` `Y6` `H5e` `M8` `V5` `X5` `R9` `T6` `P3`）），**覆盖值净变化 = `已测` +7 / `部分测` −7**，四册合计由 **280**（156 / 66）改为 **280**（**163** / **59**）——**ask** `26/25` → **`30/21`**（`D-拼句` `H1` `U8` `J7c` 由 `部分测` 改 `已测`；`H5e` 保留并改写缺口列）· **acl** `56/8` → **`58/6`**（`S4` `X4` 改 `已测`；`S1` / `Y6` 保留并记**同一条债**；`X5` 口径精确化）· **ops** `40/19` → **`41/18`**（`AC2` 改 `已测`；`R9` / `T6` / `P3` 保留并写明归属与销账条件）· **ingest 无覆盖值变化**（`M8` / `V5` 仍 `部分测`，只改缺口列并补专断言）。**判据来源一个字未改**：PRD 的 Then 措辞与门限没动，改的是「覆盖表怎么记这 16 行」——7 行按 Then 的**许可 / 析取**措辞（「可带」「可为 … 或」「或」）或**新版 ADR 前提**判为源码已满足，覆盖表此前按「必须」记成缺口属**镜像偏严**；9 行逐条写明**真债**与销账条件。**本轮唯一一处源码改动**：`apps/api/src/graph/route-rules.ts` 把 route source 取值域对齐 **ADR-033 观测四元**（`rule` → `rule_chitchat` / `rule_knowledge`；`llm` 不预置），属第三类「**冻结契约缺口**」——爆炸面已量清（生产点仅此一处；上下游 `state.ts` / `ask.contract.ts` 均宽松类型；既有断言**零处**断言 `rule`），收口报告已显式声明这是**行为可见的契约对齐**（既非收紧亦非逐位等价）。**新增测例证据**：**1 个新文件** `apps/worker/tests/ingest/scan-infected-no-residue.test.ts`（`M8` 无残留 / 无隔离区专断言）+ **5 条新增 `it`**（ask `route-rules.test.ts` 2 条 · api `reject-http.test.ts` 1 条 · admin `auth-guard.test.tsx` 2 条）。**剩余 9 行是真债，一条都不假装绿**：`S1` / `Y6` 壳的**服务端硬拦截未落地**（403 / 302→web 须先动会话载体，须 ADR）· `H5e` debug / maintenance **档位在 P2 无面**且被 ADR-030/034 与运维手册明文禁止 · `M8` **审计 sink**（hash + uploaderId + timestamp）无落点 · `V5` `rejected→pending` **重提端点契约未定义** · `X5` 查询期 `doc_type` filter 须**真 ES（B8）** · `R9` worker 入库 embed **无指标打点** · `T6` **运行时签字包加载口**撞 ADR-007 · `P3` **抽样链**（`online_sample`）未落地。**本轮没有为任何记债项开口子**：一处源码对齐 + 5 条新 `it` 全部是**收紧或逐位等价**，无删断言 / 无 `it.skip` / 无放宽门禁；§6.0 与 ADR-007 未动、`prds/00–11` 一个字未改。

**第十轮（2026-09-29，wayfinder 图 `real-stack-evidence`）**：**无行级覆盖值变化**（四册合计仍 280 / 163 已测 / 59 部分测 / 0 缺测 / 6 缺实现 / 38 延后 / 14 UAT）。本轮把「**离线不可验证**」这个前提本身拿去验：在本机真起 compose 五服务（PG · Redis · ES 8.15.3 · Mongo · RustFS），真 PG 上从零 apply 迁移（SQL 文件 23 = journal 23 = 已应用 23；`db:generate` 零漂移），端到端入库在真 RustFS + 真 Mongo + **真 ES** 上跑通。**两处源码缺陷只在真集群上现形，本轮修掉**：① `bulkIndexSparse` 未等 ES 刷新即对账 → 文档被误写 `status=failed` / `errorCode=ES_RECONCILE_FAILED`（mock ES 是进程内 set 比对，**永不暴露**），改 `POST /_bulk?refresh=wait_for` 并补测例 `apps/worker/tests/ingest/es-bulk-refresh-before-reconcile.test.ts`；② `scripts/smoke-half.mjs` 用同一主体自审，撞 ADR-048 #4 四眼闸（403 `self_approve_forbidden`），改为「先断言自审必 403，再换 `kb_admin` 主体审批」。**两行缺口列改写（覆盖值一律不动）**：ingest **E1** 的阻塞方由「真 ES 部署」改判为「仓内可重复的真 ES 集成测位」——真 ES 上已真跑到「入库后按正文中文术语检索命中该 doc 的 chunk」；acl **X5** 的阻塞方**不是环境**——查询期 `doc_type` filter 在源码里根本不存在，真 ES 也验不出一条不存在的 filter，且**不构成泄漏**（`retrieve.ts` 在 sparse 命中后立刻与 PG 语料求交），代价是超集排序挤占 top-k 的**召回损失**。**判据来源一个字未改**：PRD 的 Then 措辞与门限未动。**ask 段仍是真债**：`GATEWAY_MODE=http` 要求上游**同时**提供 chat / embeddings / **rerank** 三条契约，本机无可用 Gateway（本机 Ollama 有 embedding 与 rerank 模型、**无对话模型**，且不暴露 `/rerank`）→ 烟测在 ask 一步按 `half-smoke.md` 既定口径因空引用失败。证据 [real-stack-evidence.md](../ops/real-stack-evidence.md)。

**当前保持 `部分测` 的行**（剩余半截逐条写进各行「缺口」列，不许抹掉）：acl **B2-2 · S1 · S3 · Y6 · X5 · X6**（S1 / Y6 为「**乙（实质）+ 债**」——壳准入只认 `admin.shell`、壳不可用成立，但**服务端硬拦截（403 / 302→web）未落地**，销账条件见该行「缺口」列；X5 为「**丁**」——净效果由装载层 + sparse 事后求交保证，查询期 `doc_type` filter 须真 ES（B8）；S3 为读面 `doc.view` 口径冲突；X6 为 P2.x UI 的 RTL 缺口）· ops **G1**（`feedback.ts` 不读轮次状态，负向「仅 abstained 可开单」无闸可断言，只补正例）· **G2**（无上传联动代码，「上传后关闭」无从断言）· **O2**（写侧落点超出批 3 允许范围，只补 api 查侧）· **T1 / T2 / T3**（纯函数与落盘裁决已断言，运行时加载 / 发布口仍无落点；`l1RerunBound` 以 `kbId && ranAt` 回退为真，使「无 evalRunId 即不得 bindable」不成立）· **L2**（报告可判定面已测，但 live 真跑归档 + 逻辑 id → `documents.id` 映射 + RACI 人签仍缺，且四项零容忍 5 处去处只有 1 处机械判）。

**已划出（无实现对象 / 无口径，不作补测项）**：`B1-A4`（`allowedDocIds` 全仓无生产者；覆盖值仍记 `缺实现`）· `R4` / `R6-b`（无落点 / 无口径）。`G3` 已由批 3 的 `docs-guard/gold-review-guard.test.ts` 文件写路径护栏闭环（原「`gold.yaml` 是静态 seed、无生成器」不再是缺口）。

**不可离线补的阻塞行（登记在各分册「缺口」列，写明阻塞方 + 出处）**：真 ES / 真双节点 / 真进程 6 行（E1 E2 H5b H5d P1 AC4；**E1 已于第十轮在真 ES 上真跑取证**，阻塞方改判见该行「缺口」列；E2 的 ES 命中半截同源可判，仍未落）；人签与 live 真跑 T4 + 签字剧 C1 C2 C3；**源码与 Then 不一致或源码无落点 16 行**（D-拼句 H1 H5e M8 S1 S4 Y6 X4 X5 R9 T6 V5 U8/J7c P3 AC2）——**已由 wayfinder 图 `acceptance-divergence` 逐行裁定**（归属：**已测 7** · 保留 `部分测` **9**），逐行见各分册该行「缺口」列；**不再有「源码侧待定」**。

## 附录

基建（`基建:`）与回归（`回归:`）测例**不进本表**，见各包 `tests/index.md`。  
仓库根 `scripts/*.test.mjs` 护脚本本身，见本目录 [README.md](./README.md)。
