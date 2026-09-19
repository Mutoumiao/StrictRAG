/** 入库测例共享内存夹具；非测例（闸只收 `*.test.ts`）。 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
  ingestJobs,
  ingestReports,
} from '@strict-rag/db';

export type MemDoc = {
  id: string;
  tenantId: string;
  kbId: string;
  title: string;
  objectKey: string | null;
  contentType: string | null;
  approvalStatus: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  parsedText: string | null;
  extractMethod: string | null;
  mongoDocId: string | null;
  chunkStrategy: string | null;
  chunkStrategyParams: Record<string, unknown> | null;
  indexVersion: number;
  activeIndexVersion: number;
  embedReady: number;
  esReady: number;
  lifecycle: string;
  ownerDeptId: string | null;
  aclPrincipals: string[] | null;
};

export type MemState = {
  docs: MemDoc[];
  chunks: Record<string, unknown>[];
  manifests: Record<string, unknown>[];
  embeddings: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  /** `documents.update` 的 patch，按调用顺序（原子切换 / 状态链断言用） */
  docPatches: Record<string, unknown>[];
  /** 上述 patch 里写过的 status，按调用顺序 */
  statusSeq: string[];
  jobs: { inserted: Record<string, unknown>[]; updated: Record<string, unknown>[] };
};

export type IngestTestEnv = {
  APP_ENV: string;
  LOG_LEVEL: string;
  INGEST_SCAN_MODE: string;
  INGEST_MIN_EXTRACTED_CHARS: number;
  INGEST_EMBED_MODE: string;
  INGEST_ES_MODE: string;
  MONGODB_URL: string;
  GATEWAY_BASE_URL: string;
  GATEWAY_API_KEY: string;
  GATEWAY_EMBED_MODEL: string;
  ELASTICSEARCH_URL: string;
  INGEST_CONTEXTUALIZE_MODE: string;
  INGEST_OCR_ENABLED: boolean;
  INGEST_OCR_ADR_REF: string;
  INGEST_OCR_MIN_CONFIDENCE: number;
  STORAGE_MODE: 'local' | 's3';
  STORAGE_LOCAL_DIR: string;
  S3_BUCKET: string;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
};

/** 默认 mock 栈：mock_clean + mock embed + mock ES；不得当生产扫描 / 真杀毒 / 生产 ES */
export function defaultWorkerEnv(): IngestTestEnv {
  return {
    APP_ENV: 'test',
    LOG_LEVEL: 'silent',
    INGEST_SCAN_MODE: 'mock_clean',
    INGEST_MIN_EXTRACTED_CHARS: 40,
    INGEST_EMBED_MODE: 'mock',
    INGEST_ES_MODE: 'mock',
    MONGODB_URL: '',
    GATEWAY_BASE_URL: '',
    GATEWAY_API_KEY: '',
    GATEWAY_EMBED_MODEL: 'text-embedding-3-small',
    ELASTICSEARCH_URL: '',
    INGEST_CONTEXTUALIZE_MODE: 'off',
    INGEST_OCR_ENABLED: false,
    INGEST_OCR_ADR_REF: '',
    INGEST_OCR_MIN_CONFIDENCE: 0.7,
    STORAGE_MODE: 'local',
    STORAGE_LOCAL_DIR: '.data/objects',
    S3_BUCKET: 'strict-rag',
    S3_ENDPOINT: '',
    S3_ACCESS_KEY: '',
    S3_SECRET_KEY: '',
  };
}

export function seedDoc(over: Partial<MemDoc> = {}): MemDoc {
  return {
    id: '01900000-0000-7000-8000-0000000000d1',
    tenantId: '01900000-0000-7000-8000-000000000001',
    kbId: '01900000-0000-7000-8000-0000000000aa',
    title: '考勤制度',
    objectKey: 'kb/x/policy.txt',
    contentType: 'text/plain',
    approvalStatus: 'approved',
    status: 'uploaded',
    errorCode: null,
    errorMessage: null,
    parsedText: null,
    extractMethod: null,
    mongoDocId: null,
    chunkStrategy: 'structure_paragraph',
    chunkStrategyParams: { contextMode: 'l0_template' },
    indexVersion: 0,
    activeIndexVersion: 0,
    embedReady: 0,
    esReady: 0,
    lifecycle: 'draft',
    ownerDeptId: null,
    aclPrincipals: null,
    ...over,
  };
}

function seedState(over: Partial<MemDoc> = {}): MemState {
  const doc = seedDoc(over);
  return {
    docs: [doc],
    chunks: [],
    manifests: [],
    embeddings: [],
    reports: [],
    docPatches: [],
    statusSeq: [],
    jobs: { inserted: [], updated: [] },
  };
}

/**
 * where 近似：把条件树里的等值参数（drizzle `Param.value`）收齐，
 * 要求它们**全部**出现在该行；`inArray` 的数组参数要求行值落在数组内。
 * 这样同文档多 indexVersion 的 manifest / embedding 选择可辨（不是「返回全表取第一条」）。
 */
function conditionHits(row: Record<string, unknown>, cond: unknown): boolean {
  const values: unknown[] = [];
  const arrays: unknown[][] = [];
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.queryChunks)) {
      for (const chunk of obj.queryChunks) walk(chunk);
      return;
    }
    if ('encoder' in obj && 'value' in obj) {
      if (Array.isArray(obj.value)) arrays.push(obj.value as unknown[]);
      else values.push(obj.value);
    }
  };
  walk(cond);
  const cells = Object.values(row);
  return (
    values.every((v) => cells.includes(v)) &&
    arrays.every((arr) => arr.some((v) => cells.includes(v)))
  );
}

function rowsOf(state: MemState, table: unknown): Record<string, unknown>[] {
  if (table === documents) return state.docs as unknown as Record<string, unknown>[];
  if (table === chunkManifests) return state.manifests;
  if (table === chunkEmbeddings) return state.embeddings;
  if (table === chunks) return state.chunks;
  if (table === ingestReports) return state.reports;
  if (table === ingestJobs) return state.jobs.inserted;
  return [];
}

function asRows(rows: Record<string, unknown>[]) {
  const p = Promise.resolve(rows);
  return Object.assign(p, { limit: async (n?: number) => (n == null ? rows : rows.slice(0, n)) });
}

export function createMemDb(state: MemState) {
  const hit = (table: unknown, cond: unknown) =>
    rowsOf(state, table).filter((row) => cond == null || conditionHits(row, cond));
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond?: unknown) => asRows(hit(table, cond)),
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async (cond?: unknown) => {
          const rows = hit(table, cond);
          // ingest_jobs：只记 patch，不用终态覆写 inserted 行（保留 running 快照两张视图）
          if (table === ingestJobs) {
            state.jobs.updated.push({ ...patch });
            return;
          }
          for (const row of rows) Object.assign(row, patch);
          if (table === documents && rows.length > 0) {
            state.docPatches.push({ ...patch });
            if (typeof patch.status === 'string') state.statusSeq.push(patch.status);
          }
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (cond?: unknown) => {
        const rows = rowsOf(state, table);
        const doomed = rows.filter((row) => cond == null || conditionHits(row, cond));
        for (const row of doomed) {
          const at = rows.indexOf(row);
          if (at >= 0) rows.splice(at, 1);
        }
        const p = Promise.resolve(doomed);
        return Object.assign(p, { returning: async () => doomed });
      },
    }),
    insert: (table: unknown) => ({
      values: async (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(row) ? row : [row];
        if (table === chunks) state.chunks.push(...rows);
        else if (table === chunkManifests) state.manifests.push(...rows);
        else if (table === chunkEmbeddings) state.embeddings.push(...rows);
        else if (table === ingestReports) state.reports.push(...rows);
        else if (table === ingestJobs) state.jobs.inserted.push(...rows.map((r) => ({ ...r })));
      },
    }),
  };
}

export type IngestHarness = {
  env: IngestTestEnv;
  state: MemState | null;
  db: ReturnType<typeof createMemDb> | null;
  objectBytes: Buffer;
  /** object-store mock 读过的 key（按顺序） */
  readKeys: string[];
  /** object-store mock 删过的 key（「对象已删」断言） */
  deletedKeys: string[];
  boot(over?: Partial<MemDoc>, objectBytes?: Buffer): MemState;
  reset(): void;
};

export function createHarness(): IngestHarness {
  const harness: IngestHarness = {
    env: defaultWorkerEnv(),
    state: null,
    db: null,
    objectBytes: Buffer.from(''),
    readKeys: [],
    deletedKeys: [],
    boot(over: Partial<MemDoc> = {}, objectBytes?: Buffer): MemState {
      const state = seedState(over);
      harness.state = state;
      harness.db = createMemDb(state);
      if (objectBytes) harness.objectBytes = objectBytes;
      return state;
    },
    reset() {
      harness.readKeys = [];
      harness.deletedKeys = [];
    },
  };
  return harness;
}

export function doc(state: MemState): MemDoc {
  return state.docs[0]!;
}

/** 同一状态里再放一份文档（多文档串行 / 混序断言用）；`over.id` 必填 */
export function addDoc(state: MemState, over: Partial<MemDoc>): MemDoc {
  const created = seedDoc(over);
  state.docs.push(created);
  return created;
}

/** 对象存储替身工厂：给 `vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h))` 用 */
export function objectStoreMock(h: IngestHarness) {
  return {
    readObjectBytes: async (_cfg: unknown, key: string | null) => {
      h.readKeys.push(key ?? '');
      return h.objectBytes;
    },
    deleteObject: async (_cfg: unknown, key: string | null) => {
      h.deletedKeys.push(key ?? '');
    },
    storeConfigFromEnv: () => ({ mode: 'local', localDir: '.', bucket: 'strict-rag' }),
  };
}

/** 最小 PDF（未压缩 Tj 文本层）；与 `pdf-text.ts` 的抽取口径一致 */
export function miniPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
  return Buffer.from(
    `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF
`,
    'latin1',
  );
}

/** 同一 indexVersion 的行集合（PG 向量 / manifest 用） */
export function idsOf(
  rows: readonly Record<string, unknown>[],
  indexVersion: number,
  field: string,
): string[] {
  return rows
    .filter((r) => r.indexVersion === indexVersion)
    .map((r) => String(r[field]))
    .sort();
}
