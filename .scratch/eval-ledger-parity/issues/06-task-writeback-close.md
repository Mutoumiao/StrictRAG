# 回写 + 收口门禁

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 05

## Question

把本图的落地与实测按仓内纪律回写，然后收口。范围：

1. **镜像（IS）**：`docs/module-status/worker.md`（评测路径接账本、三态语义、边界）、`api.md` 与 `contracts.md`（若契约 / 白名单有变）。**写回纪律**：正文不写 `路径:行号`，不给裸标识符加反引号（守 `check:module-status` 的 `3-符号` / `5-表`）。
2. **配方与证据**：`docs/ops/operable-stack.md`（worker 侧账本的设置与拒跑语义）、`docs/ops/real-stack-evidence.md`（新增一节，含对照表与留痕目录名，写明**不是签字数字**）。
3. **覆盖表**：`docs/testing/coverage.md` 追加新一轮（**无行级值变化就明写无变化**），`docs/testing/coverage/03-ops.md` 等分册里与评测路径 / Hit@k 相关的**缺口列**按源码新状改写（覆盖值不动）。
4. **HOW**：`.trellis/spec/api/backend/l1-eval.md` · `l2-eval.md` 与 worker 侧对应 spec，写清 worker 侧账本来源、读取时机、失败语义、与 CLI 的同名同义关系。
5. **雾清单**：`.scratch/fog-inventory-2026-09-23.md` 追加 2026-09-29 动态注记（本图挑的雾 + 结论 + 未解决的部分）。
6. **收口门禁（必须在最后一次提交之后复跑）**：`pnpm check-types`（8/8）· `pnpm lint`（8/8 零 warning）· `pnpm run test --concurrency=1`（全绿）· `node scripts/module-status/check.mjs`（**39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` 三类**为空**）· `git status --short` 干净。
7. **对抗性反向复核**：逐条核「镜像里这句话在源码里真能指到吗」，把复核结论写进本工单 Answer（前图纪律）。
8. **地图封图**：`map.md` 补 `## Decisions so far` 六行、`Status: resolved`、`Not yet specified` 按本图新事实重写。

## Answer

**已解**。回写由一名文档回写子代理执行，主控逐条读 diff 复核 + 抽验源码。

### 回写面（9 个文件）

| 文件 | 改了什么 |
|---|---|
| `docs/module-status/worker.md` | 「最近更新」加 2026-09-29 条目（worker 接账本 / 三态 / 读取时机 = 每次 job / 落库取真值 / **判定仍在 api 侧**）；把文末「worker 批跑本图不接映射账本」整段改写为接账本；两处 `docHitRate` 口径由「未映射恒 0」改为「**未传账本**恒 0」；「默认 execute」条补账本来源 |
| `docs/module-status/api.md` | 「最近更新」加条（`GET …/eval/runs/:runId` 透出三键 + worker 现已接账本）；改掉「worker 侧不接账本」句；证据表补 `tests/eval/eval-run-dto-doc-map.test.ts` |
| `docs/module-status/contracts.md` | 新子路径 `@strict-rag/contracts/eval-corpus-ledger-file`（用途 + 为何走子路径不进主入口）；`EvalRunSchema` 三可选字段；re-export 说明 |
| `docs/ops/operable-stack.md` | 评测语料账本节补 **worker 队列路径**用法与三态；新增排障段，写入三条环境坑（turbo `dev` 任务 env 白名单过滤 operable 变量 / `pnpm --filter` 的 `@` 经 `.cmd` 被拼坏 / Docker 自退后 ES host 端口转发丢失须 `restart` 容器） |
| `docs/ops/real-stack-evidence.md` | 新增 **§8**：链条首次贯通 · 三态对照表 · 库内原始形状 · 留痕（本轮账本 + 坏账本）· 「不是签字数字」边界 · 环境坑三条 · 未核实项 |
| `docs/testing/coverage.md` | **第十二轮**（明写**无行级覆盖值变化**，四册合计仍 280 / 163 / 59）；「当前保持部分测的行」里 L2 的表述同步 |
| `docs/testing/coverage/03-ops.md` | **C4** 与派生行 **L2** 的缺口列改写（**覆盖值不动**：C4 仍 `已测`、L2 仍 `部分测`；L2 阻塞方收窄为「live 真跑归档 + RACI 人签」）；分册计数补「第八轮」 |
| `.trellis/spec/api/backend/l1-eval.md` · `l2-eval.md` | worker 侧账本语义（来源 / 每次 job / 三态 / 失败语义 / 与 CLI 同名同义 / 共享子路径）；`Hit@k` 口径由「人工处理」改为「按账本解析」 |
| `.scratch/fog-inventory-2026-09-23.md` | 追加 2026-09-29 注记（本图挑的雾 = 前图 A 段第一条 · 结论 = 双入口同含义 + 三态实测 · 未解决三项 · 汇总表不逐行改的理由） |

### 收口门禁

- `pnpm check-types` → **8/8 successful**
- `pnpm lint` → **8/8 successful**（零 warning）
- `pnpm run test --concurrency=1` → **11/11 包 successful**（admin 38 文件 / 187 测试；api 182 文件 / 1134 通过；worker 61 文件 / 275 通过；contracts 35 文件 / 298 通过）
- `node scripts/module-status/check.mjs` → **39 条 = 2-env + 13-符号 + 24-表**，`1-路径` / `6-联动` / `7-时效` **三类为空**（基线保持）

### 对抗性反向复核（前图纪律，抽验 5 条最关键的镜像声明）

| 镜像声明 | 源码锚点 | 结论 |
|---|---|---|
| worker 读与 api CLI 同名同义的进程级 env | `apps/worker/src/env.ts:84-85` 两键声明 | ✓ |
| 路径取自 env 快照、每次 job 传入 | `apps/worker/src/eval/consumer.ts:20` `docMapPathOf` · `:67` / `:116` 两处传参 | ✓ |
| 落库三键取**报告真值**（不再硬编码） | `apps/worker/src/eval/persist.ts:145-147` · `:191-193` | ✓ |
| 报告 DTO 透出三键 + 缺键容错 | `apps/api/src/services/eval-runs.ts:139-140` · `:245` | ✓ |
| 共享读取面走 contracts 子路径 | `packages/contracts/package.json` 的 `./eval-corpus-ledger-file` | ✓ |

子代理自陈的一处保留：`docs/testing/coverage/03-ops.md` 的 C4 行在「第八轮」历史注记里**用引号保留了旧措辞**（「不接账本」）作为变更痕迹，不是生效口径 —— 主控判定可接受（生效口径已改写），未再删。
