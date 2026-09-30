# 04 · 真栈真跑：无 key 机器上拉起 → 末步给出可解释结果

Type: task
Status: open
Parent: ../map.md
Blocked by: 03

## Question

在本机（**不设任何第三方 key**）跑一遍完整 DoD：`docker compose up -d` → `pnpm up:apps` → `pnpm db:migrate` → `pnpm smoke:half`，记录：

- 末步的**逐字输出**与退出码；
- 若路 A：`PASS` 且 `citations ≥ 1`，且输出**能看出用的是桩**；再补一条反证 —— 让桩在生产档位下被拒（或声明生产档位时启动失败）；
- 若路 B：失败输出**自解释**（缺 Gateway / 缺哪条契约 / 该读哪份文档），且改用真 Gateway 时（若本机确有可达的兼容服务）能走到 `PASS`；否则如实写「未验」；
- 前置清单里的**暗礁**（前图记过的 `SUPER_ADMIN_*` 必配、四眼需第二身份、turbo dev 的 env 白名单）是否都还在文档里。

证据写 `.scratch/half-ask-reproducible/research/04-*.md`；**mock / 桩口径必须显式标注**（不是质量证据、不是签字数字）；Docker 自退时留痕后重跑。

## Answer

（待回填）
