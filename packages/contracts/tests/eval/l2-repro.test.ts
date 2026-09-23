/**
 * 目标：L2 报告的可复现区块必须给剧本集哈希真值（口径 = L1 题面哈希），两个版本键如实 null —— 无载体就记债，禁止拿源码文本哈希顶替。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段 · 裁定 02（三、§8 的 L2 侧字段）与工单 05
 * 被测：l2GoldSetHash · emptyL2Repro · L2Repro（与 L1 同名保留键的语义关系）
 * 简介：哈希与 L1 同口径（换序同值、改一个 id 即变、空集 → null）；版本键类型只可能是 null；区块键集 = 三键且无占位串。
 */

import { describe, expect, it } from 'vitest';

import { emptyL1Repro, l1QuestionIdsHash } from '../../src/eval/l1-repro.js';
import { emptyL2Repro, l2GoldSetHash } from '../../src/eval/l2-repro.js';
import { L2_EVIDENCE_REPORT_KEYS } from '../../src/eval/l2-matrix.js';

/** 独立算出的 sha256(JSON.stringify(['a','b']))：换实现 / 加盐 / 带时间戳都会翻红 */
const IDS_AB_DIGEST = '0473ef2dc0d324ab659d3580c1134e9d812035905c4781fdd6d529b0c6860e13';

describe('l2GoldSetHash · 剧本集哈希', () => {
  it('同输入同值，且是 64 位十六进制（跨进程由硬编码摘要钉住）', () => {
    const first = l2GoldSetHash(['a', 'b']);
    expect(first).toBe(l2GoldSetHash(['a', 'b']));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(IDS_AB_DIGEST);
  });

  it('口径不另发明：逐字等于 L1 的 l1QuestionIdsHash（同一函数实现）', () => {
    for (const ids of [
      ['a', 'b'],
      ['l2-near-coref-001', 'l2-budget-001'],
      [' l2-x ', '', 'l2-y'],
      [],
    ]) {
      expect(l2GoldSetHash(ids)).toBe(l1QuestionIdsHash(ids));
    }
  });

  it('剧本集是集合：换序 / 前后空白 / 空项不改值（对 gold 文件重排免疫）', () => {
    expect(l2GoldSetHash(['b', 'a'])).toBe(l2GoldSetHash(['a', 'b']));
    expect(l2GoldSetHash([' a ', 'b', ''])).toBe(l2GoldSetHash(['a', 'b']));
    expect(l2GoldSetHash(['l2-b-001', 'l2-a-001'])).toBe(
      l2GoldSetHash(['l2-a-001', 'l2-b-001']),
    );
  });

  it('集合变了（增 / 删 / 改一个 case id）即变值', () => {
    const base = l2GoldSetHash(['l2-a-001', 'l2-b-001']);
    expect(l2GoldSetHash(['l2-a-001', 'l2-b-001', 'l2-c-001'])).not.toBe(base);
    expect(l2GoldSetHash(['l2-a-001'])).not.toBe(base);
    expect(l2GoldSetHash(['l2-a-001', 'l2-b-002'])).not.toBe(base);
  });

  it('空 / 全空白 → null（不得拿空串的哈希冒充）', () => {
    expect(l2GoldSetHash([])).toBeNull();
    expect(l2GoldSetHash(['', '   '])).toBeNull();
  });

  /**
   * 反证：把 id 直接拼一串再哈希（「'ab' 与 ['a','b'] 同值」）是最容易写错的偷懒实现，
   * JSON 序列化才拦得住它 —— 本条即该实现的翻红点。
   */
  it('反证：拼接式哈希会碰撞，本实现不得碰撞（JSON 序列化是必需项）', () => {
    expect(l2GoldSetHash(['ab'])).not.toBe(l2GoldSetHash(['a', 'b']));
    expect(l2GoldSetHash(['a b'])).not.toBe(l2GoldSetHash(['a', 'b']));
    expect(l2GoldSetHash(['ab', 'c'])).not.toBe(l2GoldSetHash(['a', 'bc']));
    // 反向护栏：空项被规范化掉不算换集（去空项是有意的，不是碰撞）
    expect(l2GoldSetHash(['a', 'b', ''])).toBe(l2GoldSetHash(['a', 'b']));
  });
});

describe('emptyL2Repro · §8 区块形状', () => {
  it('键 = 三个 L2 侧条目（剧本集哈希 + 两个版本键），无多余键', () => {
    expect(Object.keys(emptyL2Repro()).sort()).toEqual([
      'l2GoldSetHash',
      'rewritePromptVersion',
      'sessionStrategyVersion',
    ]);
    for (const key of ['models', 'mode', 'retrieve_mode', 'questionIdsHash', 'calibrationHash']) {
      expect(key in emptyL2Repro()).toBe(false);
    }
  });

  it('两个版本键只可能是 null（类型钉死）：无载体即记债，不给伪版本', () => {
    const repro = emptyL2Repro();
    expect(repro.sessionStrategyVersion).toBeNull();
    expect(repro.rewritePromptVersion).toBeNull();
    expect(repro.l2GoldSetHash).toBeNull();

    // 全 null 区块里不得出现任何「伪值」字面量
    const serialized = JSON.stringify(repro);
    for (const fake of ['"unknown"', '"-"', '""', '"n/a"', '"none"', '"v0"']) {
      expect(serialized).not.toContain(fake);
    }
  });

  it('L1 的 l2GoldSetHash 保留键仍为 null（L1 不加载 L2 夹具，本图不顺手填它）', () => {
    expect(emptyL1Repro().l2GoldSetHash).toBeNull();
    expect(l1QuestionIdsHash(['l2-a-001'])).not.toBeNull();
    // 同名不同义：L1 区块的保留键 ≠ L2 区块的真值
    expect(l2GoldSetHash(['l2-a-001'])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('区块进两侧同构名单', () => {
  it('repro 在 L2_EVIDENCE_REPORT_KEYS 里（worker 白名单锚点同源）', () => {
    expect([...L2_EVIDENCE_REPORT_KEYS]).toContain('repro');
  });
});
