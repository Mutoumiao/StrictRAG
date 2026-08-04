# @strict-rag/contracts

前后端共享契约（对齐 `ai-partner-agent/packages/contracts` 组织方式）。

```text
src/
  common/biz-code.ts      # 业务错误码
  common/response.ts      # ApiResponse 信封
  system/health.contract.ts
  # 后续：auth/ · ask/ · kb/ … 按 prds/05-api 增域
```

- 依赖：`zod`（`catalog:`）
- 禁止在 apps 内另起一套错误码字符串
