'use client';

/**
 * 平台用户用例（无 path；不做权限决策）。
 */

import type {
  AssignUserRolesBody,
  CreatePlatformUserBody,
  PatchPlatformUserBody,
  PlatformRole,
  PlatformUser,
} from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import {
  assignPlatformUserRoles,
  createPlatformUser,
  listPlatformUsers,
  listRolesForAssign,
  patchPlatformUser,
} from './api';

/** 与 api `SUPER_ADMIN_ROLE_CODE` 同字面量；本包不 import api 源码。 */
export const SUPER_ADMIN_ROLE_CODE = 'super_admin';

/** 唯一在职超管行上的说明（禁用 / 剥角色共用）。 */
export const LAST_SUPER_ADMIN_HINT =
  '这是唯一在职的超级管理员，不能禁用或撤掉超管角色。';

export function isActiveSuperAdmin(
  user: Pick<PlatformUser, 'status' | 'roleCodes'>,
): boolean {
  return user.status === 'active' && user.roleCodes.includes(SUPER_ADMIN_ROLE_CODE);
}

/** 列表里只有这一名 active 且持有 super_admin 角色码的用户。 */
export function isLastActiveSuperAdmin(
  users: readonly Pick<PlatformUser, 'id' | 'status' | 'roleCodes'>[],
  user: Pick<PlatformUser, 'id' | 'status' | 'roleCodes'>,
): boolean {
  if (!isActiveSuperAdmin(user)) return false;
  return users.filter(isActiveSuperAdmin).length === 1;
}

function superAdminRoleId(roles: readonly PlatformRole[]): string | undefined {
  return roles.find((r) => r.code === SUPER_ADMIN_ROLE_CODE && r.enabled)?.id;
}

/** 改角色保存后，在职超管会变成 0（仅当当前就是末位时）。 */
export function wouldStripLastSuperAdmin(
  users: readonly Pick<PlatformUser, 'id' | 'status' | 'roleCodes'>[],
  targetId: string,
  nextRoleIds: readonly string[],
  roles: readonly PlatformRole[],
): boolean {
  const target = users.find((u) => u.id === targetId);
  if (!target || !isLastActiveSuperAdmin(users, target)) return false;
  const saId = superAdminRoleId(roles);
  if (!saId) return false;
  return !nextRoleIds.includes(saId);
}

export async function loadUsers(): Promise<
  { ok: true; users: PlatformUser[]; roles: PlatformRole[] } | { ok: false; message: string }
> {
  try {
    const users = await listPlatformUsers();
    let roles: PlatformRole[] = [];
    try {
      roles = await listRolesForAssign();
    } catch {
      // 仅有 user.manage 无 role 码时角色选择为空
      roles = [];
    }
    return { ok: true, users, roles };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function createUser(
  body: CreatePlatformUserBody,
): Promise<{ ok: true; user: PlatformUser } | { ok: false; message: string }> {
  try {
    const user = await createPlatformUser(body);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function updateUser(
  id: string,
  body: PatchPlatformUserBody,
): Promise<{ ok: true; user: PlatformUser } | { ok: false; message: string }> {
  try {
    const user = await patchPlatformUser(id, body);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function setUserRoles(
  id: string,
  body: AssignUserRolesBody,
): Promise<{ ok: true; user: PlatformUser } | { ok: false; message: string }> {
  try {
    const user = await assignPlatformUserRoles(id, body);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
