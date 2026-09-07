'use client';

/**
 * 平台角色用例（无 path；不做权限决策）。
 */

import type {
  CreatePlatformRoleBody,
  PermissionCatalogItem,
  PlatformRole,
  PutRolePermissionsBody,
} from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import {
  createPlatformRole,
  getPermissionCatalog,
  listPlatformRoles,
  putRolePermissions,
} from './api';

export const SUPER_ADMIN_ROLE_CODE = 'super_admin';

/** 角色页编辑超管时勾选/保存共用说明。 */
export const SUPER_ADMIN_CODES_LOCKED_HINT = '超管角色锁定 catalog 全码，不可改少。';

export function isLockedSuperAdminRole(role: { code: string } | null | undefined): boolean {
  return role?.code === SUPER_ADMIN_ROLE_CODE;
}

export async function loadRolesPage(): Promise<
  | { ok: true; roles: PlatformRole[]; catalog: PermissionCatalogItem[] }
  | { ok: false; message: string }
> {
  try {
    const [roles, catalog] = await Promise.all([listPlatformRoles(), getPermissionCatalog()]);
    return { ok: true, roles, catalog };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function createRole(
  body: CreatePlatformRoleBody,
): Promise<{ ok: true; role: PlatformRole } | { ok: false; message: string }> {
  try {
    const role = await createPlatformRole(body);
    return { ok: true, role };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function saveRolePermissions(
  id: string,
  body: PutRolePermissionsBody,
): Promise<{ ok: true; role: PlatformRole } | { ok: false; message: string }> {
  try {
    const role = await putRolePermissions(id, body);
    return { ok: true, role };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
