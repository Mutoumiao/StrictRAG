# HALF-SMOKE 清单（txt → ask 有引用）

口径：可重复跑通 **txt 上传 → complete → 审批 → scan → 双就绪 → active → ask 有引用**。  
检索闸仍 **ready ∧ active**（不自动升 active）。扫描 / 向量 / ES 可为 mock。**不是** 生产 ES、**不是** 真杀毒。

## 前置

1. `docker compose -f docker/docker-compose.yml up -d` 或 `pnpm up:apps`（见 [operable-stack.md](./operable-stack.md)）
2. `pnpm db:migrate`
3. api :4000 与 worker 已起（`pnpm up:apps`）

扫描 / 向量 / ES 可为 mock（CI 默认 mock 即可入库）。  
live ask 须 Gateway 产出合法 generate / claim_split / judge JSON；缺 `GATEWAY_BASE_URL` 时默认 mock chat **不是** JSON，ask 会拒答、本脚本因空引用失败。  
引用判定单测不连 api：`node --test scripts/smoke-ask.test.mjs`。

## 命令

```bash
pnpm smoke:half
```

期望 stdout 含 `PASS` 且 `citations=` ≥ 1。空引用 → 非零退出。

## 步骤（脚本已串）

| 步 | HTTP | 说明 |
|----|------|------|
| 1 | `GET /health` · `GET /ready` | PG+Redis 硬依赖 |
| 2 | `POST /api/v1/auth/admin/dev-login` | ask 始终验成员；超管可 ask |
| 3 | `POST /api/v1/knowledge-bases` | 建库 |
| 4 | `POST .../upload-url` → `PUT` 对象 → `POST .../complete` | 单篇 `fixtures/ingest-samples/01-doc.txt` |
| 5 | `POST .../approve` → `POST .../scan` | 审批闸后入队 |
| 6 | 轮询 `GET /api/v1/documents/:id` | `status=ready` 且双就绪 |
| 7 | `PATCH .../lifecycle` `{ lifecycle: "active" }` | **显式上架** |
| 8 | `POST .../ask` | `data.citations` 非空 |

## 明确不是

- 自动升 active  
- 生产 ES+IK / 真杀毒 / 默认 `AUTH_ENFORCE=true`
