# Phase 1 演示脚本（API-only）

前置：Docker PG+Redis · `pnpm db:migrate` · `pnpm dev:api` · `pnpm dev:worker`

```bash
TENANT=01900000-0000-7000-8000-000000000001

# 1) 建 KB
curl -sS -X POST http://127.0.0.1:4000/api/v1/knowledge-bases \
  -H 'content-type: application/json' \
  -d "{\"tenantId\":\"$TENANT\",\"name\":\"demo-kb\"}"

# 记下 kb id → KB_ID

# 2) 申请上传
curl -sS -X POST http://127.0.0.1:4000/api/v1/knowledge-bases/$KB_ID/documents/upload-url \
  -H 'content-type: application/json' \
  -d '{"title":"样例制度","contentType":"text/plain"}'

# 记下 docId / uploadUrl / objectKey

# 3) 上传正文（≥40 字符，多段落；fixture 见 fixtures/ingest-samples/）
curl -sS -X PUT "http://127.0.0.1:4000$UPLOAD_URL" \
  -H 'content-type: text/plain' \
  --data-binary @fixtures/ingest-samples/01-doc.txt

# 4) complete（权威 size 闸）
curl -sS -X POST http://127.0.0.1:4000/api/v1/knowledge-bases/$KB_ID/documents/$DOC_ID/complete \
  -H 'content-type: application/json' -d '{}'

# 5) 审批
curl -sS -X POST http://127.0.0.1:4000/api/v1/documents/$DOC_ID/approve

# 6) 入队 scan → worker 链式 parse→chunk→embed→es
curl -sS -X POST http://127.0.0.1:4000/api/v1/documents/$DOC_ID/scan

# 7) 轮询至 ready
curl -sS http://127.0.0.1:4000/api/v1/documents/$DOC_ID

# 8) 发布 active
curl -sS -X PATCH http://127.0.0.1:4000/api/v1/documents/$DOC_ID/lifecycle \
  -H 'content-type: application/json' \
  -d '{"lifecycle":"active"}'
```

超限 / 未批 scan / mock ES 失败：

```bash
# 未批 scan → FORBIDDEN
# INGEST_ES_MODE=fail 重启 worker → 文档不得 ready
# 超大 complete → PAYLOAD_TOO_LARGE
```
