# admin 脆弱测例超时热修最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Blocked by: 101

## Question

工单 97 的同一脆弱类在 admin 包复现：全量 `pnpm test`（11 个 turbo 任务并行）时，`apps/admin` 两条 jsdom + RTL 用例越过 vitest 默认 `testTimeout: 5000` —— `tests/kb/create-kb.test.tsx > 建库入口 > …` 与 `tests/ops/departments-workspace.test.tsx > DepartmentsWorkspace > 提交新建会调 createGrant`（两条都报 `Test timed out in 5000ms`，同一次跑里出现）。

判定依据：**本批改动（99/100/101）完全没有碰 `apps/admin`**；同一命令在本轮此前多次运行里 admin 均 34 files / 169 passed。属负载敏感的既有脆弱测例，与工单 97 同根：渲染 + 交互的真实耗时在并行抢 CPU 时越过 5s。

口径同 97：只调**超时预算**并写明理由；**禁止**删断言 / 改 mock / `skip` / 放宽 eslint。判定标准也沿用 97：只在**观察到红**时才加预算（web 包至今未出现，故本轮不动 web）。

### 做

- `apps/admin/vitest.config.ts` 显式设 `testTimeout`（20s 量级）+ 注释写明本包含 jsdom 渲染 + 用户交互的集成式用例，5s 在并行负载下会抖。
- 连跑两次 `pnpm --filter @strict-rag/admin test` 确认不再出现 `timed out`。

### 不做

- 不改任何用例的断言 / mock / 覆盖；不 `skip`；不动 `apps/web` 的配置（未观察到红）；不改其它包超时。
- 不改 `prds/00–11`；不 `task.py create`；禁止 push。

## Answer

**做了什么**：`apps/admin/vitest.config.ts` 增 `testTimeout: 20_000` + 理由注释（jsdom 渲染 + 交互类用例在并行负载下会抖，放宽只影响失败暴露时间）。

**没做什么**：未动任何用例；未动 `apps/web`（未观察到红，按「只在观察到红时才加预算」的口径保留原状）。

**验证**：连跑两次 `pnpm --filter @strict-rag/admin test` → **两次都 34 files / 169 passed，无 `timed out`**；随后全仓 `pnpm test` 11/11 全绿。

## Comments

- 2026-09-16 由 101 的全仓门禁暴露（同一脆弱类第二次出现）。属清理债，随本批一起收。
