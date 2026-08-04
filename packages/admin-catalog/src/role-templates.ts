import { ALL_PERMISSION_CODES, type PermissionCode } from './permissions.js';

/**
 * 角色模板默认绑码（ADR-051 三模板 + 消费者）。
 * 运行时以「用户角色绑码并集」为准；模板只做种子/锚点。
 */

export type RoleTemplateCode = 'super_admin' | 'kb_admin' | 'doc_operator' | 'web_consumer';

export type RoleTemplate = {
  code: RoleTemplateCode;
  name: string;
  /** 是否跳过 kb_members（仅 super_admin） */
  bypassKbMembership: boolean;
  defaultCodes: readonly PermissionCode[];
};

const DOC_OPERATOR_CODES = [
  'admin.shell',
  'kb.list',
  'doc.view',
  'doc.upload',
  'doc.editor',
] as const satisfies readonly PermissionCode[];

const KB_ADMIN_CODES = [
  ...DOC_OPERATOR_CODES,
  'doc.lifecycle',
  'chunk.view',
  'approval.view',
  'approval.decide',
  'member.manage',
  'kb.config.write',
  'doc.reindex',
  'feedback.queue',
  'eval.run',
] as const satisfies readonly PermissionCode[];

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    code: 'super_admin',
    name: '超级管理员',
    bypassKbMembership: true,
    defaultCodes: ALL_PERMISSION_CODES,
  },
  {
    code: 'kb_admin',
    name: '知识库管理员',
    bypassKbMembership: false,
    defaultCodes: KB_ADMIN_CODES,
  },
  {
    code: 'doc_operator',
    name: '文档运营',
    bypassKbMembership: false,
    defaultCodes: DOC_OPERATOR_CODES,
  },
  {
    code: 'web_consumer',
    name: '问答消费者',
    bypassKbMembership: false,
    /** 无 admin.shell；ask 靠成员资格，不靠运营码 */
    defaultCodes: [],
  },
] as const;

export function getRoleTemplate(code: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((r) => r.code === code);
}

export function defaultCodesForRoles(roleCodes: readonly string[]): Set<PermissionCode> {
  const out = new Set<PermissionCode>();
  for (const role of roleCodes) {
    const tpl = getRoleTemplate(role);
    if (!tpl) continue;
    for (const c of tpl.defaultCodes) out.add(c);
  }
  return out;
}

export function roleBypassesKbMembership(roleCodes: readonly string[]): boolean {
  return roleCodes.some((r) => getRoleTemplate(r)?.bypassKbMembership === true);
}
