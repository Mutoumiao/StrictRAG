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
