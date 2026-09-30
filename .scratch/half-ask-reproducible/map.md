# 让「第三人拉起 → 问答」这条 DoD 在无第三方 key 的机器上可复现（或如实记为环境前置）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 · 04 · 05 全收口）

## Destination

把 HALF-SMOKE 的**末步 ask**（`pnpm smoke:half` 第 8 步「`POST /ask` → `data.citations` 非空」）从「**取决于机器上有没有一台同时提供 chat + embeddings + rerank 三契约的 Gateway**」变成**可解释、可复现**的一件事。到达时满足其一（由工单 02 的裁定选一路，**必须择一落地，不许两路都不做**）：

- **路 A（建 dev-only 桩）**：仓内多一个**只在本机 dev 生效**的桩 Gateway（实现三契约），使无 key 机器上 `pnpm up:apps` + `pnpm smoke:half` 能跑到 `PASS`；桩**必须响亮标注**（启动 banner + `smoke:half` 输出里能看出这一跑用的是桩），**必须不可能进签字包**（生产档位 / 准出路径拒绝启用），且文档写明「桩只证明管道接对了，**不是**质量证据」。
- **路 B（如实记为环境前置 + 让失败可诊断）**：**不**建桩（若裁定认为「mock chat 不是 JSON → 拒答」是**有意设计**，建桩会削弱它）；改为让无 Gateway 时的失败**自己说清缺什么** —— `smoke:half` 在末步给出可分辨的诊断（缺 Gateway / 缺哪几条契约 / 跑不出 JSON 的模型是哪一次调用），并把「问答段的环境前置」写到**第三人真会读的那几处**（HALF-SMOKE 清单 + 半产品配方 + 模块状态），使「拉起后末步失败」不再需要读源码才能解释。

两路都要求：**不放宽任何门禁**、**不动 `prds/00–11`**、**不改仓库默认开关**、**不把 mock / 桩的结果写成质量证据**。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像。
- **来源**：总 backlog §0.2 的当前主调度是 **P-HALF**（半产品可运行）；`docs/module-status/README.md` 与 `docs/ops/half-smoke.md` 都记着同一条缺口 —— 末步 ask 需要三契约 Gateway；雾清单簇 **39** 把它记为「能建（须先裁：是否允许一个 dev-only 的 JSON 桩 Gateway / 本地适配器），**或**如实记为环境前置」。**前图**：本图与 [`eval-input-baseline`](../eval-input-baseline/map.md) 无依赖关系。
- **本图立的判据线**：一条 DoD（「txt → ask 有引用」）**必须能被第三人按文档复现，或者它的失败必须能被第三人按文档解释**。今天两者都不成立 —— 失败原因只写在源码与一句风险提示里。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `docs/ops/half-smoke.md` · `docs/ops/operable-stack.md` · `docs/module-status/README.md`（半产品段）· `scripts/smoke-half.mjs` · `scripts/smoke-ask.mjs` · `apps/api/src/services/gateway/`（运行时解析与 mock / http 两档）· `prds/07-models/`（Gateway 契约）· `.trellis/spec/api/backend/model-gateway.md`。写代码前读 `.trellis/spec/` 对应包 `index.md`。
- **本图携带执行**：工单可直接改脚本 / 加桩 / 改文档。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试（改脚本则跑 `node --test scripts/*.test.mjs`）；收口跑全仓 `pnpm test --concurrency=1`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `GATEWAY_MODE` 的**默认值**一律不动（本图若加档位，只能加**显式开启**的新档，且默认关）。
- **不改 `prds/00–11`**；**不改任何门限数字与判定公式**；**不放宽**「mock 数字 / mock 结果禁进签字包」这条既有红线。
- **本图特有的「不许」**：
  - **不许**让任何 mock / 桩的产物**看起来像真模型产物**：桩的存在必须在它产生的每一处输出里可见（banner / stdout 标记 / 报告字段），且**在生产档位下拒绝启动**。
  - **不许**为了让 `smoke:half` 变绿而放宽 ask 的验证闸（verify / minSupport / 引用判定）；桩只能**供给模型侧输入**，不能改判定。
  - **不许**把「`smoke:half` PASS」写成「RAG 可用 / 可签字」—— 它只证明管道接对了。
  - **不许**在 `apps/api` 生产代码里为桩开后门（桩是**独立进程 / 独立脚本**，或用既有的显式 env 档位接入）。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**；给裸标识符加反引号会被 `check:module-status` 当表名（前图为此清了 4 条噪声）；收口声明必须在**最后一次提交之后**复跑 `check:module-status`（`1-路径` / `6-联动` / `7-时效` 三类须为空，基线 **39 条**）。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图。**Docker Desktop 可用**（前图真栈真跑过），故工单 04 的真跑在本图范围内；Docker 会自退，预留重启预算。

### 开工基线（2026-10-01 · 逐条核过文档与脚本）

| 处 | 今天的样子 |
|---|---|
| HALF-SMOKE 清单 | `docs/ops/half-smoke.md`：口径 =「txt → ask 有引用」；前置写明「扫描 / 向量 / ES 可为 mock」，但末步**须** Gateway 产出合法 generate / claim_split / judge JSON；缺 `GATEWAY_BASE_URL` 时「默认 mock chat **不是** JSON，ask 会拒答、本脚本因空引用失败」 |
| 脚本 | `scripts/smoke-half.mjs`（8 步串行，末步 `POST /ask` 断言 `data.citations` 非空）；`scripts/smoke-ask.mjs`（引用判定单测，不连 api） |
| 模块状态 | `docs/module-status/README.md` 半产品段：末步 ask「需要一台同时提供 chat / embeddings / rerank 三条契约的 Gateway；无 key 机器上按既定口径空引用失败（属**环境前置**，非源码缺陷；**是否另建 dev-only 桩属产品决定，未做**）」 |
| 雾清单 | 簇 39：「半产品端到端『问答』段不可复现」；离线可做一栏 =「**能建（须先裁：是否允许一个 dev-only 的 JSON 桩 Gateway / 本地适配器），或如实记为环境前置**」 |
| 已知的反方理由 | mock chat 返回非 JSON → ask 拒答，看起来是**有意设计**（宁拒勿妄：没有真模型就别产出答案）。建桩会不会削弱它，是工单 02 必须正面回答的问题 |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 研究：末步 ask 的失败形态与三契约可达面](./issues/01-research-ask-gateway-surface.md) — 真栈实测：`smoke:half` 第 8 步 exit 1（`status=abstained` / `reason=internal_guard`）；**只缺 `generate` 的 JSON**，检索侧（embed + 真 ES sparse + rerank）已全通；桩可**零生产代码改动**接入（`GATEWAY_BASE_URL` 指向独立进程）；爆炸面 18 文件 / 104 it，只要不改默认值就零波及；仓内**无**现成 HTTP JSON 桩；`prds` 里**查不到**「mock chat 必须非 JSON」的明文。
- [02 · 裁定：建 dev-only 桩（路 A）为主 + 可诊断性并列](./issues/02-dec-stub-or-prerequisite.md) — **路 A**：独立进程的**抽取式**桩（只从提示给的 EVIDENCE 抽取、`citations` 逐字取自 evidence、证据不足必须 `insufficient: true`），**零 `apps/` 改动**、不新增 `GATEWAY_MODE` 档位；`GET /__stub` 自证身份供 `smoke:half` 确定性标注；生产档位**拒绝启动**；**R3 并列要求**：末步失败须区分「缺 Gateway / 用桩 / 管道坏」；**R5 禁则**：不许为桩开后门、不许放宽 ask 任何闸。
- [03 · 落：桩 + 烟测诊断](./issues/03-task-implement.md) — `scripts/stub-gateway.mjs`（覆盖 5 个 purpose + `/v1/embeddings` 前缀 + `/v1/models` + `/__stub`；生产护栏；响亮 banner；确定性）；`scripts/smoke-half.mjs`（默认行为不变 + 桩标注 + 三类可诊断）；`scripts/stub-gateway.test.mjs` **13 例**（含生产护栏、无证据不编答案、两条 embeddings 前缀、确定性）；`docs/ops/half-smoke.md` 补三条契约最小形状 / 可核命令 / 用桩两步 / 桩口径 / 失败三形态；`package.json` 加 `stub:gateway`（**不动任何默认链路**）。
- [04 · 真栈真跑：无 key 机器端到端](./issues/04-task-real-stack-run.md) — A：无 Gateway 复验（第 8 步 exit 1 + **新版诊断**出现，默认行为未变）；B：用桩 **exit 0**、`PASS … citations=2 (gateway=stub)`，**两条 citation 经 `psql` 核对属该文档**，桩收到的序列 = `embed → rerank → generate → claim_split → judge`，答案与引用**逐字来自 EVIDENCE**；C：生产档位拒绝启动 / 零重叠问题 abstained / 无 EVIDENCE → `insufficient:true`；D：三个已知坑都在文档里，另挖出 **5 处前置缺口并已补进清单页**。

### 目的地达成（2026-10-01）

**「让『第三人拉起 → 问答』这条 DoD 在无第三方 key 的机器上可复现（或如实记为环境前置）」已达成 —— 两路都落到了**：

1. **可复现**（路 A）：仓内多了 **dev-only 抽取式桩网关**，无 key 机器上两条命令即可把 HALF-SMOKE 走到 `PASS`；桩**只从提示里的 EVIDENCE 抽取**、引用逐字取自 evidence、证据不足即 `insufficient:true`、生产档位拒绝启动、`GET /__stub` 自证身份让 `smoke:half` 标注 `gateway=stub`。
2. **可解释**（路 B）：`smoke:half` 末步失败现在**自己说清**「缺 Gateway / 用的是桩 / 哪一环坏了 + 看哪份文档」；清单页补齐三条契约最小形状、可核命令、PowerShell 写法、就绪检查与「进程 env 覆盖 `.env`」。
3. **仓库默认一个字未改**：`apps/` 零改动、`GATEWAY_MODE` / `GATEWAY_BASE_URL` 默认值未动、ask 的闸一字未放宽、18 个测试文件 / 104 个 `it()` 零波及。**用桩的 PASS 在输出、清单页、模块状态三处都被标注为「只证明管道接对，不是质量证据」**。

**该被记住的三句话**：① **先量失败面再决定要不要建东西** —— 实测发现只缺 `generate` 那一次 JSON（检索侧早就全通），把一个「看起来要接一整套模型服务」的问题缩成「一台假网关」；② **桩可以是加严而不是放宽** —— 抽取式（只引用证据、不足即 insufficient）让「有证据才作答」更硬，罐头答案式的 mock 才是要拒绝的形态；③ **「自证身份」比「靠约定」可靠** —— `GET /__stub` 让烟测**确定性**地知道自己在用桩，真网关 404 不误判，于是「用桩的 PASS」不可能被误读成「真模型跑通」。

**门禁（最后一次提交之后复跑）**：`check-types` 8/8 · `lint` 8/8 零 warning · `node --test scripts/{stub-gateway,smoke-ask,up-stack,seed-demo}.test.mjs` **19/19** · api **183 文件 / 1144 通过** · worker **61 / 283** · 全仓 `test --concurrency=1` **11/11 包** · `check:module-status` **39 条**（`1-路径` / `6-联动` / `7-时效` 三类为空）。**提交（本地，未 push）**：`f8b8edf` 立图 · `a1fd0b7` 工单 01/02 · `39d352d` 工单 03 · 工单 04/05 收口。

## Not yet specified

- **桩的语义相关面窄**（取证实测的诚实边界）：桩按**单字 token 重叠**抽取，与语料毫无关系但仍有单字重叠的问题**仍可能**拿到 `answered`。它不是「假 RAG」，但也**不**能当相关性判据；要让它更严（例如要求整句/多 token 命中才作答）是下一张图的小改动，**前提是先有人需要**它更严。
- **桩没进默认链路**：`pnpm up:apps` / `pnpm smoke:half` 的**默认**仍是「无 Gateway → 拒答」，用桩要显式两条命令。要不要给一条「一条命令全起（含桩）」的 dev 便利入口，属产品取向（会削弱「默认不产出答案」的姿态），故**留在雾里**。
- **本地真模型适配器**（Ollama / llama.cpp：chat 有、**缺 rerank 契约**）：比桩更接近真实，但需要一台够强的机器与模型下载；本图只在清单页留了口径，**未做**。
- **worker 侧 `contextualize` 的 chat(http) 仍无桩覆盖**：本图只覆盖问答段；桩顺手支持了 `/v1/embeddings`（便宜），但 `INGEST_CONTEXTUALIZE_MODE=http` 那条路的 JSON 形状未验。
- **`GET /ready` 的 `gateway=skipped` 不区分「本机没配」与「末步将失败」**：本图把区分放进了 `smoke:half` 的输出，没动 `/ready`（动它要改 api 生产代码，超出本图「零 apps 改动」的裁定）。

## Out of scope

- **接真模型服务**（真 Gateway key / 真云模型 / 真 judge 打分）：须真凭据与成本，本图不代接。
- **改 `prds/00–11` 已冻语义**（含任何门限数字与判定公式）：须 ADR → 改 PRD → 升版。
- **放宽「mock 结果禁进签字包」红线**；**把 `smoke:half` PASS 当成可签字证据**。
- **生产 ES+IK / 多租户独立索引 / 真 RustFS / 真杀毒（QUAL-2）**：前图已裁。
- **改仓库默认开关**（含把桩接进默认链路）。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
