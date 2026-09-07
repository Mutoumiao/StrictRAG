export type AclPrincipalDoc = { aclPrincipals?: string[] | null };

/**
 * 文档级用户 uuid 名单。
 * null/缺字段 = 未设（KB 成员可读）；[] = 显式空（非超管不可读）。
 * 不跟 DEPT_ACL_ENFORCE。
 */
export function isDocVisibleForAclPrincipals(
  doc: AclPrincipalDoc,
  opts: { userId?: string; bypass?: boolean },
): boolean {
  if (opts.bypass) return true;
  const principals = doc.aclPrincipals;
  if (principals == null) return true;
  if (principals.length === 0) return false;
  const userId = opts.userId;
  if (userId == null || userId === '') return false;
  return principals.includes(userId);
}

export function filterDocsForAclPrincipals<T extends AclPrincipalDoc>(
  docs: readonly T[],
  opts: { userId?: string; bypass?: boolean },
): T[] {
  return docs.filter((d) => isDocVisibleForAclPrincipals(d, opts));
}
