'use client';

/**
 * 平台角色：本模块私有 HTTP。
 * path 仅此处；禁止 services/UI 写 URL。
 */

import type {
  CreatePlatformRoleBody,
  PatchPlatformRoleBody,
  PermissionCatalogItem,
  PlatformRole,
  PutRolePermissionsBody,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listPlatformRoles() {
  return http.get<PlatformRole[]>('/api/v1/admin/roles');
}

export async function createPlatformRole(body: CreatePlatformRoleBody) {
  return http.post<PlatformRole, CreatePlatformRoleBody>('/api/v1/admin/roles', body);
}

export async function patchPlatformRole(id: string, body: PatchPlatformRoleBody) {
  return http.patch<PlatformRole, PatchPlatformRoleBody>(`/api/v1/admin/roles/${id}`, body);
}

export async function putRolePermissions(id: string, body: PutRolePermissionsBody) {
  return http.put<PlatformRole, PutRolePermissionsBody>(
    `/api/v1/admin/roles/${id}/permissions`,
    body,
  );
}

export async function getPermissionCatalog() {
  return http.get<PermissionCatalogItem[]>('/api/v1/admin/permission-catalog');
}
