'use client';

/**
 * 建库用例：名称 + 首位库管；成功后写入当前 KB。
 * 无 path；不做权限决策（按钮显隐在壳上按码裁）。
 */

import type { CreateKbBody, CreateKbResponse } from '@strict-rag/contracts';

import { createKnowledgeBase } from '@/lib/kb-api';
import { writeStoredKbId } from '@/lib/kb-context';
import { mapBizError } from '@/lib/map-biz-error';

export type CreateKbResult =
  | { ok: true; kb: CreateKbResponse }
  | { ok: false; message: string };

export async function createKbAndSelect(body: CreateKbBody): Promise<CreateKbResult> {
  try {
    const kb = await createKnowledgeBase(body);
    writeStoredKbId(kb.id);
    return { ok: true, kb };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
