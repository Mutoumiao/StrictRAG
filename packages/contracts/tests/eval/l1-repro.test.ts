/**
 * 目标：PRD §8 的两条 L1 哈希必须是稳定纯函数，取不到时一律 null（不得用占位串或空输入哈希冒充）。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段
 * 被测：l1QuestionIdsHash · l1CalibSetHash · emptyL1Repro
 * 简介：同输入同值（含硬编码摘要跨进程钉）；题面集换序同值、集合变则变；内容改一字节即变；空输入 → null。
 */

import { describe, expect, it } from 'vitest';

import { emptyL1Repro, l1CalibSetHash, l1QuestionIdsHash } from '../../src/eval/l1-repro.js';

/** 独立算出的 sha256(JSON.stringify(['a','b']))：换实现 / 加盐 / 带时间戳都会翻红 */
const IDS_AB_DIGEST = '0473ef2dc0d324ab659d3580c1134e9d812035905c4781fdd6d529b0c6860e13';
/** 独立算出的 sha256('{"cases":[]}') */
const CALIB_DIGEST = '6b20d0ea9be4a5fee9878ca07056218d7724bdb563a254e62ae94e8bb043cbf2';

describe('l1QuestionIdsHash · 题面 ID 哈希', () => {
  it('同输入同值，且是 64 位十六进制（跨进程由硬编码摘要钉住）', () => {
    const first = l1QuestionIdsHash(['a', 'b']);
    expect(first).toBe(l1QuestionIdsHash(['a', 'b']));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(IDS_AB_DIGEST);
  });

  it('题面集是集合：换序 / 前后空白不改值', () => {
    expect(l1QuestionIdsHash(['b', 'a'])).toBe(l1QuestionIdsHash(['a', 'b']));
    expect(l1QuestionIdsHash([' a ', 'b', ''])).toBe(l1QuestionIdsHash(['a', 'b']));
  });

  it('集合变了（增 / 删 / 改一个 id）即变值', () => {
    const base = l1QuestionIdsHash(['a', 'b']);
    expect(l1QuestionIdsHash(['a', 'b', 'c'])).not.toBe(base);
    expect(l1QuestionIdsHash(['a'])).not.toBe(base);
    expect(l1QuestionIdsHash(['a', 'b1'])).not.toBe(base);
  });

  it('空 / 全空白 → null（不得拿空串的哈希冒充）', () => {
    expect(l1QuestionIdsHash([])).toBeNull();
    expect(l1QuestionIdsHash(['', '   '])).toBeNull();
  });
});

describe('l1CalibSetHash · 校准集哈希', () => {
  it('同内容同值，且是 64 位十六进制（跨进程由硬编码摘要钉住）', () => {
    const content = '{"cases":[]}';
    expect(l1CalibSetHash(content)).toBe(l1CalibSetHash(content));
    expect(l1CalibSetHash(content)).toMatch(/^[0-9a-f]{64}$/);
    expect(l1CalibSetHash(content)).toBe(CALIB_DIGEST);
  });

  it('内容变一个字节即变值（含只差行尾）', () => {
    const base = l1CalibSetHash('{"cases":[]}');
    expect(l1CalibSetHash('{"cases":[ ]}')).not.toBe(base);
    expect(l1CalibSetHash('{"cases":[]}\n')).not.toBe(base);
    // 行尾也逐字节敏感：CRLF 与 LF 不同值（跨平台检出会显形为「校准集变了」）
    expect(l1CalibSetHash('{\r\n"cases":[]}')).not.toBe(l1CalibSetHash('{\n"cases":[]}'));
  });

  it('缺内容 / 空串 / 全空白 → null（缺测不是「空集的哈希」）', () => {
    expect(l1CalibSetHash(null)).toBeNull();
    expect(l1CalibSetHash(undefined)).toBeNull();
    expect(l1CalibSetHash('')).toBeNull();
    expect(l1CalibSetHash(' \n\t ')).toBeNull();
  });
});

describe('emptyL1Repro · §8 区块形状', () => {
  it('键 = PRD §8 条目，且没有 mode / retrieve_mode 第二源', () => {
    expect(Object.keys(emptyL1Repro()).sort()).toEqual(
      [
        'calibrationHash',
        'contextMode',
        'crag',
        'fallbackChainsVersion',
        'l2GoldSetHash',
        'lifecycleFilterVersion',
        'models',
        'promptVersions',
        'questionIdsHash',
        'rerankTopN',
        'retrieveK',
        'seed',
        'sessionStrategyVersion',
        'tauClaim',
      ].sort(),
    );
    expect('mode' in emptyL1Repro()).toBe(false);
    expect('retrieve_mode' in emptyL1Repro()).toBe(false);
  });

  it('取不到的分项一律 null（不是空串 / unknown / 连字符）', () => {
    const repro = emptyL1Repro();
    const { models, ...top } = repro;
    for (const value of Object.values(top)) {
      expect(value).toBeNull();
    }
    expect(models.kbBindings).toBeNull();
    expect(models.env).toEqual({ chat: null, embed: null, rerank: null });
    for (const value of Object.values(models.env)) {
      expect(value).toBeNull();
    }
    // 全 null 区块里不得出现任何「伪值」字面量
    const serialized = JSON.stringify(repro);
    expect(serialized).not.toContain('unknown');
    expect(serialized).not.toContain('"-"');
    expect(serialized).not.toContain('""');
  });
});
