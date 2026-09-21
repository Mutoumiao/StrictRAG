/**
 * 目标：ask 端到端必须按部门可见性收窄语料——跨部门 / 级别不足 / 无归属 / 继承关闭下的文档不得进 evidence 与 citations。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 B2-1 · AE4 · AE5 · AE6 · AE7 · AE10 · AE11 · AE12
 * 被测：loadCorpusFromDb（经 visibility.ts 与真实 dept-acl 谓词）→ runRetrieve → runAskGraph
 * 简介：用 KB 覆盖 deptAclEnforce=true 显式开强制（不改仓库默认开关）；语料集合与 ask 终态两面都按同一条可见性裁决。
 */

import { describe, expect, it, vi } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { RetrieveDeps } from '../../src/services/retrieve/types.js';
import { baseInput, runAskGraph, scriptedChat } from '../ask/_support/graph-harness.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = 'kb-dept-e2e';
const USER = '01900000-0000-7000-8000-0000000000ee';
const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';
const DEPT_C = '01900000-0000-7000-8000-0000000000c1';
const QUESTION = '年假有多少天';

/** A 为根；B / C 是 A 的两个子部门（互为兄弟） */
const TREE = [
  { id: DEPT_A, path: `/${DEPT_A}/` },
  { id: DEPT_B, path: `/${DEPT_A}/${DEPT_B}/` },
  { id: DEPT_C, path: `/${DEPT_A}/${DEPT_C}/` },
];

const DOC_LIB = '01900000-0000-7000-8000-0000000000d1';
const DOC_A20 = '01900000-0000-7000-8000-0000000000d2';
const DOC_A30 = '01900000-0000-7000-8000-0000000000d3';
const DOC_B20 = '01900000-0000-7000-8000-0000000000d4';
const DOC_C20 = '01900000-0000-7000-8000-0000000000d5';

/** 每篇文档一个分片；chunkId 由文档序位派生，便于断言「谁的块进了 evidence」 */
const DOC_FIXTURES: Array<{
  id: string;
  ownerDeptId: string | null;
  visibilityLevel: number;
  text: string;
}> = [
  { id: DOC_LIB, ownerDeptId: null, visibilityLevel: 20, text: '员工手册总则 制度以本手册为准' },
  { id: DOC_A20, ownerDeptId: DEPT_A, visibilityLevel: 20, text: '年假有多少天 部门通用说明' },
  { id: DOC_A30, ownerDeptId: DEPT_A, visibilityLevel: 30, text: '年假有多少天 机密补充说明' },
  { id: DOC_B20, ownerDeptId: DEPT_B, visibilityLevel: 20, text: '年假有多少天 子部门说明' },
  { id: DOC_C20, ownerDeptId: DEPT_C, visibilityLevel: 20, text: '年假有多少天 另一子部门说明' },
];

function chunkIdOf(docId: string): string {
  return `01900000-0000-7000-8000-0000000001${String(
    DOC_FIXTURES.findIndex((d) => d.id === docId),
  ).padStart(2, '0')}`;
}

const dims = 8;

const state = {
  configJson: {} as Record<string, unknown>,
  assignments: [] as Array<{ deptId: string; isLeader: number | boolean }>,
  grants: [] as Array<{ deptId: string; maxVisibilityLevel: number; expiresAt: string | null }>,
};

const store = {
  documents: DOC_FIXTURES.map((f) => ({
    id: f.id,
    title: f.id,
    status: 'ready',
    lifecycle: 'active',
    docType: 'policy',
    effectiveFrom: null,
    effectiveTo: null,
    tenantId: TENANT,
    kbId: KB,
    indexVersion: 1,
    ownerDeptId: f.ownerDeptId,
    visibilityLevel: f.visibilityLevel,
    aclPrincipals: null,
  })),
  chunks: DOC_FIXTURES.map((f) => ({
    id: chunkIdOf(f.id),
    docId: f.id,
    kbId: KB,
    indexVersion: 1,
    ordinal: 0,
    preview: f.text.slice(0, 20),
    bodyText: f.text,
    tokenCount: 1,
  })),
  embeddings: DOC_FIXTURES.map((f) => ({
    chunkId: chunkIdOf(f.id),
    docId: f.id,
    kbId: KB,
    indexVersion: 1,
    embedding: mockEmbedVector(f.text, dims),
  })),
};

vi.mock('../../src/services/db.js', async () => {
  const tables = await import('@strict-rag/db');
  return {
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: async () => {
            if (table === tables.documents) return store.documents;
            if (table === tables.chunks) return store.chunks;
            if (table === tables.chunkEmbeddings) return store.embeddings;
            return [];
          },
        }),
      }),
    }),
  };
});

vi.mock('../../src/services/kb-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/kb-settings.js')>();
  return {
    ...actual,
    kbSettingsRepo: {
      get: async (kbId: string) =>
        kbId === KB ? { id: KB, tenantId: TENANT, configJson: state.configJson } : null,
    },
  };
});

// 真实 loadDeptAssignments / loadDeptNodes / loadDeptGrants（含 tenant 过滤与过期剔除），只换 IO 端口
vi.mock('../../src/services/departments.js', () => ({
  departmentsRepo: {
    listUserDepartments: async () => state.assignments,
    listDepartments: async () => TREE,
    getDepartment: async (_tenantId: string, id: string) =>
      TREE.find((d) => d.id === id) ?? null,
  },
}));

vi.mock('../../src/services/dept-grants.js', () => ({
  deptGrantsRepo: {
    listGrants: async () => state.grants,
  },
}));

const { loadCorpusFromDb } = await import('../../src/services/retrieve/corpus.js');

function enableDeptAcl(extra: Record<string, unknown> = {}) {
  state.configJson = { deptAclEnforce: true, ...extra };
}

function corpusDeps(): RetrieveDeps {
  return {
    loadCorpus: loadCorpusFromDb,
    embed: async (texts) => texts.map((t) => mockEmbedVector(t, dims)),
    rerank: async (query, passages, topN) => {
      const scored = passages
        .map((p, index) => ({ index, score: sparseOverlapScore(query, p) }))
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.min(topN, scored.length));
    },
    esMode: 'mock',
  };
}

async function visibleDocs(): Promise<string[]> {
  const chunks = await loadCorpusFromDb({ kbId: KB, userId: USER });
  return [...new Set(chunks.map((c) => c.docId))].sort();
}

async function visibleViaRetrieve(): Promise<string[]> {
  const r = await runRetrieve(
    {
      tenantId: TENANT,
      kbId: KB,
      question: QUESTION,
      membership: 'member',
      userId: USER,
    },
    corpusDeps(),
  );
  if (!r.ok) return [];
  return [...new Set(r.evidence.map((e) => e.docId))].sort();
}

/** 让 generate 只引用给定 chunk 的 ask 桩（claim_split 与 citations 同源） */
function citeOnly(chunkId: string, answer: string) {
  return scriptedChat({
    generate: JSON.stringify({ answer, citations: [chunkId], insufficient: false }),
    claim_split: JSON.stringify({ claims: [{ text: answer, chunkIds: [chunkId] }] }),
    judge: JSON.stringify({ scores: [0.9] }),
  });
}

describe('ask 侧部门强制端到端（B2-1 / AE4–AE7 / AE10–AE12）', () => {
  it('AE4 同部门普通成员：祖先继承下可见空部门 + 本部门 20 + 子部门 20，不见本部门 30', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];

    expect(await visibleDocs()).toEqual([DOC_A20, DOC_B20, DOC_C20, DOC_LIB].sort());
    expect(await visibleViaRetrieve()).toEqual([DOC_A20, DOC_B20, DOC_C20, DOC_LIB].sort());
  });

  it('AE5/AE11 部门负责人：可见级到 30，本部门 30 文档进语料', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: true }];

    expect(await visibleDocs()).toEqual(
      [DOC_A20, DOC_A30, DOC_B20, DOC_C20, DOC_LIB].sort(),
    );
  });

  it('AE6 无归属：只见空部门且在级别内，部门文档一律不进语料', async () => {
    enableDeptAcl();
    state.assignments = [];

    expect(await visibleDocs()).toEqual([DOC_LIB]);
  });

  it('AE10 关继承（KB 覆盖 deptInheritDown=false）：祖先不再下探子孙', async () => {
    enableDeptAcl({ deptInheritDown: false });
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];

    expect(await visibleDocs()).toEqual([DOC_A20, DOC_LIB].sort());
  });

  it('AE12 下级负责人：只见本子树与空部门，不见上级与兄弟', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_B, isLeader: true }];

    expect(await visibleDocs()).toEqual([DOC_B20, DOC_LIB].sort());
  });

  it('AE7 grant 串联：无归属但有未过期 grant → 被授部门及其子孙进语料', async () => {
    enableDeptAcl();
    state.assignments = [];
    state.grants = [{ deptId: DEPT_A, maxVisibilityLevel: 20, expiresAt: null }];

    expect(await visibleDocs()).toEqual([DOC_A20, DOC_B20, DOC_C20, DOC_LIB].sort());

    // 过期 grant 不再授权
    state.grants = [
      { deptId: DEPT_A, maxVisibilityLevel: 20, expiresAt: '2000-01-01 00:00:00' },
    ];
    expect(await visibleDocs()).toEqual([DOC_LIB]);
  });

  it('关强制：部门闸整体不生效，全部文档进语料（证明强制的开关可回退）', async () => {
    state.configJson = {};
    state.assignments = [];
    state.grants = [];

    expect(await visibleDocs()).toEqual(
      [DOC_A20, DOC_A30, DOC_B20, DOC_C20, DOC_LIB].sort(),
    );
  });

  it('B2-1 ask 端到端：模型硬引用被部门挡住的文档 → 不得 answered，答文与引用都不含它', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];
    state.grants = [];
    const secretChunk = chunkIdOf(DOC_A30);

    const r = await runAskGraph(
      baseInput({ question: `${QUESTION}？`, tenantId: TENANT, kbId: KB, userId: USER }),
      { chat: citeOnly(secretChunk, '年假为 90 天。'), retrieveDeps: corpusDeps() },
    );

    // 被挡文档的块根本不在语料里，故它不可能成为 evidence / citation
    expect(r.evidence_snapshot.some((e) => e.docId === DOC_A30)).toBe(false);
    expect(r.citations.some((c) => c.chunkId === secretChunk)).toBe(false);
    expect(r.answer).not.toContain('90 天');
    expect(r.status).toBe('abstained');
  });

  it('B2-1 ask 端到端：可见文档正常作答（同一夹具下不是全拦）', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];
    state.grants = [];
    const okChunk = chunkIdOf(DOC_A20);

    const r = await runAskGraph(
      baseInput({ question: `${QUESTION}？`, tenantId: TENANT, kbId: KB, userId: USER }),
      { chat: citeOnly(okChunk, '年假为 15 天。'), retrieveDeps: corpusDeps() },
    );

    expect(r.status).toBe('answered');
    expect(r.reason).toBe('verified');
    expect(r.citations.map((c) => c.chunkId)).toContain(okChunk);
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain('机密补充说明');
  });

  it('AE7 谓词侧：grant 只授权被授部门（换 grant 部门即换可见集）', async () => {
    enableDeptAcl();
    state.assignments = [];
    state.grants = [{ deptId: DEPT_B, maxVisibilityLevel: 20, expiresAt: null }];

    expect(await visibleDocs()).toEqual([DOC_B20, DOC_LIB].sort());
  });

  it('B2-3 反向构造：绕过可见性闸喂全量语料时，被挡文档确实会被召回（证明上面的缺席不是空转）', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];

    const leaked = await runRetrieve(
      { tenantId: TENANT, kbId: KB, question: QUESTION, membership: 'member', userId: USER },
      {
        ...corpusDeps(),
        loadCorpus: async () =>
          store.chunks.map((c) => ({
            chunkId: c.id,
            docId: c.docId,
            title: c.docId,
            text: c.bodyText,
            preview: c.preview,
            lifecycle: 'active',
            embedding: store.embeddings.find((e) => e.chunkId === c.id)?.embedding,
          })),
      },
    );

    expect(leaked.ok).toBe(true);
    if (!leaked.ok) return;
    expect(leaked.evidence.map((e) => e.docId)).toContain(DOC_A30);
  });
});

describe('语料装载的 tenantId 来源（fail-closed）', () => {
  it('文档行缺 tenantId → 归属/授权查不到，部门文档不可见（只留空部门）', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: true }];
    const saved = store.documents.map((d) => d.tenantId);
    for (const d of store.documents) d.tenantId = '';
    try {
      expect(await visibleDocs()).toEqual([DOC_LIB]);
    } finally {
      store.documents.forEach((d, i) => {
        d.tenantId = saved[i] ?? TENANT;
      });
    }
  });
});

describe('runRetrieve 的 ES 收窄与 PG 语料同源（AE8 对称）', () => {
  it('开强制时 sparse 收窄参数与非超管语料同时给出（部门上界与可见集一致）', async () => {
    enableDeptAcl();
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];
    let captured: { ownerDeptIds?: string[]; maxVisibleLevel?: number } | undefined;

    const deps: RetrieveDeps = {
      ...corpusDeps(),
      esMode: 'http',
      sparseSearch: async (input) => {
        captured = input;
        return store.chunks.map((c) => c.id);
      },
    };
    const r = await runRetrieve(
      { tenantId: TENANT, kbId: KB, question: QUESTION, membership: 'member', userId: USER },
      deps,
    );

    expect(captured?.ownerDeptIds?.slice().sort()).toEqual(
      [DEPT_A, DEPT_B, DEPT_C].sort(),
    );
    expect(captured?.maxVisibleLevel).toBe(20);
    // ES 陈旧命中（全部 chunkId）经语料求交后只剩 PG 可见的块
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(new Set(r.evidence.map((e) => e.docId))).toEqual(
      new Set([DOC_A20, DOC_B20, DOC_C20, DOC_LIB]),
    );
  });
});

describe('夹具自检', () => {
  it('每篇文档都有分片与向量（避免断言空转）', () => {
    expect(store.chunks).toHaveLength(DOC_FIXTURES.length);
    expect(store.embeddings).toHaveLength(DOC_FIXTURES.length);
    const all = store.chunks.map((c) => c.id);
    expect(new Set(all).size).toBe(DOC_FIXTURES.length);
  });
});
