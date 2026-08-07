# 模块状态文档 · Module Status

> **用途**：一眼看清「某模块已经具备什么、卡在什么阶段、有什么债」。  
> 供人工审查与 Agent 交接；**不是**接口契约。

## 精准度原则（最高优先级）

**模块状态文档 = 当前代码的可核对镜像。** 读者应能据此相信「仓库里真实有什么」，而不是「计划做什么」或「task 写过什么」。

| 要求 | 说明 |
|------|------|
| **代码为唯一准绳** | 「已具备」必须能在源码/测试/env 中指到证据路径 |
| **task 只作辅证** | 帮助定范围、挂 task id；**不能**单独支撑成熟度升级 |
| **宁缺毋滥** | 不确定 → 写「未做 / 待核实」或降档，禁止含糊乐观 |
| **默认模式必写清** | mock / 临时鉴权 / 强制关闭的开关写进「默认依赖模式」 |
| **有码即更** | 代码已变而状态文档未变 = 文档错误；更新时以现码覆盖旧描述 |

冲突时：**源码 > 状态文档旧文 > task/sign-off 叙事 > spec 顶部「现状」一句话**。

## 权威顺序（冲突时）

| 问什么 | 以谁为准 | 路径 |
|--------|----------|------|
| **IS · 现在有什么** | **源码为真；本文档须与之同步** | 源码 · `docs/module-status/` |
| **HOW · 怎么写** | Trellis Spec | `.trellis/spec/` |
| **WHAT · 产品语义 / 接口契约** | PRD SSOT | `prds/00–11/` |

说明：

- `.trellis/spec` 顶部「现状 / 占位」**可能滞后**；写代码规范仍读 spec，**判断完成度不要以 spec 一句话现状为准**。
- `prds/12-delivery-guides/` 是交付白话，**不是**接口契约。
- 状态文档写错时以 **源码** 回写纠正；task/sign-off 仅作对照，禁止用本文档覆盖 PRD 冻结语义。

## 能力域 × 包（导航索引）

> **角色**：回答「端到端某能力齐了吗？」——**目录，不是第二套状态正文**。  
> **主轴仍是包级文档**（`docs/module-status/<包>.md`）；矩阵只写一句话成熟度 + 包落点 + 深链。  
> **禁止**在矩阵展开完整「已具备 / 未做 / 债」；细节与证据一律进包文档。

### 使用规则

| 规则 | 说明 |
|------|------|
| 端到端成熟度 | **只在本矩阵写一次**；包文档写本包成熟度 |
| 冲突 | 以 **代码 + 包文档** 为准，再回写矩阵 |
| 延期能力 | **总 backlog** [project-backlog](../../.trellis/tasks/08-06-project-backlog/status.md)（调度 + ARCH）；产品 B1–B11 阶段挂账 [phase-2-backlog](../../.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md)；**不在此复抄全文** |
| 项目级承诺 | 链 [交付控制台 §0](../../prds/12-delivery-guides/04-交付控制台.md)，不在此写对外话术长段 |
| 包文档待补 | 矩阵仍可标端到端状态；「详见」指向已有包文或标注「包状态待补」 |

### 矩阵（2026-08-07）

| 能力域 | 端到端成熟度 | 主包 | 协作包 | 详见 |
|--------|--------------|------|--------|------|
| **入库闭环** | **可演示**（scan/embed/ES 默认 mock；本地存储） | `worker` | `api` · `db` · `contracts` | [worker](./worker.md) · [api · 入库](./api.md#入库p1) |
| **问答 ask / 流** | **可演示**（单轮信任环；AI SDK UI Message Stream；检索默认 mock ES） | `api` | `web` · `contracts` · `db` | [api · 问答](./api.md#问答s2-最小) · [web](./web.md) |
| **会话壳** | **可演示**（列表/历史回放；**rewrite 关**） | `api` | `web` · `db` · `contracts` | [api · 问答](./api.md#问答s2-最小) · [web](./web.md) |
| **鉴权 / ACL** | **可联调**（临时双 JWT；KB 成员 + 权限码骨架） | `api` | `admin-catalog` · `admin` · `web` · `contracts` | [api · 鉴权](./api.md#鉴权与权限) · [admin-catalog](./admin-catalog.md) |
| **admin 运营面** | **可演示**（S2c 审批/成员 + B1/B2 + **B3 模型网关最小** + B7 菜单 clip；全量运营面见 backlog） | `admin` | `api` · `admin-catalog` · `contracts` | [admin](./admin.md) · [admin-catalog](./admin-catalog.md) · backlog B4–B6 |
| **反馈** | **可联调**（API 已有；web **无**反馈 UI） | `api` | `web`（未接 UI）· `db` | [api](./api.md) · [web](./web.md) |
| **模型网关** | **可演示**（Provider CRUD + 平台绑定 + admin `/models`；**Gateway 运行时仍 env**；无 KB 绑定） | `api` | `admin` · `contracts` · `db` | [api · 模型供应商](./api.md) · [admin · 模型网关](./admin.md) · backlog 余量（运行时接线） |
| **观测 / 评测** | **骨架**（进程内 metrics/tracer；无 L1 黄金集门禁） | `api` | — | [api](./api.md) · backlog B10 |
| **契约 / Schema 基座** | **可联调**（支撑 P1/S2 路径；随能力扩展） | `contracts` / `db` | 全业务包 | [contracts](./contracts.md) · [db](./db.md) |
| **工程 tooling** | **生产向**（共享 eslint/tsconfig；无业务完成度故事） | `eslint-config` · `typescript-config` | 全仓 · `ui` | [eslint-config](./eslint-config.md) · [typescript-config](./typescript-config.md) · [ui](./ui.md)（可联调 · S2 原子） |

**矩阵未覆盖、且明确未交付的能力**（勿从「可演示」行外推）：生产 ES+IK、真 RustFS/Mongo、rewrite/连续追问、CRAG/multi_hop、部门强制隔离、KB 设置全文（docTypes/分片/模型绑定）、ask `allowedModes` 闸、历史 indexVersion 分片浏览等 → 见 backlog 与交付控制台 §0。

## 目录约定

| 路径 | 说明 |
|------|------|
| `docs/module-status/README.md` | 本索引 + **能力矩阵** + 写法约定 |
| `docs/module-status/<包名>.md` | 单模块状态（**IS 主文档**；与 `.trellis/spec` 包键对齐） |

**主轴**：一包一文件（可被 skill 回写、可挂证据）。  
**导航**：上文能力矩阵（派生索引；禁止独立写成完整能力状态文）。

**包清单（与 monorepo / trellis spec 对齐）**：

| 包 | 路径 | 状态文档 | 模板档 | 备注 |
|----|------|:--------:|--------|------|
| `api` | `apps/api` | [api.md](./api.md) | 完整六段 | ✅ |
| `worker` | `apps/worker` | [worker.md](./worker.md) | 完整六段 | ✅ |
| `web` | `apps/web` | [web.md](./web.md) | 完整六段 | ✅ |
| `admin` | `apps/admin` | [admin.md](./admin.md) | 完整六段 | ✅ S2c 薄壳 |
| `contracts` | `packages/contracts` | [contracts.md](./contracts.md) | 完整六段 | ✅ 按契约域 |
| `db` | `packages/db` | [db.md](./db.md) | 完整六段 | ✅ 按 schema 域 |
| `admin-catalog` | `packages/admin-catalog` | [admin-catalog.md](./admin-catalog.md) | 中等 | ✅ 权限码 + 菜单 |
| `ui` | `packages/ui` | [ui.md](./ui.md) | 中等 | ✅ Soft Bento theme + 首批原子 |
| `eslint-config` | `packages/eslint-config` | [eslint-config.md](./eslint-config.md) | 极瘦 | ✅ |
| `typescript-config` | `packages/typescript-config` | [typescript-config.md](./typescript-config.md) | 极瘦 | ✅ |

## 成熟度标签（统一口径）

| 标签 | 含义 |
|------|------|
| **骨架** | 能编译/起进程；业务能力几乎无 |
| **可联调** | 主路径可跑，依赖 mock 或 dev 开关 |
| **可演示** | 垂直切片可展示；**≠** 生产就绪 |
| **生产向** | 真依赖、门禁、运维面齐备（当前仓库业务包很少到此）。**特例**：纯 tooling 包（eslint/tsconfig）表示「全仓在用的共享基线」，**不**表示业务 SLA |

**规则**：

- 元信息「成熟度」**只允许一个主标签**（四选一）。  
- 补充说明写在括号内，例如：`**可演示**（依赖 mock ES）`。  
- **禁止**写成 `可联调 / 可演示` 这类双标签。

阶段话术：`P0` / `P1` / `S2 最小` 等与交付控制台、`phase-2-backlog` 一致；**禁止**把「S2 最小」写成「Phase 2 全文」。

## 单模块文档结构（固定）

每份 `<包名>.md` 保持短、可扫：

1. **元信息表**（路径、成熟度、最近更新、spec/PRD 指针；建议含默认依赖模式）
2. **一句话状态**
3. **已具备能力**（按功能分类列点）
4. **明确未做 / 边界**（本包能力边界；他包 UI 挂账另起一小节或交叉引用，勿糊在一起）
5. **技术债**
6. **证据**（关键路径、单测、关联 task；路径尽量带 `apps|packages/<pkg>/…`）

更新时机（后续 skill 化）：

```text
task 完成
  → 更新触达包的 docs/module-status/<包>.md
  → 若端到端能力成熟度变化 → 只改上文矩阵对应行（不写长叙事）
  → 延期/裁出能力 → backlog；对外承诺边界变化 → 交付控制台 §0
  → 写法约定变化 → .trellis/spec
```

## 交叉引用

- 交付总览（项目望远镜）：`prds/12-delivery-guides/04-交付控制台.md` §0  
- 项目总 backlog（活 · 调度 + ARCH）：`.trellis/tasks/08-06-project-backlog/status.md`  
- P2 产品挂账（归档 · 仅 B1–B11）：`.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md`  
- S2 epic 签字（归档）：`.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md`  
- 工程约定（HOW）：`.trellis/spec/`（含 `api/backend/ask-pipeline.md`）  
- 产品 SSOT（WHAT）：`prds/00–11/`  
- 包显微镜（IS）：本目录 `<包>.md`
