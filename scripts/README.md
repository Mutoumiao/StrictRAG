# scripts

| 脚本 | 用途 |
|------|------|
| `up-stack.mjs` | HALF-UP：compose 中间件 + api + worker（`pnpm up:apps`） |
| `smoke-half.mjs` | HALF-SMOKE：单篇 txt→active→ask 有引用（`pnpm smoke:half`） |
| `smoke-ask.mjs` | HALF-SMOKE：ask 信封 citations 判定（与 `smoke-ask.test.mjs` 共用） |
| `seed-demo.mjs` | HALF-SEED：1 KB + 成员 + 1 篇 active 文档（`pnpm seed:demo`） |
| `demo-ingest.mjs` | Phase 1 同 KB ≥10 篇入库闭环回归（`pnpm demo:ingest`） |
| `demo-ingest.md` | 演示说明与 curl 排障 |
| `module-status/extract.mjs` | 代码事实提取器（env 默认值 / 导出符号 / 路由端点 / 表 / 测试文件），draft 与 check 共用 |
| `module-status/draft.mjs <pkg>` | 获取环：输出本包事实清单，供核对回写 `<包>.md`（`pnpm draft:module-status api`） |
| `module-status/check.mjs` | 验证环：文档声称 ↔ 代码事实对照，输出漂移报告（`pnpm check:module-status`；默认恒 exit 0 不阻塞，`--fail` 有漂移 exit 1，`--json` 输出机器可读 findings） |
| `module-status/report.mjs` | 报告生成器：跑 check 生成漂移报告；默认落成 Trellis task（prd.md），`--out` 写指定文件/目录 |

运行 demo 前：PG+Redis · migrate · `dev:api` · `dev:worker`。

## module-status 一致性流程

**主路径（自动化确认）**：直接运行 `update-module-status` skill。Agent 默认逐包全量核对 `docs/module-status/` 包清单中的每个包（已具备能力 / 未做边界 / 成熟度 / 技术债 / 证据），有差异即回写，最后跑 `pnpm check:module-status` 验收零漂移；用户指定包时只核对指定包。

脚本三环（skill 内部会调用，也可人工单独跑）：

1. 获取环：`pnpm draft:module-status <pkg>` 输出代码事实清单（env / 符号 / 端点 / 表 / 测试），供核对回写
2. 验证环：`pnpm check:module-status` 输出漂移报告（默认恒 exit 0 不阻塞，`--fail` 有漂移 exit 1，`--json` 机器可读）
3. 报告环：`node scripts/module-status/report.mjs` 跑 check 并落盘（默认 Trellis task，`--out` 文件）

检查项：1 路径存在性 · 2 env 默认值 · 3 导出符号 · 4 路由端点（api）· 5 表名 · 6 变更联动（git 工作区）· 7 时效性（文档「最近更新」日期 vs git 提交历史）

### 漂移报告（留痕 / 审计入口，可选）

需要把漂移报告落成 Trellis task 或文件、留待人工安排 Agent 时：

1. 生成报告：`node scripts/module-status/report.mjs`
   - 默认：有漂移时创建/更新 Trellis task `.trellis/tasks/<MM-DD>-module-status-drift`，报告写入其 `prd.md`；零漂移则提示可归档该 task
   - `--out <file|dir>`：把报告写到指定文件/目录（不创建 task）
2. 人工安排 Agent：查阅该 task（或报告文件），运行 `update-module-status` skill 按报告核对回写
3. 验收：`pnpm check:module-status` 零漂移；随后手动归档 task（`python .trellis/scripts/task.py archive module-status-drift`）

