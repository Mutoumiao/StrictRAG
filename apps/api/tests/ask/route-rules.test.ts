/**
 * 目标：闲聊走 chitchat，知识/政策问句走 single，禁止政策句被当成闲聊。
 * 需求：prds/04-pipelines/02-online-ask-langgraph.md
 * 被测：ruleRoute
 * 简介：问候为 chitchat；带知识/政策词的问句必须 single。
 */
import { describe, expect, it } from 'vitest';

import { ruleRoute } from './_support/graph-harness.js';

describe('ruleRoute (M1)', () => {
  it('chitchat hello', () => {
    expect(ruleRoute('你好').routeLabel).toBe('chitchat');
  });

  it('knowledge question → single', () => {
    expect(ruleRoute('年假有多少天？').routeLabel).toBe('single');
  });

  it('policy word → single not chitchat', () => {
    expect(ruleRoute('你好，年假政策').routeLabel).toBe('single');
  });
});
