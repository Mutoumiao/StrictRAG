# admin-catalog · SSOT 规则

## 为什么单独成包

避免 api 与 admin **各维护一份** 权限字符串和菜单，导致「按钮在但 403」或「能调 API 但菜单没有」。

## 规则

| 规则 | 说明 |
|------|------|
| 单一注册 | 新码只加本包 |
| 菜单挂码 | 每个需鉴权入口节点绑定 code |
| 模板 | super_admin / kb_admin / doc_operator 等默认集见安全 PRD |
| UI ≠ API | 即使菜单隐藏，api 仍须验码 |
| 壳码 | **`admin.shell`** 为进 admin 的平台页码（ADR-045 经 051）；模板种子须含此码才进壳 |
| pure read | 无 `admin.shell` → 仅 web；不得靠篡改前端进管理壳 |

## 实现阶段注意

- 保持包 **无** Next/Hono 依赖，便于 api 与 admin 共用  
- 码名稳定后写入 PRD/验收剧本；改名要全仓 `rg`  
- 超管全权与 deny/grant 模型以 `prds/09-security` 为准  

## 反模式

- **Bad**：admin 本地 `const canApprove = true` 写死  
- **Bad**：api 中间件字符串字面量与 catalog 不一致  
- **Good**：`PERMISSIONS` 导出 const 数组/对象，两端引用同一符号
