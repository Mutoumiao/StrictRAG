# 测试组织规范

> **角色**：HOW（怎么写测例、放哪、如何命名、如何让人/Agent 管得住）。  
> **不是**：产品语义 SSOT（仍是 `prds/00–11`）；也不是完成度 SSOT（仍是源码 + `docs/module-status/`）。  
> **P0 必绿子集**：`docs/testing/p0-redlines.md`。  
> **仓库导航**：`docs/testing/README.md`。  
> **包导航**：各包 `tests/index.md`（有测例的包必有）。

测试存在的理由只有一句：**证明当前阶段的某条能力/需求按 PRD 成立**。  
测例不跟源码文件走，跟需求走。丢掉的是「一个源码文件配一份同名测例」，不是「模块测非法」。

> **审阅冻结（2026-08-23）**：六问结论见 [§12](#12-审阅冻结2026-08-23)。现有 `src/**/*.test.*` **未**搬家。

---

## 1. 测试目标从哪来

本仓交付是按 PRD 阶段推进的（P0/P1 入库 → S2 最小 ask → backlog 项）。测例必须能回答三个管理问题：

| 问题 | 测例必须提供的答案 |
|------|-------------------|
| 目标在哪 | 文件头 `目标` + `tests/index.md` 同行 |
| 测什么 | `需求` 锚到 PRD / ADR / P0 / backlog / `基建:` / `回归:`，而不是锚到 `foo.ts` |
| 功能是否正常 | `pnpm test` 绿，且 index 能指出对应文件；绿而说不清需求 = 假绿 |
| 测全了没有 | **不是** index 能回答的；覆盖看 `docs/testing/p0-redlines.md` 与验收剧本。index 只是存货表 |

写新测例前，必须能填出这一行：

```text
目标：<失败时哪条用户可感知/门禁可核对的能力不成立>
需求：<prds/… 或 ADR-… 或 P0 R# 或 backlog id 或 基建:… 或 回归:…>
主包：<apps|packages 中哪一个>
能力：<ask / ingest / auth / …>
```

「需求」允许四类锚点，**禁止**为 mapper / env / PG 映射编造假 PRD：

| 类 | 写法 | 例子 |
|----|------|------|
| 产品 | `prds/…` · ADR-… · `P0 R#` · backlog id | `P0 R8` · `prds/08-quality` |
| 基建 | `基建:` + 护的契约 | `基建: api env Zod` |
| 回归 | `回归:` + 曾经如何坏 | `回归: claim_split 解析失败仍 answered` |
| 脚本 | 仓库根脚本见 `docs/testing/README.md`，不进能力树 | `scripts/smoke-ask.test.mjs` |

四类都填不出，就不要建文件。

### 权威对照

| 问 | 打开 |
|----|------|
| 这条能力产品上是否存在、语义是什么 | `prds/00–11` |
| 当前阶段做没做完（IS） | 源码 + `docs/module-status/` |
| 这条能力的自动化证据在哪 | 主包 `tests/index.md` |
| 合并前不可破的 10 条 | `docs/testing/p0-redlines.md` |
| 验收剧本（非单测替代） | `prds/10-delivery/03-acceptance-scenarios.md` |

---

## 2. 四条核心规则

### 2.1 能力 / 需求 / 具体功能 → 独立测试文件

组织轴是 **意图**，不是源码树。

| 正确 | 错误 |
|------|------|
| `tests/ask/min-veto.test.ts` | `src/graph/graph.test.ts` 里再堆一个 it |
| `tests/ingest/scan-before-parse.test.ts` | `pipeline.test.ts` 与 `pipeline.ts` 一一镜像 |

一个源码模块可以对应多份测例（见 §4）。一份测例禁止「顺便」覆盖无关意图。

### 2.2 测例落在主包（Monorepo 落点）

每个能力只在 **一个主包** 放权威测例。

| 判定 | 落点 |
|------|------|
| 能力只存在于某一 app 的界面/客户端行为 | 该 app 的 `tests/`，如 `apps/web/tests/ask/` |
| 能力的对错由服务端/状态机/入库决定 | 对该结果负责的包，通常 `apps/api/tests/` 或 `apps/worker/tests/` |
| 跨 app（web 调 api、admin 触发入库） | **主次**：主包 = 失败时能力为假的那一层；次包只测自己的适配（展示、按钮、transport），不重复断言业务真值 |
| 共享契约/schema/权限码本身 | `packages/contracts` · `packages/db` · `packages/admin-catalog` |

禁止在仓库根建统一 `tests/` 去打散包边界。禁止 app 测例 import 另一个 app 的源码（见 [monorepo-boundaries](./monorepo-boundaries.md)）。

### 2.3 粒度：一模块一意图；横切需求则一模块多份意图

| 情况 | 文件策略 | 例子 |
|------|----------|------|
| 单功能、边界清晰、通常一个模块 | **一份文件 = 一个意图** | `split-paragraphs.test.ts` 只测段落切分 |
| 一条需求穿过多个模块，或同一模块有多条互不隶属的意图 | **同一能力目录下多份文件**，按意图拆 | ask 图：`min-veto` / `verify-required` / `rewrite-disabled`，而不是一份 `graph.test.ts` |

「一模块多份意图」不是把多个需求塞进一个 describe。它是：被测模块可以相同，文件按需求分开。

粒度（避免按心情拆成 4 份或 15 份）：

- 同一意图下的正/负/边界多个 `it` **留在同一文件**。
- 读完文件头「目标」仍要加「以及…」才能说清 = 该拆。
- 不要按 `describe` 个数机械拆。`graph.test.ts` 的 route / budget / min / verify / rewrite 是多意图；`min-veto` 里多种低分场景是一意图。

### 2.4 每个 `tests/` 必有 `index.md`

`index.md` 是该包测试的 **存货表**，不是覆盖矩阵。现行 `tests/` 文件不在现行表 = 测例未完成（存货谓词）。增删改测例与改 index **同一变更**。  
index **不能**用来宣称「入库 / ask / 鉴权测全了」；那是 P0 红线与验收剧本的职责。

---

## 3. 落点判定（主次）

按顺序问，停在第一个能定主包的答案：

1. **哪一层失败，这条能力对用户/门禁就是假的？** 那一层是主包。
2. 只是展示、按钮显隐、错误文案映射？落对应前端包。
3. 只是 Zod 形状 / 权限码表 / schema 列？落下沉的 package。
4. 仍像「前后端都要测」：主包测业务真值；次包测适配，并在次包 index 的「简介」里写清「真值在 `<主包路径>`」。

### 3.1 对照例

| 能力 | 主包 | 次包（若需要） | 说明 |
|------|------|----------------|------|
| claim min 否决不得 answered | `apps/api` | web 只测拒答 UI（`role=alert`） | P0 R8 在 api；R2 在 web，不重算分数 |
| 合法 draft 必经 verify | `apps/api` | 无 | P0 R9；不要放到 web |
| 未 ready∧active 不得进检索集 | `apps/api`（corpus 装载） | db 可测纯函数，但 **R7 主锚是 api** | 与 [quality-redlines](./quality-redlines.md) 一致 |
| 流式 ready 且无 final → 提问不卡死 | `apps/web` | 无 | 纯客户端状态机，P0 R1 |
| 入库 scan 在 parse 前；未接引擎启动失败 | `apps/worker` | api 只测入队/HTTP 闸 | 扫描策略不在 api 重写一份 |
| 文档 complete 体积/审批闸 | `apps/api` | admin 只测按钮/错误展示 | HTTP 闸的对错在 api |
| AskOptions 拒 `tauClaim` | `packages/contracts` | api/web 可测接线，不复制 schema 用例 | 形状 SSOT 在 contracts |
| `admin.shell` 菜单裁剪 | `apps/admin` | catalog 测码表/树；api 测验码 | UI 裁剪 ≠ API 授权 |
| 权限码是否合法 | `packages/admin-catalog` | api `resolve` 测求值 | 码表不进 apps |

### 3.2 主包已定之后

- 测例物理路径：`<主包>/tests/<能力>/<意图>.test.ts(x)`
- 次包若有适配测：`<次包>/tests/<同一能力>/<更窄意图>.test.ts(x)`，例如 web `ask/abstain-alert.test.tsx`
- 禁止为「对称」在每个包复制同一断言
- **同一不变量、不同生命周期不是重复真值**：检索期双就绪（api corpus / R7）≠ db 纯函数 ≠ 入库期扫描闸（worker）。删次包测例前先问：失败时是不是另一条能力为假
- web「真打 api」的全栈测不进各包 `pnpm test`，走 §7 的 Playwright / E2E；web 主包仍只测客户端状态与展示

---

## 4. 目录与命名

```text
<app|package>/
  src/                         # 生产代码；禁止新业务 *.test.ts
  src/test/                    # 仅 setup / re-export / 本地 fixture（可选）
  tests/
    index.md                   # 本包导航（必有）
    <capability>/
      <intent>.test.ts
      <intent>.test.tsx        # 仅组件测
    _support/                  # 可选：本包测试 helper（非测例）
  vitest.config.ts             # include：tests/** 与遗留 src/**
```

### 4.1 能力目录名

用产品域短名（kebab-case），**不要**复制 `src/services`、`src/routes` 或 `src/graph`。

下表是 **优先词，不是闭集、不是枚举**。按包选用，不要求建齐，本包没有的不建空目录。

| 目录 | 含义 |
|------|------|
| `ask/` | 问答、检索装载、verify、拒答、流式终态 |
| `ingest/` | 入库 HTTP 闸、状态机、分片、扫描、幂等 |
| `auth/` | 身份、JWT、AUTH_ENFORCE、session 客户端 |
| `acl/` | 成员、部门、kb-scope、权限求值 |
| `kb/` | 知识库设置、mode/docTypes |
| `sessions/` | 会话壳（历史≠evidence） |
| `feedback/` | 答案反馈 |
| `gateway/` | 模型网关绑定 / mock / 双节点 |
| `eval/` | L1/L2 工程 seed（≠ 业务签字） |
| `obs/` | 指标、限流、审计日志 |
| `env/` | env 校验、ready/health、启动闸 |
| `shell/` | admin 壳、菜单裁剪、Guard |
| `ops/` | admin 薄运营页的界面行为 |
| `error-map/` | 业务码文案映射（web/admin） |
| `retrieve/` | 检索闸纯函数（db；R7 主锚仍在 api） |
| `docs-guard/` | 读 PRD / 交付文档护栏（包内，不是仓库根脚本） |
| `system/` | contracts 里部门/面板/网关形状 |
| `async/` | 入库任务 DTO |

新词合法条件：kebab-case；不镜像源码树；先写入 **该包** `tests/index.md` 能力表，再加目录。反复出现的词再补进本表。禁止为「看起来齐」预建空目录。

### 4.2 文件名

- `<意图>.test.ts`，意图是需求短名，不是模块名。
- 正确：`min-veto.test.ts`、`verify-required.test.ts`、`ready-active-corpus.test.ts`
- 错误：`graph.test.ts`、`run.test.ts`、`index.test.ts`、`pipeline.test.ts`（除非意图真的就是「整条管道契约」且文件头写清范围）

组件测用 `.test.tsx`。不要 `spec.ts`。不要和源码文件强制同名。

---

## 5. 文件头契约

每个测试文件顶部必须有块注释，四段里前三段必填：

```ts
/**
 * 目标：claim 级 min 不达标时整答必须拒答，禁止均值洗白后 answered。
 * 需求：P0 R8 · prds/08-quality/01-verification-and-abstention.md
 * 被测：runAskGraph（judge 分数路径）
 * 简介：低分 claim → status=abstained / unsupported_claims。
 */
```

| 字段 | 要求 |
|------|------|
| **目标** | 一句话；读完就知道失败意味着什么。禁止只写模块名 |
| **需求** | 可核对锚点：PRD / ADR / `P0 R#` / backlog，或 `基建:` / `回归:`（见 §1） |
| **被测** | 符号、路由或入口；改源码时靠这一列（或 grep import）找回测例，替代「源码旁一眼看到」 |
| **简介** | 与 `index.md` 简介同义，可短于目标 |

关闭 P0 行的关键 `it` 标题仍含 `R#:`（与 `docs/testing/p0-redlines.md` 一致）。

---

## 6. `tests/index.md` 契约

模板：

```markdown
# @strict-rag/<pkg> · 测试导航

> HOW：`.trellis/spec/guides/testing.md`

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | 单轮问答信任路径 | `prds/04-pipelines` · `prds/08-quality` |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `ask/min-veto.test.ts` | min 否决不 answered | P0 R8 · prds/08-quality | `runAskGraph` | 低分 claim 整答拒答 | 现行 |

## 遗留（待迁）

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/graph/graph.test.ts` | 多意图混居（路由/预算/R8/R9） | P0 R8/R9 | 待按意图拆到 `tests/ask/`；须单独变更，禁止顺手拆 | 遗留 |
```

规则：

- **现行**：已在 `tests/<能力>/` 且一头一意；**必须有「被测」列**（改 `run.ts` 时查这一列，而不是靠源码旁文件）。
- **遗留**：仍在 `src/**/*.test.*`。必须登记，禁止「目录里有、导航里没有」。遗留表可不填「被测」，迁徙时补。
- 能力表只列本包实际使用的目录。
- 简介不超过两句；细节放文件头。
- 改测例目标/锚点时同步改 index，不要让导航变成第二套过期文档。
- 存货谓词只约束 `tests/` 现行文件。遗留表漏行是盘点债，在机械闸落地前 **不**单独让 `pnpm test` 红。

仓库级入口 `docs/testing/README.md` 只做包清单 + 指针，**不**复制各包表格。

---

## 7. 基建与运行

| 项 | 约定 |
|----|------|
| 运行 | `pnpm test`（turbo）；单包 `pnpm --filter @strict-rag/<pkg> test` |
| 收集 | `tests/**/*.test.{ts,tsx}` 为现行；过渡期同时收集 `src/**/*.test.{ts,tsx}` |
| 环境 | api/worker/db/contracts/admin-catalog → node；web/admin → jsdom |
| setup | 前端可留 `src/test/setup.ts`；不要把业务测例放进 `src/test/` |
| 共享 ask final 工厂 | `@strict-rag/contracts/testing`（禁止 apps 手抄一份 JSON） |
| 实网 | 默认禁止；live LLM / 真 ES 不进常规 `pnpm test` |
| E2E / Playwright | 不进各包 `src/`，也不替代本规范下的能力测例；默认不进 `pnpm test` |
| 仓库脚本 | 仓库根 `scripts/*.test.mjs` 护的是脚本本身，列在 `docs/testing/README.md`，不塞进某个 app 的能力树 |
| 包内脚本测 | `src/scripts/run-l1-golden.test.ts` 这类是能力测，迁徙时进 `tests/eval/` 等，**不是**仓库根脚本 |
| 文档护栏 | 读 PRD 的包内护栏（如交付控制台盘点）可留在主包 `tests/docs-guard/`，不要和仓库根脚本混 |

Vitest `include` 现行写法：

```ts
include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'];
```

当前者已覆盖某文件、后者不再有遗留时，再删掉 `src/**` 这一段。

过渡期应加 **遗留白名单闸**（新的 `src/**/*.test.*` 直接红）。闸未落地前靠 checklist 与 review 拦住；没有闸不等于允许再在 `src/` 旁建文件。

---

## 8. 新增 / 改动测例的步骤

1. 用 §1 的一行填空写出目标与需求。
2. 用 §3 定主包；只在次包补适配测。
3. 选或新增 `tests/<能力>/`；新能力先改 index 能力表。
4. 按意图命名文件；同一模块多意图就多文件。
5. 写文件头（§5），再写 `describe` / `it`。
6. 同一变更更新该包 `tests/index.md`。
7. 若该文件关闭 P0 行：更新 `docs/testing/p0-redlines.md` 证据路径。
8. 跑 `pnpm --filter @strict-rag/<pkg> test`。

**存货完成谓词**（写新测例时）：文件在 `tests/`、文件头三项齐全、现行表有行且含「被测」、需求锚点可打开（含 `基建:` / `回归:`）、意图不与邻文件重叠。

**覆盖完成谓词**不在 index：P0 看红线表；阶段能力看验收剧本。有 index 行 ≠ 该能力测全。

---

## 9. 遗留同域测例

历史约定是源码旁 `*.test.ts`。自本规范生效起：

- **新测例**只进 `tests/<能力>/`。禁止再为「方便对照源码」新增同域测例。
- **遗留文件**继续被 Vitest 收集，直到迁走；必须出现在该包 `tests/index.md` 的遗留表。
- **禁止顺手拆**：修 bug / 加 it 时不要把混居遗留文件拆进 `tests/`。迁徙必须是单独变更。
- **禁止第一批拆** `apps/api/src/graph/graph.test.ts`（P0 R8/R9 证据仍在那里）。若要验证「目标 → 文件 → index → 绿」，用已经接近单意图的 P0（web R1 `use-knowledge-ask.test.ts`，或 db `retrieval-gate.test.ts`）。
- 迁徙后同步 P0 证据路径、module-status 里写过的测试路径、包 directory-structure 示意树。

本规范 **不**要求一次搬完现有文件，也 **不**把「改到再拆」当默认。先做到：新文件可管、旧文件能在 index 里被找到。

---

## 10. 反模式

| 错误 | 正确 |
|------|------|
| 为每个 `foo.ts` 建 `foo.test.ts` | 按需求/意图建文件；一个模块可以有多份 |
| 仓库根 `tests/ask` 混跑所有包 | 测例留在主包内 |
| web 重写一遍 min 分数逻辑「顺便集成」 | api 测真值；web 测拒答展示 |
| 一份 `graph.test.ts` 装路由+预算+R8+R9 | 拆成多份意图文件（**单独变更**，见 §9） |
| 无文件头、现行表无行 | 视为测例未完成（存货） |
| 用 index 或「有测试文件」宣称能力测全 | 存货用 index；覆盖用 P0 / 验收剧本 |
| 把 L1 mock 覆盖率当签字 | 见 [l1-eval](../api/backend/l1-eval.md)；eval 测例必须在简介写清 ≠ 准出 |
| 测例 import 另一 app | 下沉 packages 或只测本包入口 |
| 为 mapper/env 编造假 PRD | 用 `基建:` |
| 为对称删掉 worker/db 双就绪测 | 不同生命周期，先问失败时哪条能力为假 |
| 修 graph 时顺手拆近 900 行 | 单独迁徙；第一批不要碰 R8/R9 文件 |

---

## 11. 开工检查单（写测例时）

- [ ] 目标句能回答「失败时哪条能力为假」？
- [ ] 需求锚到 PRD / ADR / P0 / backlog，或 `基建:` / `回归:`（没有就不要建文件，也不要编假 PRD）？
- [ ] 主包按 §3 选择，而不是按「我正在改的那个文件」？
- [ ] 路径是 `tests/<能力>/<意图>.test.ts(x)`？未在 `src/` 旁新建？
- [ ] 单文件单意图（§2.3 粒度）；横切需求已拆成多文件？
- [ ] 文件头含目标 / 需求 / 被测？现行表有行且含「被测」？
- [ ] 未在次包重复断言 **同一生命周期** 的业务真值？
- [ ] 前端行为测用 role/label，不用 `querySelector` 当断言？
- [ ] 未打实网；ask final 工厂走 `@strict-rag/contracts/testing`？
- [ ] 未把修 bug 和拆遗留混居文件放进同一变更？

---

## 12. 审阅冻结（2026-08-23）

来源：`docs/handoff/handoff-2026-08-23-testing-organization-review.md` + eng-review。未搬家。

| 问 | 结论 |
|----|------|
| 1. 丢掉同域？ | **丢掉一对一镜像**，新测例进 `tests/<能力>/`。代价用现行表「被测」列 + import 找回，不保留「模块测必须源码旁」的双轨。 |
| 2. 主包过严？ | **不过严**。web 不重算 min。同一不变量的不同生命周期（api corpus / db 纯函数 / worker 扫描闸）不是重复真值。全栈测走 E2E，不进 `pnpm test`。 |
| 3. index 完成谓词？ | **只做存货谓词**（`tests/` 文件必须有行）。不是覆盖谓词。遗留漏行是盘点债。应补遗留白名单闸，闸未落地前靠 review。 |
| 4. 能力目录冻结？ | **优先词，非闭集**。已吸收 `error-map` / `retrieve` / `docs-guard` / `system` / `async`。新词先写该包能力表。 |
| 5. 过渡更激进？ | **否**。分批；**禁止顺手拆**；**禁止第一批拆** `graph.test.ts`。样板用已接近单意图的 P0。 |
| 6. 脚本测不进能力树？ | **仓库根 `scripts/*.test.mjs` 不进**。包内 `src/scripts/*.test.ts` 是能力测（如 `eval/`）。文档护栏可留在包内 `docs-guard/`。 |
