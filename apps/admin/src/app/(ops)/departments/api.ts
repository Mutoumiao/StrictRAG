'use client';

/**
 * 部门组织：本模块私有 HTTP。
 * path 仅此处；禁止 services/UI 写 URL。
 */

import type {
  CreateDepartmentBody,
  CreateDeptCrossGrantBody,
  Department,
  DepartmentTreeNode,
  DeptCrossGrant,
  PatchDepartmentBody,
  PutUserDepartmentsBody,
  UserDepartmentsView,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listDepartments() {
  return http.get<Department[]>('/api/v1/admin/departments');
}

export async function listDepartmentTree() {
  return http.get<DepartmentTreeNode[]>('/api/v1/admin/departments/tree');
}

export async function createDepartment(body: CreateDepartmentBody) {
  return http.post<Department, CreateDepartmentBody>('/api/v1/admin/departments', body);
}

export async function patchDepartment(id: string, body: PatchDepartmentBody) {
  return http.patch<Department, PatchDepartmentBody>(`/api/v1/admin/departments/${id}`, body);
}

export async function deleteDepartment(id: string) {
  return http.delete<{ id: string; deleted: boolean }>(`/api/v1/admin/departments/${id}`);
}

export async function getUserDepartments(userId: string) {
  return http.get<UserDepartmentsView>(`/api/v1/admin/users/${userId}/departments`);
}

export async function putUserDepartments(userId: string, body: PutUserDepartmentsBody) {
  return http.put<UserDepartmentsView, PutUserDepartmentsBody>(
    `/api/v1/admin/users/${userId}/departments`,
    body,
  );
}

export async function listDeptCrossGrants() {
  return http.get<DeptCrossGrant[]>('/api/v1/admin/dept-cross-grants');
}

export async function createDeptCrossGrant(body: CreateDeptCrossGrantBody) {
  return http.post<DeptCrossGrant, CreateDeptCrossGrantBody>(
    '/api/v1/admin/dept-cross-grants',
    body,
  );
}

export async function deleteDeptCrossGrant(id: string) {
  return http.delete<{ id: string; deleted: boolean }>(`/api/v1/admin/dept-cross-grants/${id}`);
}
