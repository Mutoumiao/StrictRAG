# admin · 目录结构

## 当前

```text
apps/admin/
  package.json
  tsconfig.json    # base + DOM + jsx preserve + Bundler（尚未 next 插件配置）
  eslint.config.js # @strict-rag/eslint-config/next-js
  src/app/
    placeholder.ts # APP_ADMIN_SCAFFOLD = true
```

**无** `app/page.tsx`、**无** `next.config`、**无** 真实页面。

## 目标

- Next.js App Router（栈冻结）  
- 管理 IA：知识库、文档、成员、审批、评测、模型供应商等（见前端 IA PRD）  
- ESLint 已按 next-js 配置预留  

## 接入 Next 时注意

1. tsconfig 可切到 `@strict-rag/typescript-config/nextjs.json` 或与其对齐  
2. 依赖 `next` / `react` 用 `catalog:`  
3. 源码放 `src/app`（与占位目录一致）或团队选定后更新本文件  
4. 菜单数据 **import catalog**，勿硬编码一份平行树  

## 脚本现状

`dev` / `start` → echo 占位；`build` → `tsc --noEmit`。
