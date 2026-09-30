# 让「第三人拉起 → 问答」这条 DoD 在无第三方 key 的机器上可复现（或如实记为环境前置）

Label: wayfinder:map
Status: open（前沿：工单 01）

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

## Not yet specified

- **桩若要接进 api**：用哪种档位（`GATEWAY_MODE=stub`？还是把桩当成一台真 HTTP Gateway 由 `GATEWAY_BASE_URL` 指过去）—— 后者**零生产代码改动**、爆炸面最小，但需要有人真的把桩进程起起来；前者更省事但多一个档位要维护。这条留给工单 02，若裁成路 B 则自然消失。
- **本地模型适配器**（不是桩，而是把 Ollama / llama.cpp 这类**真**本地服务接上，缺的是 rerank 契约）—— 比桩更接近真实，但需要一台够强的机器与模型下载；本图若走 A 路可以顺手记下「适配器路线」的可行性，但不实现。
- **`smoke:half` 的其它环境前置**（`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 必须先配、四眼审批需第二个身份）—— 前图已补进配方，但「第三人拉起」的完整前置清单是否还有别的暗礁，本图只覆盖问答段。
- **`pnpm up:apps` 的 env 白名单坑**（turbo dev 任务过滤 operable 变量，前图记过）—— 属配方质量，若本图发现第三人仍会踩，可顺手补文档；实现层修 turbo 配置不在本图。

## Out of scope

- **接真模型服务**（真 Gateway key / 真云模型 / 真 judge 打分）：须真凭据与成本，本图不代接。
- **改 `prds/00–11` 已冻语义**（含任何门限数字与判定公式）：须 ADR → 改 PRD → 升版。
- **放宽「mock 结果禁进签字包」红线**；**把 `smoke:half` PASS 当成可签字证据**。
- **生产 ES+IK / 多租户独立索引 / 真 RustFS / 真杀毒（QUAL-2）**：前图已裁。
- **改仓库默认开关**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
