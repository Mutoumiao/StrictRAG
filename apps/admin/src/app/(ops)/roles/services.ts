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
