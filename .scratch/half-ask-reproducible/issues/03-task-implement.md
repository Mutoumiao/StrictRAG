# 03 · 落：按 02 的裁定实现（桩 或 可诊断失败 + 文档）

Type: task
Status: open
Parent: ../map.md
Blocked by: 02

## Question

按工单 02 择定的路落地，并把裁定里的禁则逐条守住。

**要求**：
- 若路 A：桩实现 + 接入方式 + 启动标注；`scripts/smoke-half.mjs` 的输出须让人一眼看出这一跑用的是桩；**生产档位拒绝启用**（用测例钉住）。
- 若路 B：`smoke:half` 的失败诊断分支（可分辨「缺 Gateway」与「管道坏了」）+ 文档落点。
- 两路都：新增/改动的脚本测例进 `scripts/*.test.mjs`（`node --test`），仓库根 `scripts/*.test.mjs` 的既有测例不得变红；`pnpm check-types` + `pnpm lint` 零 warning + 全仓 `pnpm test --concurrency=1`。
- **反证**：每一处「闸 / 标注 / 拒绝启用」都要能临时放宽后见红，跑完还原。

## Answer

**落地的文件**：

| 文件 | 内容 |
|---|---|
| `scripts/stub-gateway.mjs`（新） | dev-only **抽取式**桩：独立进程、http 内置模块、**零外部依赖**；`POST /chat/completions`（**也**响应 `/v1/chat/completions`，按 `messages[0].content` 分成 generate / claim_split / judge 三种响应）· `POST /embeddings` **与** `/v1/embeddings` · `POST /rerank` · `GET /v1/models` · `GET /__stub`（自证身份）；端口 `STUB_GATEWAY_PORT`（默认 4100）、维度 `STUB_GATEWAY_EMBED_DIMS`（默认 8）；**生产档位（`APP_ENV` / `NODE_ENV=production`）拒绝启动**；启动打印响亮 banner；**确定性**（无 `Date` / 随机） |
| `scripts/smoke-half.mjs`（改） | 探 `GET {base}/__stub`（仅 `res.ok ∧ json.stub===true` 才判为桩，真网关 404 / 非 JSON / 超时都不误判）→ 输出标注 `gateway=stub`；末步失败按三类给可诊断提示；**未设** `GATEWAY_BASE_URL` 时**判定与退出码不变**（仅失败路径新增诊断行） |
| `scripts/stub-gateway.test.mjs`（新） | **11 例**：身份端点 / generate 抽取且 `citations` 逐字取自 EVIDENCE / 无证据 → `insufficient:true` / claim_split ⊂ citations / judge 长度与值域 / embed 条数与维度与确定性 / rerank / 两条 embeddings 前缀 / `APP_ENV` 与 `NODE_ENV` **两档**生产护栏 / **语义局限如实钉住** |
| `docs/ops/half-smoke.md`（改） | 三条契约最小形状表 · 可核命令 · 用桩两步 · 桩口径与**已知局限** · 失败三形态 · 前置重写（`.env.operable.example` / 进程 env 覆盖 / 就绪检查 / dev-login 依赖 / PowerShell 写法） |
| `package.json`（改） | 新增 `stub:gateway`（**不动任何默认链路**） |
| `docs/testing/README.md`（改） | 脚本测例登记 |

**反证（放宽 → 见红，事后还原并复跑全绿）**：① 桩无证据也编答案 → 测例红；② 去掉生产护栏（`APP_ENV` 档 / `NODE_ENV` 档）→ 对应测例红；③ `citations` 取提示之外的 id → 测例红；④ 去掉 `smoke:half` 的桩标注 → 标注断言红。

**诚实边界**：桩的抽取按**单字 token 重叠**，与语料无关但共享单字的问题**仍可能** `answered` —— 已写进源码注释、清单页、模块状态三处，并由一条测例**如实钉住**（不许有人把它当相关性判据）。
