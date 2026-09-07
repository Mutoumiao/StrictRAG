/**
 * 目标：知识库设置修改日志 DTO 只含 id / kbId / actorUserId / createdAt / diff，拒绝密钥字段。
 * 需求：功能表 §4.2 修改日志
 * 被测：KbSettingsAuditItemSchema
 * 简介：最小闭环形状；不是 admin_write 全路径落表。
 */

import { describe, expect, it } from 'vitest';

import { KbSettingsAuditItemSchema } from '../../src/kb/settings-audit.contract.js';

const ROW = {
  id: '01900000-0000-7000-8000-0000000000a1',
  kbId: '01900000-0000-7000-8000-0000000000aa',
  actorUserId: '01900000-0000-7000-8000-0000000000u1',
  createdAt: '2026-09-07 12:00:00',
  diff: {
    name: { from: 'Demo KB', to: 'Renamed' },
  },
};

describe('KbSettingsAuditItemSchema', () => {
  it('接受最小可查询行', () => {
    expect(KbSettingsAuditItemSchema.parse(ROW)).toEqual(ROW);
  });

  it('拒绝密钥与质量写字段', () => {
    expect(KbSettingsAuditItemSchema.safeParse({ ...ROW, apiKey: 'sk-secret' }).success).toBe(
      false,
    );
    expect(KbSettingsAuditItemSchema.safeParse({ ...ROW, password: 'x' }).success).toBe(false);
    expect(KbSettingsAuditItemSchema.safeParse({ ...ROW, tauClaim: 0.1 }).success).toBe(false);
  });

  it('缺必填字段失败', () => {
    expect(
      KbSettingsAuditItemSchema.safeParse({
        id: ROW.id,
        kbId: ROW.kbId,
        createdAt: ROW.createdAt,
        diff: ROW.diff,
      }).success,
    ).toBe(false);
  });
});
