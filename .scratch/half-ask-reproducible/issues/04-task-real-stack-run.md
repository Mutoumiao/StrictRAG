# 04 · 真栈真跑：无 key 机器上拉起 → 末步给出可解释结果

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 03

## Question

在本机（不设任何第三方 key）跑完整 DoD，记录末步输出、退出码、桩标注与反证。

## Answer

取证正文：[`research/04-real-stack-half-ask.md`](../research/04-real-stack-half-ask.md)（专职取证代理执行；关键声明由主控复核）。

**A · 无 Gateway 复验**：`pnpm smoke:half` 第 1–7 步全过、第 8 步 `FAIL: ask has no citations`（`status=abstained` / `reason=internal_guard`），**exit 1**；**新版可诊断提示已出现**（缺 Gateway / 三条 JSON / 看哪份文档 / 可用桩），且**判定与退出码与改动前一致**（未放宽任何闸；失败路径新增了诊断行，属本轮改动）。

**B · 用桩跑通（本图 DoD）**：起 `node scripts/stub-gateway.mjs`（banner 逐字记录）→ `GATEWAY_BASE_URL=http://127.0.0.1:4100 pnpm smoke:half` → **exit 0**，输出 `PASS … citations=2 (gateway=stub · 仅证明管道接对 · 非质量证据)`。ask 响应 `answered` / `verified` / `citations=2` / `llmCalls=3` / `evidenceCount=2`；**两条 citation 的 chunkId 经 `psql` 核对均属该文档**；桩收到的 purpose 序列 = `embed → rerank → generate → claim_split → judge`；**答案句与 citations 逐字来自 EVIDENCE（无编造）**。

**C · 反证**：
1. **生产护栏**：`APP_ENV=production node scripts/stub-gateway.mjs` → **拒绝启动**（exit 1 + 拒绝语）。
2. **零重叠问题**（「鲸鱼搁浅的原因」，语料里没有）→ `abstained` / `model_abstained`；无 EVIDENCE 直发 `chat/completions` → `insufficient:true`。
3. **如实记录的边界**：与语料**毫无关系但仍有单字 token 重叠**的问题，桩仍可能给 `answered` —— 桩按单字重叠抽取，触发面窄。这是**桩的已知局限**（它只证明管道，不判语义相关性），已写进研究文与清单页口径。

**D · 前置清单复核**：三个已知坑（`SUPER_ADMIN_*` 必配 / 四眼需第二身份 / turbo dev 的 env 白名单）**都已在文档里**；取证另挖出 **5 处缺口**，已全部补进清单页 `docs/ops/half-smoke.md` 的「前置」节：① 未显式要求按 `.env.operable.example` 配 env；② 未点明脚本**强依赖 dev-login**（须 `AUTH_ENFORCE` 关）；③ 文档用 bash 风格 `VAR=value cmd`，在 PowerShell 不生效；④ 缺「api / worker 已就绪」的可核命令；⑤ 未说明**进程 env 覆盖 `.env`（含空值）**。

**这不是签字数字**：检索仍 mock ES + mock 向量（8 维），答案由 dev-only 抽取式桩产出；`PASS` 只证明管道接对。**未做**：接真 Gateway（无凭据）、admin / web 视觉验证（本机无浏览器）。

## Comments

- 取证代理如实记了「桩的触发面窄」这一局限，未把它藏起来 —— 这正是本图要保住的诚实边界（见工单 05 的反向复核要求）。
