/**
 * 目标：GET /ask/:requestId 审计 DTO 只含当时 snapshot 元数据与 graph_trace，禁止夹带正文。
 * 需求：prds/05-api §2.9 · 功能表 §5.2 引用回溯
 * 被测：AskAuditResponseSchema · EvidenceSnapshotItemSchema
 * 简介：审计回溯形状；不是断线重拉 AskResponse。
 */

import { describe, expect, it } from 'vitest';

import {
  AskAuditResponseSchema,
  AskGraphTraceSchema,
  EVIDENCE_SNAPSHOT_PREVIEW_MAX,
  EvidenceSnapshotItemSchema,
} from '../../src/ask/ask.contract.js';

const CHUNK = '018f0000-0000-7000-8000-000000000001';
const DOC = '018f0000-0000-7000-8000-000000000002';
const KB = '018f0000-0000-7000-8000-0000000000aa';

describe('EvidenceSnapshotItemSchema', () => {
  it('接受 chunkId/docId/lifecycle/preview/title', () => {
    const r = EvidenceSnapshotItemSchema.safeParse({
      chunkId: CHUNK,
      docId: DOC,
      lifecycle: 'active',
      preview: '年假15天',
      title: '休假',
    });
    expect(r.success).toBe(true);
  });

  it('preview 超过上限必须失败', () => {
    const r = EvidenceSnapshotItemSchema.safeParse({
      chunkId: CHUNK,
      docId: DOC,
      preview: '全'.repeat(EVIDENCE_SNAPSHOT_PREVIEW_MAX + 1),
    });
    expect(r.success).toBe(false);
  });

  it('拒绝 text/body 全文键', () => {
    expect(
      EvidenceSnapshotItemSchema.safeParse({
        chunkId: CHUNK,
        docId: DOC,
        text: '员工年假为15天，须提前申请。',
      }).success,
    ).toBe(false);
    expect(
      EvidenceSnapshotItemSchema.safeParse({
        chunkId: CHUNK,
        docId: DOC,
        body: '全文',
      }).success,
    ).toBe(false);
  });
});

describe('AskAuditResponseSchema', () => {
  it('接受 evidenceSnapshot + graphTrace 审计形', () => {
    const r = AskAuditResponseSchema.safeParse({
      requestId: 'req-audit-1',
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      mode: 'balanced',
      latencyMs: 12,
      sessionId: null,
      evidenceSnapshot: [{ chunkId: CHUNK, docId: DOC, preview: '年假15天' }],
      graphTrace: { routeLabel: 'single' },
    });
    expect(r.success).toBe(true);
  });

  it('拒绝 answer / rawQuestion（非断线重拉）', () => {
    const base = {
      requestId: 'req-audit-1',
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      evidenceSnapshot: [],
      graphTrace: null,
    };
    expect(AskAuditResponseSchema.safeParse({ ...base, answer: '年假15天' }).success).toBe(false);
    expect(AskAuditResponseSchema.safeParse({ ...base, rawQuestion: '年假几天' }).success).toBe(
      false,
    );
  });

  it('graphTrace 拒绝未知键', () => {
    expect(AskGraphTraceSchema.safeParse({ routeLabel: 'single' }).success).toBe(true);
    expect(AskGraphTraceSchema.safeParse({ answer: '年假15天' }).success).toBe(false);
  });

  it('缺 evidenceSnapshot 必须失败', () => {
    const r = AskAuditResponseSchema.safeParse({
      requestId: 'req-audit-1',
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      graphTrace: null,
    });
    expect(r.success).toBe(false);
  });
});
