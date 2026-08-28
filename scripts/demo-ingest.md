# Phase 1 演示脚本

## 推荐：自动化

前置：Docker PG+Redis · `pnpm db:migrate` · `pnpm dev:api` · `pnpm dev:worker`

```bash
pnpm demo:ingest
# 或
node scripts/demo-ingest.mjs
```

脚本会：

1. 探测 `/health` + `/ready`
2. 用 `fixtures/ingest-samples/`（≥10 篇）走完：upload → complete → approve → scan → ready → active
3. 负例：未批 scan → `FORBIDDEN`
4. 失败非 0 退出

环境变量：`API_BASE` · `DEMO_TENANT_ID` · `DEMO_TIMEOUT_MS` · `DEMO_POLL_MS`

> **ES 边界**：worker 使用进程内 **mock ES** 做双就绪/对账；**不**等于生产 Elasticsearch+IK 已就绪。

## 手动 curl（排障用）

```bash
TENANT=01900000-0000-7000-8000-000000000001

# 先 admin/dev-login，记下 userId 与 token；tenantId 以令牌为准
curl -sS -X POST http://127.0.0.1:4000/api/v1/knowledge-bases \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d "{\"name\":\"demo-kb\",\"initialAdminUserId\":\"$USER_ID\"}"

# 记下 kb id → KB_ID
# 申请上传 / PUT 对象 / complete / approve / scan / PATCH active
# 详见仓库历史手搓步骤；优先用 pnpm demo:ingest
```

超限 / 未批 scan / mock ES 失败：

```bash
# 未批 scan → FORBIDDEN（demo-ingest 已覆盖）
# INGEST_ES_MODE=fail 重启 worker → 文档不得 ready
# 超大 complete → PAYLOAD_TOO_LARGE（api live 单测可覆盖）
```

## Live 门禁单测（可选）

```bash
# 需 PG+Redis ready；否则 skip（不失败）
pnpm --filter @strict-rag/api test

# 全链路 ≥10 ready 用 demo:ingest（需 api+worker 进程）
pnpm demo:ingest
```
