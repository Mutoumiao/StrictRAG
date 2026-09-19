/**
 * 目标：待审批文档不得被默认问答应答——complete 后仍是 uploaded/draft，未双就绪一律不可检。
 * 需求：剧本 V2 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048 · P0 R7
 * 被测：POST /api/v1/knowledge-bases/:kbId/ask（经 loadCorpus 语料装载）
 * 简介：未审批（approvalStatus=pending ∧ status=uploaded ∧ lifecycle=draft）→ 语料为空 → 200 拒答 kb_not_ready；
 *       ready 但未上架同样不可检；对照仅 ready∧active 才可作答。默认 mock ES。
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import type { GraphDeps } from '../../src/graph/run.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { filterDocsForRetrieve } from '../../src/services/retrieve/corpus.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import type { CorpusChunk } from '../../src/services/retrieve/types.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '01900000-0000-7000-8000-0000000000e2';
const QUESTION = '差旅住宿标准';
const DOC_BODY = '差旅住宿标准为每晚上限 500 元，超标须事前审批。';
const DIMS = 8;

type FixtureDoc = {
  id: string;
  kbId: string;
  title: string;
  status: string;
  lifecycle: string;
  approvalStatus: string;
  body: string;
};

const fixture: FixtureDoc[] = [];

function graphDeps(): GraphDeps {
  return {
    retrieve: (input) =>
      runRetrieve(input, {
        loadCorpus: async ({ kbId }): Promise<CorpusChunk[]> =>
          filterDocsForRetrieve(fixture.filter((d) => d.kbId === kbId)).map((d) => ({
            chunkId: CHUNK,
            docId: d.id,
            title: d.title,
            text: d.body,
            preview: d.body.slice(0, 40),
            lifecycle: d.lifecycle,
            embedding: mockEmbedVector(d.body, DIMS),
          })),
        embed: async (texts) => texts.map((t) => mockEmbedVector(t, DIMS)),
        rerank: async (_query, passages, topN) =>
          passages.map((_p, index) => ({ index, score: 1 - index / 100 })).slice(0, topN),
        esMode: 'mock',
      }),
    chat: async (purpose) => {
      if (purpose === 'generate') {
        return JSON.stringify({
          answer: '差旅住宿标准为每晚上限 500 元。',
          citations: [CHUNK],
          insufficient: false,
        });
      }
      if (purpose === 'claim_split') {
        return JSON.stringify({
          claims: [{ text: '差旅住宿标准为每晚上限 500 元', chunkIds: [CHUNK] }],
        });
      }
      if (purpose === 'judge') return JSON.stringify({ scores: [0.93] });
      throw new Error(`unexpected purpose ${purpose}`);
    },
  };
}

/** complete 之后的真实形态：对象已登记、进审批、尚未入库 */
function pendingDoc(): FixtureDoc {
  return {
    id: DOC,
    kbId: KB,
    title: '差旅制度',
    status: 'uploaded',
    lifecycle: 'draft',
    approvalStatus: 'pending',
    body: DOC_BODY,
  };
}

async function ask() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  const userId = uuidv7();
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (uid, kbId) => kbId === KB && uid === userId,
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
      settingsRepo: { get: async () => null, update: async () => null },
      execute: async (params) => {
        const { executeAsk } = await import('../../src/services/ask/execute.js');
        return executeAsk(params, { skipTrace: true, graphDeps: graphDeps() });
      },
      resolveOwnedSession: async () => true,
    }),
  );
  const pair = await issueTokenPair({
    userId,
    app: 'web',
    roles: ['web_consumer'],
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: { authorization: `Bearer ${pair.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ question: QUESTION }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    data: {
      status: string;
      reason: string;
      answer: string;
      answerKind?: string;
      citations: { chunkId: string; docId: string }[];
    };
  };
}

beforeEach(() => {
  fixture.length = 0;
});

describe('剧本 V2 · 未审批文档不可检', () => {
  it('complete 后 pending/uploaded/draft → 语料为空且 ask 拒答 kb_not_ready', async () => {
    const doc = pendingDoc();
    fixture.push(doc);

    expect(filterDocsForRetrieve([doc]).map((d) => d.id)).toEqual([]);

    const body = await ask();
    expect(body.data.status).toBe('abstained');
    expect(body.data.reason).toBe('kb_not_ready');
    expect(body.data.answer).toBe('');
    expect(body.data.citations).toEqual([]);
  });

  it('已 ready 但未上架（draft）仍不可检', async () => {
    const doc = { ...pendingDoc(), status: 'ready', approvalStatus: 'approved' };
    fixture.push(doc);

    expect(filterDocsForRetrieve([doc]).map((d) => d.id)).toEqual([]);

    const body = await ask();
    expect(body.data.status).toBe('abstained');
    expect(body.data.reason).toBe('kb_not_ready');
  });

  it('对照：审批通过且双就绪（ready ∧ active）才可作答并引用该文档', async () => {
    fixture.push({
      ...pendingDoc(),
      status: 'ready',
      lifecycle: 'active',
      approvalStatus: 'approved',
    });

    const body = await ask();
    expect(body.data.status).toBe('answered');
    expect(body.data.reason).toBe('verified');
    expect(body.data.citations[0]?.docId).toBe(DOC);
  });
});
