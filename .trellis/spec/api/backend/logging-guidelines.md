# api · 日志指南

## 选型

- 库：**Pino**（栈冻结）  
- 现状：未接入；Phase 0 与 health 一并引入  

## 上下文字段（工程 PRD）

请求日志尽量带：

```text
requestId, tenantId, userId, kbId?, sessionId?
```

| 字段 | 说明 |
|------|------|
| requestId | 与 `ApiMeta.requestId` 一致，便于前后关联 |
| tenantId / userId | 鉴权后注入；未登录路径可省略 user |
| kbId / sessionId | 进入对应资源时附加 |

## 级别建议

| Level | 用途 |
|-------|------|
| error | 未处理异常、依赖 down、鉴权基础设施失败 |
| warn | 可恢复降级、限流触发、配置接近阈值 |
| info | 请求完成、入队成功、启动/ready 状态 |
| debug | 仅开发；生产默认关 |

## 禁止

- 日志打印 JWT、密码、Provider API Key、文档全文敏感体  
- 用 `console.log` 作为生产日志（实现后统一 Pino）  

## 与观测

- 基建日志：Pino  
- LLM/质量链路：Langfuse（`prds/08-quality/03-langfuse-observability.md`）  
- 二者职责勿混：Pino 不等替 trace 里的 generation 细节
