'use client';

/**
 * 平台用户：本模块私有 HTTP。
 * path 仅此处；禁止 services/UI 写 URL。
 */

import type {
  AssignUserRolesBody,
  CreatePlatformUserBody,
  PatchPlatformUserBody,
  PlatformRole,
  PlatformUser,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listPlatformUsers() {
  return http.get<PlatformUser[]>('/api/v1/admin/users');
}

export async function createPlatformUser(body: CreatePlatformUserBody) {
  return http.post<PlatformUser, CreatePlatformUserBody>('/api/v1/admin/users', body);
}

export async function patchPlatformUser(id: string, body: PatchPlatformUserBody) {
  return http.patch<PlatformUser, PatchPlatformUserBody>(`/api/v1/admin/users/${id}`, body);
}

export async function assignPlatformUserRoles(id: string, body: AssignUserRolesBody) {
  return http.post<PlatformUser, AssignUserRolesBody>(`/api/v1/admin/users/${id}/roles`, body);
}

/** 绑角色用角色列表（需 role.perm.manage；无码时调用方处理失败） */
export async function listRolesForAssign() {
  return http.get<PlatformRole[]>('/api/v1/admin/roles');
}
