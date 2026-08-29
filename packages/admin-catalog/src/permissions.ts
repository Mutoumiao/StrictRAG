/**
 * 权限码 SSOT（ADR-051 / ADR-056）。
 * 新增模块：先登记 code，再挂菜单与 API。
 */

export type PermissionScope = 'platform' | 'kb';
export type PermissionKind = 'page' | 'action' | 'page+action';

export type PermissionDef = {
  code: string;
  kind: PermissionKind;
  scope: PermissionScope;
  description: string;
};

export const PERMISSION_DEFINITIONS = [
  {
    code: 'admin.shell',
    kind: 'page',
    scope: 'platform',
    description: '进入 admin 壳',
  },
  {
    code: 'dashboard.view',
    kind: 'page',
    scope: 'platform',
    description: '数据面板',
  },
  {
    code: 'kb.list',
    kind: 'page',
    scope: 'platform',
    description: '知识库列表',
  },
  {
    code: 'kb.create',
    kind: 'action',
    scope: 'platform',
    description: '创建知识库',
  },
  {
    code: 'doc.view',
    kind: 'page',
    scope: 'kb',
    description: '文档列表与状态',
  },
  {
    code: 'doc.upload',
    kind: 'action',
    scope: 'kb',
    description: '上传（进审批）',
  },
  {
    code: 'doc.editor',
    kind: 'page+action',
    scope: 'kb',
    description: '编写与提交发布',
  },
  {
    code: 'doc.lifecycle',
    kind: 'action',
    scope: 'kb',
    description: 'lifecycle 操作',
  },
  {
    code: 'chunk.view',
    kind: 'page',
    scope: 'kb',
    description: '分片列表与全文',
  },
  {
    code: 'approval.view',
    kind: 'page',
    scope: 'kb',
    description: '审批中心查看',
  },
  {
    code: 'approval.decide',
    kind: 'action',
    scope: 'kb',
    description: '审批决定 / 触发 scan',
  },
  {
    code: 'member.manage',
    kind: 'action',
    scope: 'kb',
    description: 'KB 成员管理',
  },
  {
    code: 'kb.config.write',
    kind: 'action',
    scope: 'kb',
    description: '知识库可写配置',
  },
  {
    code: 'doc.reindex',
    kind: 'action',
    scope: 'kb',
    description: '单文档 reindex',
  },
  {
    code: 'feedback.queue',
    kind: 'page',
    scope: 'kb',
    description: '反馈队列',
  },
  {
    code: 'eval.run',
    kind: 'page+action',
    scope: 'kb',
    description: '黄金集维护与评测跑批',
  },
  {
    code: 'model.gateway.manage',
    kind: 'page+action',
    scope: 'platform',
    description: '模型网关生产端',
  },
  {
    code: 'user.manage',
    kind: 'page+action',
    scope: 'platform',
    description: '平台用户',
  },
  {
    code: 'role.perm.manage',
    kind: 'page+action',
    scope: 'platform',
    description: '角色树授码',
  },
  {
    code: 'system.settings',
    kind: 'page',
    scope: 'platform',
    description: '系统设置（预留）',
  },
  {
    code: 'dept.manage',
    kind: 'page+action',
    scope: 'platform',
    description: '部门树与跨部门授权',
  },
] as const satisfies readonly PermissionDef[];

export type PermissionCode = (typeof PERMISSION_DEFINITIONS)[number]['code'];

/** 兼容旧导出名 */
export const PERMISSIONS: readonly string[] = PERMISSION_DEFINITIONS.map((p) => p.code);

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = PERMISSION_DEFINITIONS.map(
  (p) => p.code,
);

export function isPermissionCode(code: string): code is PermissionCode {
  return (ALL_PERMISSION_CODES as readonly string[]).includes(code);
}

export function getPermissionDef(code: string): PermissionDef | undefined {
  return PERMISSION_DEFINITIONS.find((p) => p.code === code);
}
