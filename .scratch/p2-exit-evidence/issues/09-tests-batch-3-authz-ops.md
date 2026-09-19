# 补测批 3 · 鉴权矩阵与运营壳

Type: task
Status: open
Blocked by: —

## Question

把覆盖表 P2 必签余量中「鉴权矩阵与运营壳」这 38 行补到有实质断言：**B1-2 · B1-3 · B1-5 · B1-8 · B1-A3 · S2 · S3 · S5 · S8 · S9 · Y2 · Y3 · Y5 · W6 · W8 · Z4 · Z5 · Z6 · Z8 · AE1 · X2 · X7 · G1 · G2 · G3 · O2 · P6 · T1 · T2 · T3 · AB1 · AB2 · AB5 · AB7 · AC6 · AD5 · AD9 · AD10**。

预计约 40 条 `it`。**先建「`AUTH_ENFORCE=true` 权限矩阵」夹具**（落 `apps/api/tests/auth/enforce-permission-matrix.test.ts`），一次吃掉 B1-2 / B1-8 / S2 / S8 / Y3 五行；其余为 HTTP 与 RTL 断言的机械补齐。完整落点清单见 `research/coverage-partial-tests.md` 末节批 3。

约束：**禁止**把仓库默认 `AUTH_ENFORCE` 改成 on（权限矩阵夹具须在测试内部显式开启，不落 `.env` 默认）；门禁只加严不放宽；测例登记各包 `tests/index.md`。

## Answer

（进行中）
