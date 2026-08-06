'use client';

/**
 * 成员管理用例：列表 / 邀请 / 移除（含成功后刷新列表）。
 * 无 path；不做权限决策。
 */

import type { InviteMemberBody, KbMember } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { inviteMember, listMembers, removeMember } from './api';

export type LoadMembersResult =
  | { ok: true; rows: KbMember[] }
  | { ok: false; message: string };

export type MembersActionResult = { ok: true; text: string } | { ok: false; message: string };

export type MembersMutationResult =
  | { ok: true; text: string; rows: KbMember[] }
  | { ok: false; message: string };

export async function loadMemberList(kbId: string): Promise<LoadMembersResult> {
  try {
    const rows = await listMembers(kbId);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function inviteKbMember(
  kbId: string,
  body: InviteMemberBody,
): Promise<MembersActionResult> {
  try {
    await inviteMember(kbId, body);
    return { ok: true, text: '已邀请' };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function removeKbMember(
  kbId: string,
  userId: string,
): Promise<MembersActionResult> {
  try {
    await removeMember(kbId, userId);
    return { ok: true, text: '已移除' };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

/** 邀请后刷新列表。 */
export async function inviteKbMemberAndReload(
  kbId: string,
  body: InviteMemberBody,
): Promise<MembersMutationResult> {
  const ran = await inviteKbMember(kbId, body);
  if (!ran.ok) return ran;
  const list = await loadMemberList(kbId);
  if (!list.ok) {
    return {
      ok: true,
      text: `${ran.text}（列表刷新失败：${list.message}）`,
      rows: [],
    };
  }
  return { ok: true, text: ran.text, rows: list.rows };
}

/** 移除后刷新列表。 */
export async function removeKbMemberAndReload(
  kbId: string,
  userId: string,
): Promise<MembersMutationResult> {
  const ran = await removeKbMember(kbId, userId);
  if (!ran.ok) return ran;
  const list = await loadMemberList(kbId);
  if (!list.ok) {
    return {
      ok: true,
      text: `${ran.text}（列表刷新失败：${list.message}）`,
      rows: [],
    };
  }
  return { ok: true, text: ran.text, rows: list.rows };
}
