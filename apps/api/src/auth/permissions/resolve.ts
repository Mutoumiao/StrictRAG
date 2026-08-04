import {
  defaultCodesForRoles,
  getPermissionDef,
  roleBypassesKbMembership,
  type PermissionCode,
} from '@strict-rag/admin-catalog';

/**
 * 权限求值（ADR-051）。
 * 放行唯一条件：有效码包含 requiredCode（+ kb 成员上下文，超管旁路）。
 * 禁止只判断 role 字符串。
 */

export type ResolveInput = {
  roleCodes: readonly string[];
  /** 可选：用户额外 grant / deny（P2 表就绪后接入） */
  extraGrants?: readonly string[];
  extraDenies?: readonly string[];
};

export function resolveEffectiveCodes(input: ResolveInput): Set<PermissionCode> {
  const codes = defaultCodesForRoles(input.roleCodes);
  for (const g of input.extraGrants ?? []) {
    if (getPermissionDef(g)) codes.add(g as PermissionCode);
  }
  for (const d of input.extraDenies ?? []) {
    codes.delete(d as PermissionCode);
  }
  return codes;
}

export function hasPermission(
  effective: ReadonlySet<string>,
  required: string,
): boolean {
  return effective.has(required);
}

/**
 * KB 作用域：非超管必须是成员；码本身仍须满足。
 * isKbMember 由调用方查 kb_members。
 */
export function canAccessKbScoped(params: {
  roleCodes: readonly string[];
  effective: ReadonlySet<string>;
  requiredCode: string;
  isKbMember: boolean;
}): boolean {
  if (!hasPermission(params.effective, params.requiredCode)) return false;
  const def = getPermissionDef(params.requiredCode);
  if (!def || def.scope !== 'kb') return true;
  if (roleBypassesKbMembership(params.roleCodes)) return true;
  return params.isKbMember;
}

export function canEnterAdminShell(effective: ReadonlySet<string>): boolean {
  return hasPermission(effective, 'admin.shell');
}

export { roleBypassesKbMembership };
