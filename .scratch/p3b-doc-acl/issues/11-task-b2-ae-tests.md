# 落 B2 / AE 剧本的自动化断言

Type: task
Status: open
Blocked by: 03, 08, 09

## 做什么

按 `03-research-p3b-test-map.md` 的缺口清单，为 B2-1…B2-4 与 AE4–AE8、AE10–AE12 补自动化断言。全部在**显式开启强制**（KB 覆盖或测例内 env 注入）的配置下跑，且不改仓库默认开关。

## 完成判据

- 每条补的断言都要有反证方式并在 Answer 里记录（破坏哪一处会让它变红）。
- 测例落在 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头目标/需求/被测/简介用简体中文，并登记 `tests/index.md`。
- 明确标出哪些缺口**必须真 ES 集群**（不写成可做）。
- `pnpm check-types` + `pnpm lint` + 相关包测试全绿。

## Answer

（待填）
