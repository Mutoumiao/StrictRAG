'use client';

/**
 * 部门用例（无 path；不做权限决策）。
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

import { mapBizError } from '@/lib/map-biz-error';

import {
  createDepartment,
  createDeptCrossGrant,
  deleteDepartment,
  deleteDeptCrossGrant,
  getUserDepartments,
  listDepartmentTree,
  listDepartments,
  listDeptCrossGrants,
  patchDepartment,
  putUserDepartments,
} from './api';

export async function loadDeptWorkspace(): Promise<
  | { ok: true; tree: DepartmentTreeNode[]; flat: Department[] }
  | { ok: false; message: string }
> {
  try {
    const [tree, flat] = await Promise.all([listDepartmentTree(), listDepartments()]);
    return { ok: true, tree, flat };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function createDept(
  body: CreateDepartmentBody,
): Promise<{ ok: true; dept: Department } | { ok: false; message: string }> {
  try {
    const dept = await createDepartment(body);
    return { ok: true, dept };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function updateDept(
  id: string,
  body: PatchDepartmentBody,
): Promise<{ ok: true; dept: Department } | { ok: false; message: string }> {
  try {
    const dept = await patchDepartment(id, body);
    return { ok: true, dept };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function removeDept(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteDepartment(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function loadUserDepts(
  userId: string,
): Promise<{ ok: true; view: UserDepartmentsView } | { ok: false; message: string }> {
  try {
    const view = await getUserDepartments(userId);
    return { ok: true, view };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function saveUserDepts(
  userId: string,
  body: PutUserDepartmentsBody,
): Promise<{ ok: true; view: UserDepartmentsView } | { ok: false; message: string }> {
  try {
    const view = await putUserDepartments(userId, body);
    return { ok: true, view };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function loadGrants(): Promise<
  { ok: true; grants: DeptCrossGrant[] } | { ok: false; message: string }
> {
  try {
    const grants = await listDeptCrossGrants();
    return { ok: true, grants };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function createGrant(
  body: CreateDeptCrossGrantBody,
): Promise<{ ok: true; grant: DeptCrossGrant } | { ok: false; message: string }> {
  try {
    const grant = await createDeptCrossGrant(body);
    return { ok: true, grant };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function removeGrant(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteDeptCrossGrant(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
