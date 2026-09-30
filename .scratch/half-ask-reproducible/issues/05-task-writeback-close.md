# 05 · 回写镜像 + 收口门禁 + 反向复核 + 封图

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 03, 04

## Question

回写受影响的文档、跑收口门禁、做对抗性反向复核、封图。

## Answer

**回写**：

| 类 | 文件 | 写了什么 |
|---|---|---|
| 清单页 | `docs/ops/half-smoke.md` | 「前置」重写（`.env.operable.example` / 进程 env **覆盖** `.env`（含空值）/ 就绪可核命令 / **dev-login 硬依赖** `AUTH_ENFORCE` 关 / **PowerShell 写法**）；新增「三条契约最小形状」表、「可核命令」、「用桩（dev-only）」两步、「末步失败的三种可分辨形态」、桩口径声明 |
| 运维 | `docs/ops/operable-stack.md` | 末步 ask 的环境前置与两种失败形态 + 用桩两步 + 桩口径；指向清单页 |
| IS 镜像 | `docs/module-status/README.md`（半产品段） | 把「是否另建 dev-only 桩属产品决定，**未做**」改为终态：桩存在、接入方式、抽取式口径、生产拒绝启动、`gateway=stub` 标注，以及「**用桩的 PASS 只证明管道接对，不是质量证据，不得进签字包**；仓库默认一个字未改」 |
| 派生对照 | `docs/testing/coverage.md` | 新增 **第十四轮** 叙述（覆盖值零变化，写明本图与 38 簇无对应关系） |
| 导航 | `.scratch/fog-inventory-2026-09-23.md` | 簇 39 收口注记 |
| 本图 | `.scratch/half-ask-reproducible/map.md` + 五张工单 | 裁定 / 落地 / 真跑 / 目的地达成 / 雾的余量 / 封图 |

**为什么没动 `docs/module-status/api.md`**：本图对 `apps/` 是**零改动**（桩是 `scripts/` 下的独立进程，由 `GATEWAY_BASE_URL` 指过去），api 包的「已具备 / 未做」没有任何变化 —— 写它反而是往镜像里塞不属于该包的东西。

**收口门禁（最后一次提交之后复跑）**：`pnpm check-types` **8/8** · `pnpm lint` **8/8 零 warning** · `node --test scripts/{stub-gateway,smoke-ask,up-stack,seed-demo}.test.mjs` **21/21** · `pnpm --dir apps/api test` **183 文件 / 1144 通过** · `pnpm --dir apps/worker test` **61 / 283** · 全仓 `pnpm test --concurrency=1` **11/11 包** · `pnpm check:module-status` **39 条**（`1-路径` / `6-联动` / `7-时效` 三类为空，与基线同）。

**对抗性反向复核**：独立代理逐条核「镜像的话在源码 / 脚本里真能指到吗」，查出 **4 处需收紧**并全部修正：① 测例数写「13 例」实为 **9**（反向复核实跑 `# tests 9`）→ 去掉虚数并**补两条测例**（`NODE_ENV` 生产护栏 + 语义局限如实钉住），现为 **11 例**；② **桩的语义局限只写在源码注释里、第三人可读的三处文档都没写** → `docs/ops/half-smoke.md` / `docs/module-status/README.md` / `docs/ops/operable-stack.md` 三处补齐「抽取按单字 token 重叠 → 与语料无关但共享单字的问题仍可能 answered，**不是相关性判据**」；③ 「默认行为不变」**过宽** —— 判定与退出码确实未变，但**失败路径新增了诊断行** → 措辞收紧到「判定与退出码不变，失败路径新增诊断」；④ 清单页「配了 `GATEWAY_BASE_URL` → `up`」**过简** —— 实为「配且探活成功 → up；配但探活失败 → down；未配 → skipped」→ 改写。

**封图**：前沿已空，`Status: resolved`。

## Comments

（反向复核结论待独立代理回报后回填；发现即修，修完复跑 `check:module-status` 并要求 `1/6/7` 仍为空。）
