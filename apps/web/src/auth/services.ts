'use client';

/**
 * 登录 / 登出用例编排：调 api、写/清 session、映射错误。
 * 禁止写后端 path；不做权限引擎。
 */

import type { DevLoginRequest } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { webDevLogin } from './api';
import { clearClientSession, saveClientSession } from './client-session';

export type LoginResult = { ok: true } | { ok: false; message: string };

/** 开发登录：成功后写 web 本地会话。 */
export async function loginWithDev(input: DevLoginRequest): Promise<LoginResult> {
  try {
    const data = await webDevLogin(input);
    saveClientSession(data);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err, '登录失败') };
  }
}

/** 仅清本地会话（无后端调用）。 */
export function logoutLocal() {
  clearClientSession();
}
