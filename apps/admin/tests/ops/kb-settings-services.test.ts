/**
 * 目标：设置服务必须正确解析文档类型输入，失败则 PATCH 写出错误 docTypes。
 * 需求：KB settings
 * 被测：parseDocTypesInput
 * 简介：不写 URL。
 */

import { describe, expect, it } from 'vitest';

import { parseDocTypesInput } from '@/app/(ops)/kb/settings/services';

describe('parseDocTypesInput', () => {
  it('splits comma and whitespace', () => {
    expect(parseDocTypesInput('hr, legal  finance')).toEqual(['hr', 'legal', 'finance']);
  });

  it('empty is clear restriction', () => {
    expect(parseDocTypesInput('  ')).toEqual([]);
  });
});
