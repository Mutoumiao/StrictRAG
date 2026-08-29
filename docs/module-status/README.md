# 模块状态文档 · Module Status

> **用途**：让读者一眼看清「某个模块已经具备了什么、目前卡在哪个阶段、还欠哪些技术债」。
> 本文档供人工审查与 Agent 交接使用；它**不是**接口契约文档。

## 常用术语（先读这里）

文档中反复出现的缩写和行话，统一解释如下：

| 术语 | 含义 |
|------|------|
| **SSOT** | 唯一事实来源（Single Source of Truth）。某个信息只在这一处维护，其他地方都引用它 |
| **壳 / 薄壳** | 最小可用的功能骨架：主流程能跑通，但界面和能力都还不完整 |
| **闸 / 门禁** | 强制校验点。例如"审批闸"指审批未通过就不允许进入下一步 |
| **挂账** | 把未完成的事项登记进 backlog（待办清单）跟踪，而不是忘掉它 |
| **clip / 裁剪** | 菜单裁剪：按"用户权限 ∩ 已实现页面"过滤出实际可见的菜单项 |
| **双 JWT** | 临时鉴权方案：access token + refresh token 配对使用，**不是**生产级身份认证（IdP） |
| **红线测（P0）** | 回归红线测试：一旦破坏就必须立即修复的关键行为测试；清单 `docs/testing/p0-redlines.md`，组织 HOW `.trellis/spec/guides/testing.md` |
| **P0 / P1 / S2 / B1–B11** | 交付阶段与 backlog 条目编号，口径与"交付控制台"、`phase-2-backlog` 一致 |
| **ADR** | 架构决策记录（Architecture Decision Record） |

## 精准度原则（最高优先级）

**模块状态文档是当前代码的"可核对镜像"。** 读者读完之后，应该能相信"仓库里真实存在什么"，而不是"计划要做什么"或"某个任务曾经写过什么"。

| 要求 | 说明 |
|------|------|
| **代码是唯一准绳** | 凡写进"已具备"的能力，必须能在源码、测试或环境变量中指出对应的证据路径 |
| **任务记录只作辅证** | task 可以帮助界定范围、挂载 task 编号，但**不能**仅凭 task 记录就提升成熟度评级 |
| **宁缺毋滥** | 不确定的内容，写成"未做 / 待核实"，或者主动降档；禁止含糊其辞、盲目乐观 |
| **默认模式必须写清** | mock 依赖、临时鉴权、被强制关闭的开关，都要写进"默认依赖模式"一栏 |
| **代码变了文档就要跟着变** | 代码已变化而状态文档未更新，就视为文档错误；更新时以当前代码为准覆盖旧描述 |

各种描述发生冲突时，采信顺序为：**源码 > 状态文档旧文 > task / 签字记录（sign-off）的叙述 > spec 顶部的"现状"一句话**。

## 权威顺序（冲突时以谁为准）

| 问题类型 | 以谁为准 | 路径 |
|----------|----------|------|
| **IS · 现在实际有什么** | **源码为真；本文档必须与源码保持同步** | 源码 · `docs/module-status/` |
| **HOW · 代码应该怎么写** | Trellis Spec（工程规范） | `.trellis/spec/` |
| **WHAT · 产品语义 / 接口契约** | PRD SSOT（产品需求唯一来源） | `prds/00–11/` |

补充说明：

- `.trellis/spec` 顶部的"现状 / 占位"描述**可能滞后**。写代码规范时仍然读 spec，但**判断完成度时，不要以 spec 顶部那一句"现状"为准**。
- `prds/12-delivery-guides/` 是面向交付的通俗说明，**不是**接口契约。
- 状态文档写错时，以**源码**为准回写纠正；task / sign-off 仅作对照。禁止用本文档覆盖 PRD 已冻结的产品语义。

## 能力域 × 包（导航索引）

> **角色定位**：回答"某项端到端能力齐不齐"——它是**目录，不是第二套状态正文**。
> **正文仍以包级文档为主**（`docs/module-status/<包>.md`）；矩阵每格只写一句话成熟度 + 涉及的包 + 跳转链接。
> **禁止**在矩阵里展开完整的"已具备 / 未做 / 技术债"清单；细节与证据一律写进包文档。

### 使用规则

| 规则 | 说明 |
|------|------|
| 端到端成熟度 | **只在本矩阵写一次**；各包文档只写本包自身的成熟度 |
| 冲突处理 | 以**代码 + 包文档**为准，再回写本矩阵 |
| 延期能力 | 登记在**总 backlog** [project-backlog](../../.trellis/tasks/08-06-project-backlog/status.md)（调度 + 架构事项）；产品侧 B1–B11 阶段挂账在 [phase-2-backlog](../../.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md)；**本文件不复抄全文** |
| 项目级对外承诺 | 统一链接到 [交付控制台 §0](../../prds/12-delivery-guides/04-交付控制台.md)，本文件不写对外话术长段 |
| 包文档尚未补齐时 | 矩阵仍可标注端到端状态；"详见"一栏指向已有的包文档，或标注"包状态待补" |

### 能力矩阵（2026-08-12 · 08-11/08-12 全量核对）

| 能力域 | 端到端成熟度 | 主包 | 协作包 | 详见 |
|--------|--------------|------|--------|------|
| **入库闭环** | **可演示**（scan/embed/ES **默认 mock**；可显式 `http`+S3+Mongo 打 Docker 中间件；分片策略**仅** `structure_paragraph`；dual-ready 后 `lifecycle` 仍为 **draft**；staging/prod worker 当前没有合法扫描配置） | `worker` | `api` · `db` · `contracts` | [worker](./worker.md) · [api · 入库](./api.md) |
| **问答 ask / 流式输出** | **可演示**（单轮信任环；AI SDK UI Message Stream；检索默认 mock ES；`http` 模式为 sparse 切片，可签字归因，**≠** 生产 ES+IK） | `api` | `web` · `contracts` · `db` | [api · 问答](./api.md) · [web](./web.md) |
| **会话外壳** | **可演示**（列表 / 历史回放；**rewrite 图边已落、默认关**；**显式回溯加深部分**；**文档回溯检索加码部分**；**库外文档回溯抑制部分**；**四态派生部分**；**≠** 准出 / **≠** 对外连续追问） | `api` | `web` · `db` · `contracts` | [api](./api.md) · [web](./web.md) |
| **鉴权 / 访问控制（ACL）** | **可联调**（临时双 JWT；KB 成员 + 权限码；B5 部门骨架；文档部门字段可改（含 complete / 列表列 / 下拉 / 本地筛 / 部门名 / 可见级文案）；grant 表可存可配（部门+用户下拉；行内部门名+可见级文案）；归属可选用户；`DEPT_ACL_ENFORCE` **默认关**，开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树；超管可绕过；列表同滤；可关继承（env + KB 覆盖 + 设置页勾选，未改不写回）；KB `deptAclEnforce` 可覆盖 env（未写跟 env；GET 未写回读 false；设置页可勾选，未改不写回）；设置页可标 `dataClass`（**≠**解禁）；`AUTH_ENFORCE` 默认关；**≠** 全文隔离 / **≠** ES 查询期） | `api` | `admin-catalog` · `admin` · `web` · `contracts` · `db` | [api · 鉴权](./api.md) · [admin-catalog](./admin-catalog.md) |
| **admin 运营面** | **可演示**（S2c + B1–B6 最小 + B7 裁剪 + **B13 反馈队列** + **评测底线**；落地 href **12** 条；面板只读、非 APM / **≠** 签字包） | `admin` | `api` · `admin-catalog` · `contracts` | [admin](./admin.md) · [admin-catalog](./admin-catalog.md) |
| **反馈** | **可联调**（API + **B13** web 答后提交 / admin 队列状态修改） | `api` | `web` · `admin` · `db` | [web](./web.md) · [admin](./admin.md) · [api](./api.md) |
| **模型网关** | **可演示**（供应商 CRUD + **platform** 绑定；运行时 env+platform+**KB 读覆盖**；**无** KB 绑定 HTTP 写；admin KB 写 UI 延后） | `api` | `admin` · `contracts` · `db` | [api](./api.md) · [admin](./admin.md) |
| **观测 / 评测** | **可联调**（进程内 metrics/tracer；L1 gold60 + OPS-1 live；**P2 底线** gold-questions HTTP + `POST eval/runs` 入队 + worker `sr-eval` + admin `/eval`；coverage=0 **≠** 业务 PASS；`eval_runs` 可落库；**mock 禁签字**；**L2 题面 + 工程 runner + 可选 persist 已落**；**有账本 ≠ 准出**；**rewrite 图边已落、默认关**；**L3 打点+告警部分**（**无**自动熔断 / **无**面板 / **≠**准出）） | `api` | `worker` · `admin` · `db` | [api](./api.md) · [worker](./worker.md) · [admin](./admin.md) · [db](./db.md) · [live profile](../ops/live-retrieve-profile.md) |
| **契约 / Schema 基座** | **可联调**（P1/S2 + B1–B6 + **B12 策略码 / IngestJobData**；`eval_runs` 可落；`ingest_jobs` worker 最小 stage 写；同 doc Redis 锁最小） | `contracts` / `db` | 全部业务包 | [contracts](./contracts.md) · [db](./db.md) |
| **工程工具链** | **生产向**（全仓 eslint/tsconfig 基线；无业务完成度故事） | `eslint-config` · `typescript-config` | 全仓 · `ui` | [eslint-config](./eslint-config.md) · [typescript-config](./typescript-config.md) · [ui](./ui.md) |

**半产品可运行缺口（已登记、未实现）**：总 backlog **§1.2 P-HALF**（知识库下拉 / admin 上传 / 上架 active / 一键拉起 / PDF 文本层 / 烟测等）。**未做 ≠ 已具备**。  
**矩阵未覆盖、且明确尚未交付的能力**（不要从「可演示」的行向外推断）：生产级 ES + IK、生产 RustFS at-rest/HA / 生产 Mongo、**rewrite 默认开 / 对外连续追问 / L2 准出**、CRAG / multi_hop、**部门级检索强制默认开 / ES 查询期对称 / 敏感解禁**、权限三表终态、入库 `ingest_jobs` 完整运维查询面（stage 最小写 + 同 doc SET NX 锁最小已有；非 Redlock）、admin 设置全量 UI（docTypes/策略/KB 绑定写）、按历史 indexVersion 浏览分片等 → 详见 [08-06 backlog](../../.trellis/tasks/08-06-project-backlog/status.md) 与交付控制台 §0。  
**安全债（不挡当前主线 · 生产前必清）**：**QUAL-2 真杀毒**（现阶段 mock；DEC-SCAN 已裁决）→ [worker · 技术债](./worker.md)。  
（**已交付勿再列未做**：B2-W mode/docTypes 闸、B4-W hydrate、B12 策略闸、B13 feedback UI、08-12 SPEC-HOW 挂账 archive。）

## 目录约定

| 路径 | 说明 |
|------|------|
| `docs/module-status/README.md` | 本索引 + **能力矩阵** + 写法约定 |
| `docs/module-status/<包名>.md` | 单个模块的状态（**IS 主文档**；包名与 `.trellis/spec` 的包键对齐） |

**主轴**：一个包对应一个文件（可被 skill 自动回写、可挂证据链接）。
**导航**：使用上文的能力矩阵（它是派生索引；禁止把它独立扩写成完整的能力状态正文）。

**包清单（与 monorepo 结构及 trellis spec 对齐）**：

| 包 | 路径 | 状态文档 | 模板档位 | 备注 |
|----|------|:--------:|----------|------|
| `api` | `apps/api` | [api.md](./api.md) | 完整六段 | ✅ |
| `worker` | `apps/worker` | [worker.md](./worker.md) | 完整六段 | ✅ |
| `web` | `apps/web` | [web.md](./web.md) | 完整六段 | ✅ |
| `admin` | `apps/admin` | [admin.md](./admin.md) | 完整六段 | ✅ S2c 薄壳 |
| `contracts` | `packages/contracts` | [contracts.md](./contracts.md) | 完整六段 | ✅ 按契约域组织 |
| `db` | `packages/db` | [db.md](./db.md) | 完整六段 | ✅ 按 schema 域组织 |
| `admin-catalog` | `packages/admin-catalog` | [admin-catalog.md](./admin-catalog.md) | 中等 | ✅ 权限码 + 菜单 |
| `ui` | `packages/ui` | [ui.md](./ui.md) | 中等 | ✅ Soft Bento 主题 + 首批原子组件 |
| `eslint-config` | `packages/eslint-config` | [eslint-config.md](./eslint-config.md) | 极简 | ✅ |
| `typescript-config` | `packages/typescript-config` | [typescript-config.md](./typescript-config.md) | 极简 | ✅ |

## 成熟度标签（统一口径）

| 标签 | 含义 |
|------|------|
| **骨架** | 能编译、能起进程；但几乎没有业务能力 |
| **可联调** | 主路径可以跑通，但依赖 mock 或开发开关 |
| **可演示** | 有一条可以展示的垂直切片；**不等于**生产就绪 |
| **生产向** | 真实依赖、质量门禁、运维面都已齐备（当前仓库的业务包很少达到这一档）。**特例**：纯工具链包（eslint/tsconfig）打此标签表示"全仓在用的共享基线"，**不**表示任何业务 SLA |

**使用规则**：

- 元信息里的"成熟度"**只允许填一个主标签**（四选一）。
- 补充说明写在括号内，例如：`**可演示**（依赖 mock ES）`。
- **禁止**写成 `可联调 / 可演示` 这类双标签并列。

阶段话术：`P0` / `P1` / `S2 最小` 等编号与交付控制台、`phase-2-backlog` 保持一致；**禁止**把"S2 最小"写成"Phase 2 全文"。

## 单模块文档结构（固定）

每份 `<包名>.md` 保持简短、可快速扫读，固定包含以下六段：

1. **元信息表**（路径、成熟度、最近更新、spec/PRD 指针；建议包含默认依赖模式）
2. **一句话状态**
3. **已具备能力**（按功能分类列点）
4. **明确未做 / 边界**（本包自身的能力边界；属于其他包的 UI 挂账请另起一小节或交叉引用，不要混在一起）
5. **技术债**
6. **证据**（关键路径、单测、关联 task；路径尽量写成 `apps|packages/<pkg>/…` 形式）

更新时机（后续将 skill 化）：

```text
task 完成
  → 更新触及到的包的 docs/module-status/<包>.md
  → 若端到端能力成熟度发生变化 → 只改上文矩阵的对应行（不写长篇叙述）
  → 延期 / 被裁掉的能力 → 记入 backlog；对外承诺边界变化 → 交付控制台 §0
  → 写法约定变化 → 改 .trellis/spec
```

## 交叉引用

- 交付总览（项目望远镜）：`prds/12-delivery-guides/04-交付控制台.md` §0
- 项目总 backlog（活跃 · 调度 + 架构事项）：`.trellis/tasks/08-06-project-backlog/status.md`
- P2 产品挂账（已归档 · 仅 B1–B11）：`.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md`
- S2 epic 签字记录（已归档）：`.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md`
- 工程约定（HOW）：`.trellis/spec/`（含 `api/backend/ask-pipeline.md` · `api/backend/l1-eval.md`）
- 产品 SSOT（WHAT）：`prds/00–11/`
- 包级显微镜（IS）：本目录下的 `<包>.md`
