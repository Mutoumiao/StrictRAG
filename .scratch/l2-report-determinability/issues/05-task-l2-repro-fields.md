# 落 §8 的 L2 侧字段（剧本集哈希 · session/rewrite 版本）

Type: task
Status: resolved
Blocked by: 02

## Question

按裁定票 02，把 PRD §8 表里属于 L2 的两类字段（「**L2 剧本集哈希**」与「**session 策略版本 / rewrite prompt 版本**」）落到 L2 报告，形状与 L1 图建的 `L1Repro` 同构。

范围（以裁定票为准，此处为默认预期）：

1. 新增 L2 的可复现区块（键名、放置位置、是否子路径导出按裁定），至少含：
   - 剧本集哈希：复用 L1 图已建的稳定哈希写法（`l1QuestionIdsHash` 一类：id 集合内部排序后 sha256），**不另发明**。
   - `session 策略版本` / `rewrite prompt 版本`：有载体则取真值；无载体则 `null` + 记债（**禁止**拿源码文本哈希顶替 —— 前图已定此纪律：会随任意重构噪声跳变）。
2. 与既有 `l2Fingerprint` 的关系按裁定处理（合并 / 并存）；两侧**同构**：
   - api `buildL2EvalRunInsert` 是整对象直落；
   - worker `persist.ts` 的 `saveL2Report` 是**逐键白名单**，必须同步加键，否则新字段在 worker 侧**静默丢弃**；
   - 补一条测例钉住「worker 侧白名单不缺新键」。
3. 哈希进报告是否会把 `node:crypto` 带进 web/admin 客户端打包图 —— 按裁定决定导出路径，并**用 `pnpm build` 实证**（不是推断）。
4. 测例：新增落 `<包>/tests/<能力>/<意图>.test.ts`，文件头中文四段，登记 index；含反证。
5. 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试（**串行**）+ `pnpm install --frozen-lockfile`（若动 `package.json`）。

**不许**：改 PRD §8；编造版本值；新增表 / 迁移。

## Answer

按裁定 02「三、§8 的 L2 侧字段」的裁定 7 逐条落地。**没有改 PRD、没有编造版本值、没有新增表 / 迁移 / HTTP 端点、没有动 `l2RewriteFingerprint`、没有动 `computeL2SignoffEligible`、没有改夹具与默认开关**。本票产出 = 「L2 报告多一个三键可复现区块 + 两侧同构 + 子路径导出经 `pnpm build` 实证」。

### 一、区块形状与三个键的去向（裁定 7）

新区块类型 `L2Repro`（`packages/contracts/src/eval/l2-repro.ts`，**新子路径导出** `@strict-rag/contracts/eval-repro-l2`），api `L2Report` 与 worker `L2BatchReport` **都必带** `repro` 键，**禁单边另写**。

| 键 | 去向 | 口径 / 为什么 |
|----|------|---------------|
| `l2GoldSetHash` | **取真值** | `l2GoldSetHash(ids)` —— 函数体**逐字 `return l1QuestionIdsHash(ids)`**（trim → 去空 → **升序** → `JSON.stringify` → sha256），**没有另发明哈希**；空集 → `null`。api 传 `cases.slice(0, maxCases).map(c => c.id)`，worker 传 `sliced.map(c => c.id)` —— 算的是**本跑实际用的题面集**（截断即另一个题面集） |
| `sessionStrategyVersion` | **恒 `null` + 记债** | 全仓无版本载体：`SESSION_REWRITE_ENABLED` 只是布尔，KB 侧只有 `SessionRewriteLock`（形状 `{ enabledDefault: false, locked: true }` —— 是「锁」不是版本号） |
| `rewritePromptVersion` | **恒 `null` + 记债** | `rewriteSystemPrompt()`（`graph/prompts.ts`）是内联字符串数组 → 源码即版本，无常量 / 无 KB 配置键 / 无表列 |

两个版本键的**类型被钉成 `null` 字面量**（`sessionStrategyVersion: null` / `rewritePromptVersion: null`）—— 编一个假版本号过不了 `tsc`。**没有**拿源码 / prompt 文本哈希顶替（会随任意重构噪声跳变）。

**区块范围就到这三个键**：§8 的通用字段（`models` / `retrieveK` / `rerankTopN` / `tauClaim` / `contextMode` / …）在 L1 侧已有落点，L2 侧**本票不扩**；区块内也**没有** `mode` / `retrieve_mode`（既有顶层键是同一语义的历史别名，不造第二源）。两条都写进了 spec。

### 二、为什么必须子路径导出 —— `pnpm build` 实证

- `apps/api/src/scripts/run-l2-golden.ts` 与 `apps/worker/src/eval/run-l2-batch.ts` 都从 `@strict-rag/contracts/eval-repro-l2` import；`packages/contracts/package.json` 的 `exports` 新增 `"./eval-repro-l2": "./src/eval/l2-repro.ts"`。
- **没有**把 `l2-repro.ts` 加进 `src/index.ts`：主入口会被 `apps/web` / `apps/admin` 的 `transpilePackages` 打进客户端图，而 `l2-repro.ts` 间接 `node:crypto`（经 `./l1-repro.js`）。
- **实证**：`pnpm build --force`（0 缓存）→ **8 successful / 8 total，web 与 admin 两个 Next 生产构建均 `Compiled successfully`**，无 `Module not found`。这不是推断。
- 旁证（非充分但一致）：全仓 `eval-repro-l2` 的引用只在 api / worker 的 `src` 与其测试文件里，`apps/web` / `apps/admin` 零引用。

### 三、与 `l2Fingerprint` 的关系：**并存，不合并**（裁定 7）

`l2RewriteFingerprint(prompt, modelId)`（`apps/api/src/eval/l2-fingerprint.ts`）**一字未动** —— 不改名、不搬家、不并入 `repro`、不删。理由与证据：

- 语义**不同**：它算的是「rewrite 提示词 + NUL + modelId」，**不含任何一道题的 id**；`l2GoldSetHash` 算的是题面 id 集合。两者不是同一件事的两个名字。
- 位置**不同**：`l2Fingerprint` 今天只进 `buildL2EvalRunInsert` 的 `reportJson`（`{...report, l2Fingerprint}`），**不在报告本体**；`repro` 在报告本体（api 整对象直落 → 自动进 `reportJson` 与 artifacts；worker 手抄白名单）。
- 抄它等于把「剧本集变了」和「prompt / 模型变了」压成一个数 —— 报告读者再也分不清是哪一种变化，正是本图要消除的「形似」。

### 四、两侧同构 + md 渲染

- 键名 `repro` 进 contracts `L2_EVIDENCE_REPORT_KEYS`（注释改为「L2 报告自有键的同构锚点（采集面 + 零容忍区块 + 可复现区块）」），连带把 `packages/contracts/tests/eval/l2-evidence-fields.test.ts` 里那条逐字键集断言从 **6 键改成 7 键**（这是本票唯一改到的既有名单）。
- worker `persist.ts` 的 `saveL2Report` 逐键白名单**同步加键** `repro: report.repro`（漏键静默丢弃、零测试红 —— 已由反证 A 证实）。
- api `formatL2ReportMd` 新增 `## 可复现（PRD §8）` 三行表 + 一句说明；取不到的渲染成「—」（照 L1 `reproMdLines` 风格，不渲染 `null` / 空串）。worker **无** md 渲染（只写 `reportJson`）。
- 因 `L2Report` 加**必填**键，报告字面量唯一爆点 `apps/api/tests/eval/l2-cli.test.ts` 的 `sampleReport()` 补一键（连带 3 个 `it` 走通）；worker 侧零处（与裁定 02 第五节预估一致）。

### 五、新增 / 改写的测例清单（均已登记各包 `tests/index.md`）

| 包 | 文件 | 条数 | 覆盖 |
|----|------|------|------|
| contracts | `tests/eval/l2-repro.test.ts`（**新**） | 10 | 硬编码摘要 `IDS_AB_DIGEST` 跨进程钉住；逐字等同 `l1QuestionIdsHash`；换序 / 空白 / 空项同值；增删改一个 id 即变；空集 → `null`；**拼接碰撞反证**；`emptyL2Repro` 三键且无多余键；两个版本键恒 `null` + 无占位串；**L1 侧保留键仍 `null`**；`repro` 在 `L2_EVIDENCE_REPORT_KEYS` 里 |
| contracts | `tests/eval/l2-evidence-fields.test.ts`（**改**） | 10 | 逐字键集 6 → **7 键**（加 `repro`），其余断言未动 |
| api | `tests/eval/l2-repro-fields.test.ts`（**新**） | 5 | 哈希 = 本跑题面集且是 64 hex；两个版本键 `null`；区块键集 = `emptyL2Repro`；**重排 → 同值 / 改一个 id 或 `maxCases` 截断 → 变值**；报告本体无 `l2Fingerprint`（并存不合并）且 `reportJson.repro` 直落；json + md 都落该区块、`—` 渲染且不出现 `null` / `undefined` / `NaN` |
| api | `tests/eval/l2-cli.test.ts`（**改**） | 24 | `sampleReport()` 补 `repro: emptyL2Repro()`（既有 3 个 `it` 恢复绿） |
| worker | `tests/eval/run-l2-batch-repro.test.ts`（**新**） | 5 | 区块键集 = `emptyL2Repro` 且哈希取真值；两个版本键恒 `null`；重排同值 / 改一个 id 变值；区块不进判定（`signoffEligible` 仍 false）；**`saveL2Report` 白名单保留 `repro` 且「报告有的，库内也能看到」** |

### 六、反证（改坏即红，改完已还原；`git diff --stat` 里只剩预期文件）

| 反证 | 改法 | 结果 |
|------|------|------|
| **A · 白名单漏新键** | `persist.ts` 删 `repro: report.repro,` | worker `run-l2-batch-repro.test.ts` **1 红 / 5**；`run-l2-batch-evidence-collection.test.ts` **1 红 / 8**（后者因 `L2_EVIDENCE_REPORT_KEYS` 含 `repro` 而连带红）✅ 静默丢弃被拦住 |
| **B · 锚点名单漏新键** | `L2_EVIDENCE_REPORT_KEYS` 删 `'repro'` | contracts `l2-evidence-fields.test.ts` **1 红**；`l2-repro.test.ts` **1 红**（`toContain('repro')`）✅ |
| **C · 偷懒哈希实现** | `l2GoldSetHash` 改成 `l1CalibSetHash(ids.join(''))`（sha256 但**拼接式**、不排序） | contracts `l2-repro.test.ts` **4 红 / 10**：硬编码摘要、逐字等同 `l1QuestionIdsHash`、换序同值、拼接碰撞 —— 一次改坏四道护栏 ✅ 证「JSON 序列化 + 升序」是必需项而非装饰 |
| **D · 顺手填 L1 保留键** | `emptyL1Repro()` 的 `l2GoldSetHash` 从一个 `null` 改成 64 位字面量 | contracts `l1-repro.test.ts` **1 红**（既有「取不到的分项一律 null」）＋ `l2-repro.test.ts` **1 红**（本票新增的「L1 保留键仍 null」）✅ 证「不要顺手去填它」被钉住 |

### 七、门禁（自己跑、串行；以上全部为**最终态**数字）

- `pnpm check-types`：**8 successful / 8**（全绿）
- `pnpm lint`：**8 successful / 8**，零 warning
- `pnpm --filter @strict-rag/contracts test`：**34 files / 283 tests passed**
- `pnpm --filter @strict-rag/worker test`：**55 files / 249 tests passed**（＋存货闸自测 8/8）
- `pnpm --filter @strict-rag/api test`：**177 files / 1096 passed | 3 skipped**
- `pnpm install --frozen-lockfile`：exit 0（`Lockfile is up to date` —— 只加了 `exports` 子路径，**未**新增依赖，未手改 lockfile）
- **`pnpm build`：`pnpm build --force`（0 缓存）→ 8 successful / 8 total，0 cached**；`@strict-rag/web` 与 `@strict-rag/admin` 均 `Compiled successfully`
- 未跑全仓 `pnpm test`（门禁只要求三包串行；全仓留给工单 06 收口）
- 顺手实测 `pnpm check:module-status`（exit 0）：仍是 **42 条 = 基线 39 + 3 条 `6-联动`**（`apps/api/*` / `apps/worker/*` / `packages/contracts/*` 已改但同名 module-status 未改）—— 这 3 条是**工单 06 的回写职责**，本次不动

### 八、未做 / 做不了的（如实）

1. **空集 → `null` 只在纯函数层被覆盖**：api 与 worker 的**运行时集永不为空**（`parseL2Gold` 拒绝空 `cases`；`maxCases` 只在 `> 0` 时截断），所以两条报告路径今天取不到空集。该分支由 contracts 单测直接钉住，**没有**为凑这条而放宽 gold 加载不变量。
2. **两个版本键仍无载体** → 恒 `null`，本票只把它落成「如实记债 + 类型钉死」；销账需先有版本载体（prompt 常量或 KB 配置键 / session 策略版本号），属产品语义变更，须回写 PRD 后另开。
3. **§8 的 L2 侧通用字段未落**（`models` / 档位预算 / `tauClaim` / `contextMode` / …）—— 裁定 7 明确不在本票范围。worker 侧今天更取不到（内口不下发 `mode`、`saveL2Report` 白名单不含这些键），销账要先改内口形状。
4. **区块不透 `…/eval/runs` 的 DTO**（`EvalRunSchema` 是 `.strict()`，与前图 L1 侧同裁）→ **仍记债**；区块只出现在报告本体 / `reportJson` / artifacts `l2-last-run.{json,md}`。
5. **未动**：`AskGraphResult` / `ExecuteAskResult` / `fixtures/l2/gold.yaml` / `prds/00–11` / 仓库默认开关 / `l2RewriteFingerprint` / `computeL2SignoffEligible`；**无**迁移、**无**新表、**无**新 HTTP 端点。
6. **未做** `docs/module-status/` 与 `docs/testing/coverage*` 回写（工单 06 职责）。`.trellis/spec/api/backend/l2-eval.md` 已续写；`spec/worker` 侧未单列（两侧共一条口径）。
7. **未验证**「若把 `l2-repro.ts` 加进 `src/index.ts`，`pnpm build` 会否真红」—— 没有做这个破坏性实验（会改主入口）。故 spec 里「子路径导出是必需」的依据是「客户端打包面 + 主入口无该模块 + 引用面核查」，**不是**一次失败实证。这一点如实标注。

### 九、给工单 06 的回写提示

1. **能力矩阵 / 包文**建议逐字落：L2 报告的 §8 可复现区块**已具备**（三键：`l2GoldSetHash` 真值 + 两个版本键恒 `null`）；**两个版本键 = 记债**（`sessionStrategyVersion` / `rewritePromptVersion` 全仓无载体）；**`l2GoldSetHash` 在 L1 侧仍是 `null` 保留键**（同名不同源，L1 未动）。
2. **新债清单**（可直接抄 spec 那张「销账路径」）：① 两个版本键需先有版本载体；② §8 L2 侧通用字段需 worker 侧拿到本次 run 的档位 / 模型身份（内口不下发 `mode`）；③ 区块**不透** `…/eval/runs` DTO（`EvalRunSchema` `.strict()`）。
3. **新增测例对号**（三包 `tests/index.md` 已登记）：contracts `eval/l2-repro.test.ts`（10）· api `eval/l2-repro-fields.test.ts`（5）· worker `eval/run-l2-batch-repro.test.ts`（5）；改动的既有测例：contracts `eval/l2-evidence-fields.test.ts`（6 → 7 键）、api `eval/l2-cli.test.ts`（`sampleReport()` 补键）。
4. **踩坑提醒**：① `L2_EVIDENCE_REPORT_KEYS` 是两侧同构的**唯一锚点**，本票从 6 键变 7 键 —— 后续任何一侧加 L2 报告键都要同步名单 + worker `saveL2Report` 白名单 + 三条同构测例；② **不要**把 `l2-repro.ts` 加进 `contracts` 主入口（`node:crypto` 进客户端图）；③ `l2Fingerprint` 的语义与位置**未变**（只在 `reportJson`），别在回写时把它写成「已在报告本体」；④ `fixtures/l2/gold.yaml` 一字未动（18 条 / 25 个逻辑 id）。
