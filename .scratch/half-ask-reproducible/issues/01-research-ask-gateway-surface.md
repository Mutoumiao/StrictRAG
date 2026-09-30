# 01 · 研究：末步 ask 的失败形态与三契约可达面

Type: research
Status: resolved
Parent: ../map.md

## Question

把「无 Gateway 时末步必失败」的现状面核到能裁定的粒度（失败形态 / 三契约最小形状 / 检索侧是否也缺 / 两路的可达面与爆炸面 / 反方证据 / 已有桩）。

## Answer

正文（含真栈取证逐字输出）：[`research/01-ask-gateway-surface.md`](../research/01-ask-gateway-surface.md)。

**要点**：

1. **失败确定且可复现**：无 `GATEWAY_BASE_URL` 时 `pnpm smoke:half` 前 7 步全过、第 8 步 `FAIL: ask has no citations`，**exit 1**；api 侧 HTTP **200** + `status=abstained` + `reason=internal_guard` + `citations=[]`；`/ready` 的 `gateway=skipped` 但 `ready=true`（软依赖）。
2. **失败只缺 chat 三条 JSON**：`debug` 实测 `evidenceCount=2` / `retrieveCalls=1` —— 检索（embed + 真 ES sparse + rerank）在 mock 档**已全通且不发上游请求**；唯一失败点是 `generate` 那一次（mock 返回 `[mock:generate] …`，解析器抠不到 `{` → `internal_guard`）。默认档确定性调用序列 = `generate → claim_split → judge`（route 纯规则、rewrite 默认关）。
3. **零生产代码改动的接法可行**：`GATEWAY_BASE_URL` 指向一台桩即可（dev 的 rerank 节点下限为 1，不撞启动闸）；**但** chat 的 purpose **不随请求下发**，桩必须按 system prompt 分支。
4. **爆炸面**：18 个测试文件 / 104 个 `it()` 引用 `GATEWAY_MODE` / `GATEWAY_BASE_URL`；**只要不改默认值、不新增档位**，现有测例零波及。
5. **反方证据**：查遍 `prds/07-models` **没有**「mock chat 必须非 JSON」的 PRD / ADR 明文；现有依据是「实现 + 注释 + 文档叙述」。仓内**没有**可当 HTTP 网关用的现成 JSON 桩（现有 fake 全是进程内 `GatewayClient` 替身）。
6. **可诊断面的缺口**：失败原因散在 3+ 处，`smoke:half` 运行时输出**不点破**「缺 Gateway / 缺哪条契约 / 哪次调用」。

**未核实项**（研究已列）：`GATEWAY_BASE_URL` 指向非 8 维向量桩 + 入库仍 mock(8) 时 `cosine` 的实际表现；worker embed(http) 的 `{base}/v1/embeddings` 前缀不一致在真栈上的影响。

## Comments

- 顺带修正地图与工单里的路径笔误：实际目录是 `apps/api/src/services/gateway/`（不是 `apps/api/src/gateway/`）。
