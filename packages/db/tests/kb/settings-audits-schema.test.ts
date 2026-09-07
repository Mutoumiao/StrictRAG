/**
 * 目标：知识库设置修改日志表必须暴露租户 / 库 / 操作者与 diff_json。
 * 需求：功能表 §4.2 修改日志
 * 被测：kbSettingsAudits
 * 简介：核对列名；禁止密钥 / τ 列。
 */

import { describe, expect, it } from 'vitest';

import { kbSettingsAudits } from '../../src/schema/index.js';

describe('kbSettingsAudits schema', () => {
  it('exposes tenant / kb / actor / diff columns', () => {
    expect(kbSettingsAudits.tenantId.name).toBe('tenant_id');
    expect(kbSettingsAudits.kbId.name).toBe('kb_id');
    expect(kbSettingsAudits.actorUserId.name).toBe('actor_user_id');
    expect(kbSettingsAudits.diffJson.name).toBe('diff_json');
    expect(kbSettingsAudits.id.name).toBe('id');
    expect(kbSettingsAudits.createdAt.name).toBe('created_at');
  });

  it('does not expose secret or quality-write columns', () => {
    const keys = Object.keys(kbSettingsAudits);
    expect(keys.some((k) => /apiKey|password|secret|tauClaim/i.test(k))).toBe(false);
  });
});
