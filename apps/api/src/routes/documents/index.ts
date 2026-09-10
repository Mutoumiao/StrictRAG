import {
  BizCode,
  CompleteUploadBodySchema,
  CreateKbBodySchema,
  type CompleteUploadResponse,
  type KnowledgeBaseListItem,
  type IngestJobListItem,
  type DocumentApprovalActionResponse,
  type DocumentScanEnqueueResponse,
  type PatchLifecycleResponse,
  type PutObjectResponse,
  type ReindexDocumentResponse,
  type UploadUrlResponse,
  PatchDocumentMetaBodySchema,
  PatchLifecycleBodySchema,
  ReindexDocumentBodySchema,
  UploadUrlBodySchema,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { roleBypassesKbMembership } from '../../auth/permissions/resolve.js';
import { requirePermission, requirePermissionWhenEnforced } from '../../auth/middleware.js';
import { canBecomeActive, canEnqueueScan, scanDeniedCode } from '../../gates/approval-scan.js';
import { checkUploadByteSize } from '../../gates/upload-size.js';
import { fail, ok } from '../../lib/response.js';
import { childLogger, logger } from '../../logger.js';
import type { ApiVariables } from '../../middleware/request-id.js';
import { getForUpload, paramsSnapshotFor } from '../../services/chunk-strategy-catalog.js';
import {
  resolveBindChunkStrategy,
  resolveReindexChunkStrategy,
} from '../../services/chunk-strategies.js';
import { documentRepo } from '../../services/documents.js';
import { ingestJobsRepo } from '../../services/ingest-jobs.js';
import { selectVisibleKbs, toKbListItem } from '../../services/kb-list.js';
import { DEV_DEFAULT_TENANT } from '../../services/members.js';
import {
  assertDocTypeAllowed,
  isSensitiveCompleteBlocked,
  parseDataClassFromConfig,
  parseDeptAclEnforceFromConfig,
  parseDeptInheritDownFromConfig,
  parseDocTypesFromConfig,
  resolveDeptAclEnforce,
  resolveDeptInheritDown,
} from '../../services/kb-settings.js';
import {
  filterDocsForDeptAcl,
  isDocVisibleForDeptAcl,
  loadDeptAssignments,
  loadDeptGrants,
  loadDeptNodes,
} from '../../services/retrieve/dept-acl.js';
import {
  filterDocsForAclPrincipals,
  isDocVisibleForAclPrincipals,
} from '../../services/retrieve/doc-acl.js';
import { env } from '../../env.js';
import {
  checkFixedWindowRateLimit,
  ingestRateLimitKey,
  ingestRateLimitStore,
  recordIngestComplete,
  type RateLimitResult,
} from '../../obs/index.js';
import { reindexEnqueueStage } from '../../services/ingest-reindex-stage.js';
import { enqueueIngest } from '../../services/queue.js';
import { effectiveMaxUploadBytes, getStorage } from '../../services/storage.js';
import { toDetail, toListItem } from './mappers.js';

export type DocumentRouteDeps = {
  /** ingest 平面限流；默认 INGEST_RATE_LIMIT_RPM + ingest store */
  checkIngestRateLimit?: (tenantId: string, kbId: string) => RateLimitResult;
};

export function createDocumentRoutes(deps: DocumentRouteDeps = {}) {
const documentRoutes = new Hono<{ Variables: ApiVariables }>();
const checkIngestLimit =
  deps.checkIngestRateLimit ??
  ((tenantId: string, kbId: string) =>
    checkFixedWindowRateLimit(ingestRateLimitKey(tenantId, kbId), {
      limit: env.INGEST_RATE_LIMIT_RPM,
      store: ingestRateLimitStore,
    }));

/** GET /api/v1/knowledge-bases — 身份可见库；enforce 关时列默认租户全量（可粘贴 uuid） */
documentRoutes.get('/knowledge-bases', requirePermissionWhenEnforced('kb.list'), async (c) => {
  const auth = c.get('auth');
  const tenantId = auth?.tenantId ?? DEV_DEFAULT_TENANT;
  const all = await documentRepo.listKbsByTenant(tenantId);
  const bypass = !auth || roleBypassesKbMembership(auth.roles ?? []);
  const memberKbIds = bypass
    ? new Set<string>()
    : new Set(await documentRepo.listMemberKbIds(auth.userId));
  const visible = selectVisibleKbs({ all, memberKbIds, bypass });
  const data: KnowledgeBaseListItem[] = visible.map(toKbListItem);
  return ok(c, data);
});

/** POST /api/v1/knowledge-bases — AUTH_ENFORCE 时需 kb.create；tenantId 只认令牌 */
documentRoutes.post('/knowledge-bases', requirePermissionWhenEnforced('kb.create'), async (c) => {
  const parsed = CreateKbBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }
  const auth = c.get('auth');
  const created = await documentRepo.createKb({
    tenantId: auth?.tenantId ?? DEV_DEFAULT_TENANT,
    name: parsed.data.name,
    description: parsed.data.description,
    initialAdminUserId: parsed.data.initialAdminUserId,
    createdBy: auth?.userId,
  });
  if (!created.ok) {
    return fail(c, BizCode.NOT_FOUND, 'user not found', 404);
  }
  return ok(c, created.kb, 201);
});

/** GET /api/v1/knowledge-bases/:kbId/documents */
documentRoutes.get(
  '/knowledge-bases/:kbId/documents',
  requirePermissionWhenEnforced('doc.view'),
  async (c) => {
    const kbId = c.req.param('kbId');
    const rows = await documentRepo.listDocsByKb(kbId);
    const kb = await documentRepo.getKb(kbId);
    const enforce = resolveDeptAclEnforce(
      parseDeptAclEnforceFromConfig(kb?.configJson ?? null),
    );
    const auth = c.get('auth');
    const bypass = roleBypassesKbMembership(auth?.roles ?? []);
    let visible = rows;
    if (enforce) {
      if (bypass) {
        logger.info(
          { event: 'dept_acl_bypass', userId: auth?.userId, kbId },
          'dept acl bypass',
        );
      } else {
        const tenantId = rows[0]?.tenantId;
        const [assignments, depts, grants] = await Promise.all([
          loadDeptAssignments(tenantId, auth?.userId),
          loadDeptNodes(tenantId),
          loadDeptGrants(tenantId, auth?.userId),
        ]);
        visible = filterDocsForDeptAcl(rows, {
          assignments,
          enforce: true,
          depts,
          grants,
          inheritDown: resolveDeptInheritDown(
            parseDeptInheritDownFromConfig(kb?.configJson ?? null),
          ),
        });
      }
    }
    visible = filterDocsForAclPrincipals(visible, {
      userId: auth?.userId,
      bypass,
    });
    return ok(c, visible.map(toListItem));
  },
);

/** POST /api/v1/knowledge-bases/:kbId/documents/upload-url */
documentRoutes.post(
  '/knowledge-bases/:kbId/documents/upload-url',
  requirePermissionWhenEnforced('doc.upload'),
  async (c) => {
    const kbId = c.req.param('kbId');
    const parsed = UploadUrlBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const kb = await documentRepo.getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const storage = getStorage();
    const docId = uuidv7();
    const slot = storage.createUploadSlot(kbId, docId, parsed.data.contentType);
    await documentRepo.insertUploadedDoc({
      id: docId,
      tenantId: kb.tenantId,
      kbId,
      title: parsed.data.title,
      objectBucket: slot.bucket,
      objectKey: slot.key,
      contentType: parsed.data.contentType,
    });

    const data: UploadUrlResponse = {
      docId,
      uploadUrl: slot.uploadUrl,
      method: slot.method,
      objectKey: slot.key,
      maxBytes: effectiveMaxUploadBytes(),
    };
    return ok(c, data, 201);
  },
);

/** PUT /api/v1/internal/objects — local storage 上传体 */
documentRoutes.put('/internal/objects', requirePermissionWhenEnforced('doc.upload'), async (c) => {
  const key = c.req.query('key');
  if (!key) {
    return fail(c, BizCode.VALIDATION_ERROR, 'key required');
  }
  const contentType = c.req.header('content-type') ?? 'application/octet-stream';
  const ab = await c.req.arrayBuffer();
  const buf = Buffer.from(ab);
  const max = effectiveMaxUploadBytes();
  if (buf.byteLength > max) {
    return fail(
      c,
      BizCode.PAYLOAD_TOO_LARGE,
      `upload exceeds limit ${max} bytes`,
      413,
      { maxBytes: max, actual: buf.byteLength },
    );
  }
  const stored = await getStorage().putObject(key, buf, contentType);
  const data: PutObjectResponse = {
    key: stored.key,
    byteSize: stored.byteSize,
    checksumSha256: stored.checksumSha256,
  };
  return ok(c, data);
});

/** POST .../complete — ADR-039 权威 size 闸 */
documentRoutes.post(
  '/knowledge-bases/:kbId/documents/:docId/complete',
  requirePermissionWhenEnforced('doc.upload'),
  async (c) => {
    const { kbId, docId } = c.req.param();
    const body = CompleteUploadBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, body.error.flatten());
    }

    const doc = await documentRepo.getDoc(docId);
    if (!doc || doc.kbId !== kbId) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (!doc.objectKey) {
      return fail(c, BizCode.RULE_VIOLATION, 'document has no object key');
    }

    const head = await getStorage().headObject(doc.objectKey);
    if (!head) {
      return fail(c, BizCode.NOT_FOUND, 'object not found in storage', 404);
    }

    const max = effectiveMaxUploadBytes();
    const sizeGate = checkUploadByteSize(head.byteSize, max);
    if (!sizeGate.ok) {
      return fail(
        c,
        sizeGate.code,
        `object size ${head.byteSize} exceeds limit ${max}`,
        413,
        { maxBytes: max, actual: head.byteSize },
      );
    }

    const forUpload = await getForUpload(kbId, doc.contentType ?? 'application/octet-stream');
    const strategyGate = resolveBindChunkStrategy({
      availableCodes: forUpload.available.map((a) => a.code),
      requested: body.data.chunkStrategy,
    });
    if (!strategyGate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, strategyGate.message, 400);
    }
    const strategyParams = await paramsSnapshotFor(kbId, strategyGate.code);

    let ownerDeptId = doc.ownerDeptId;
    let aclPrincipals = doc.aclPrincipals ?? null;
    if (
      body.data.ownerDeptId !== undefined ||
      body.data.visibilityLevel !== undefined ||
      body.data.aclPrincipals !== undefined
    ) {
      await documentRepo.patchMeta(docId, {
        ownerDeptId: body.data.ownerDeptId,
        visibilityLevel: body.data.visibilityLevel,
        aclPrincipals: body.data.aclPrincipals,
      });
      const latest = await documentRepo.getDoc(docId);
      if (!latest) {
        return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
      }
      // ponytail: 认回读行，禁止回退 patch 前快照（显式 null 清名单/部门不得 fail-open）
      ownerDeptId = latest.ownerDeptId;
      aclPrincipals = latest.aclPrincipals ?? null;
    }

    // P3b-SENS：策略闸之后、markComplete 之前。ACL 就绪 = 部门路径或显式名单。
    const kb = await documentRepo.getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const dataClass = parseDataClassFromConfig(kb.configJson ?? null);
    const enforce = resolveDeptAclEnforce(
      parseDeptAclEnforceFromConfig(kb.configJson ?? null),
    );
    if (
      isSensitiveCompleteBlocked({
        dataClass,
        ownerDeptId,
        deptAclEnforce: enforce,
        aclPrincipals,
      })
    ) {
      return fail(
        c,
        BizCode.RULE_VIOLATION,
        'sensitive knowledge base cannot complete until ACL is ready',
      );
    }

    // 试点限流（INGEST_RATE_LIMIT_RPM>0）：落 pending / 入队前
    const ingestRl = checkIngestLimit(doc.tenantId, kbId);
    if (!ingestRl.ok) {
      recordIngestComplete({ result: 'rate_limited' });
      childLogger({ requestId: c.get('requestId') }).warn(
        { retryAfterSec: ingestRl.retryAfterSec, plane: 'ingest', kbId, docId },
        'ingest rate limited',
      );
      return fail(c, BizCode.RATE_LIMITED, 'ingest rate limit exceeded', 429, {
        retryAfterSec: ingestRl.retryAfterSec,
        plane: 'ingest',
      });
    }

    await documentRepo.markCompletePending(docId, head.byteSize, {
      chunkStrategy: strategyGate.code,
      chunkStrategyParams: strategyParams,
    });
    recordIngestComplete({ result: 'ok' });

    childLogger({ requestId: c.get('requestId') }).info(
      {
        event: 'chunk_strategy_selected',
        docId,
        kbId,
        chunkStrategy: strategyGate.code,
        explicit: Boolean(body.data.chunkStrategy),
        available: forUpload.available.map((a) => a.code),
      },
      'chunk strategy selected on complete',
    );

    const data: CompleteUploadResponse = {
      docId,
      byteSize: head.byteSize,
      approvalStatus: 'pending',
      status: 'uploaded',
      chunkStrategy: strategyGate.code,
    };
    return ok(c, data);
  },
);

/**
 * POST /api/v1/documents/:docId/reindex — B12
 * 多策略时 body.chunkStrategy **必选**；无显式变更则保留旧策略。
 */
documentRoutes.post(
  '/documents/:docId/reindex',
  requirePermissionWhenEnforced('doc.reindex'),
  async (c) => {
    const docId = c.req.param('docId');
    const parsed = ReindexDocumentBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }

    const forUpload = await getForUpload(doc.kbId, doc.contentType ?? 'application/octet-stream');
    const strategyGate = resolveReindexChunkStrategy({
      availableCodes: forUpload.available.map((a) => a.code),
      requested: parsed.data.chunkStrategy,
      existing: doc.chunkStrategy,
    });
    if (!strategyGate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, strategyGate.message, 400);
    }

    if (strategyGate.changed) {
      const strategyParams = await paramsSnapshotFor(doc.kbId, strategyGate.code);
      await documentRepo.setChunkStrategy(docId, strategyGate.code, strategyParams);
    }

    const stage = reindexEnqueueStage({
      status: doc.status,
      extractMethod: doc.extractMethod,
    });
    const jobId =
      (await enqueueIngest({
        docId: doc.id,
        kbId: doc.kbId,
        tenantId: doc.tenantId,
        stage,
      })) ?? `local-${docId}`;

    childLogger({ requestId: c.get('requestId') }).info(
      {
        event: 'chunk_strategy_reindex',
        docId,
        chunkStrategy: strategyGate.code,
        strategyChanged: strategyGate.changed,
        retained: strategyGate.retained,
        jobId,
        stage,
      },
      'reindex enqueued with chunk strategy',
    );

    const data: ReindexDocumentResponse = {
      docId,
      enqueued: true,
      jobId,
      stage,
      chunkStrategy: strategyGate.code,
      strategyChanged: strategyGate.changed,
    };
    // 与 scan 入队一致：200 信封（ok 不接受 202）
    return ok(c, data);
  },
);

/** POST /api/v1/documents/:docId/approve */
documentRoutes.post(
  '/documents/:docId/approve',
  requirePermissionWhenEnforced('approval.decide'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (doc.approvalStatus === 'approved') {
      const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'approved' };
      return ok(c, data);
    }
    if (doc.approvalStatus !== 'pending') {
      return fail(
        c,
        BizCode.RULE_VIOLATION,
        `cannot approve when approvalStatus=${doc.approvalStatus}`,
      );
    }

    await documentRepo.approve(docId);
    const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'approved' };
    return ok(c, data);
  },
);

/** POST /api/v1/documents/:docId/reject — 无 ticket 表时的最小驳回 */
documentRoutes.post(
  '/documents/:docId/reject',
  requirePermissionWhenEnforced('approval.decide'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (doc.approvalStatus === 'rejected') {
      const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'rejected' };
      return ok(c, data);
    }
    if (doc.approvalStatus !== 'pending') {
      return fail(
        c,
        BizCode.RULE_VIOLATION,
        `cannot reject when approvalStatus=${doc.approvalStatus}`,
      );
    }
    await documentRepo.reject(docId);
    const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'rejected' };
    return ok(c, data);
  },
);

/** POST /api/v1/documents/:docId/scan — ADR-048 闸 */
documentRoutes.post(
  '/documents/:docId/scan',
  requirePermissionWhenEnforced('doc.upload'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (!canEnqueueScan(doc.approvalStatus)) {
      return fail(c, scanDeniedCode(), 'document must be approved before scan', 403, {
        approvalStatus: doc.approvalStatus,
      });
    }

    const jobId = await enqueueIngest({
      docId: doc.id,
      kbId: doc.kbId,
      tenantId: doc.tenantId,
      stage: 'scan',
    });

    const data: DocumentScanEnqueueResponse = {
      docId,
      enqueued: true,
      jobId,
      stage: 'scan',
    };
    return ok(c, data);
  },
);

/** PATCH /api/v1/documents/:docId/lifecycle */
documentRoutes.patch(
  '/documents/:docId/lifecycle',
  requirePermissionWhenEnforced('doc.lifecycle'),
  async (c) => {
    const docId = c.req.param('docId');
    const parsed = PatchLifecycleBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }

    if (parsed.data.lifecycle === 'active' && !canBecomeActive(doc.status)) {
      return fail(c, BizCode.CONFLICT, 'only ready documents can become active', 409, {
        status: doc.status,
      });
    }

    await documentRepo.setLifecycle(docId, parsed.data.lifecycle);
    const data: PatchLifecycleResponse = {
      docId,
      lifecycle: parsed.data.lifecycle,
      status: doc.status,
    };
    return ok(c, data);
  },
);

/** PATCH /api/v1/documents/:docId — 部门 / 可见级 / 类型 / 名单；不改 lifecycle、不入队 */
documentRoutes.patch('/documents/:docId', requirePermission('doc.editor'), async (c) => {
  const docId = c.req.param('docId');
  const parsed = PatchDocumentMetaBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }

  if (parsed.data.docType !== undefined) {
    const kb = await documentRepo.getKb(doc.kbId);
    const allowed = parseDocTypesFromConfig(kb?.configJson ?? null);
    const gate = assertDocTypeAllowed(allowed, parsed.data.docType);
    if (!gate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, gate.message, 400);
    }
  }

  await documentRepo.patchMeta(docId, {
    ...(parsed.data.ownerDeptId !== undefined ? { ownerDeptId: parsed.data.ownerDeptId } : {}),
    ...(parsed.data.visibilityLevel !== undefined
      ? { visibilityLevel: parsed.data.visibilityLevel }
      : {}),
    ...(parsed.data.docType !== undefined ? { docType: parsed.data.docType } : {}),
    ...(parsed.data.aclPrincipals !== undefined
      ? { aclPrincipals: parsed.data.aclPrincipals }
      : {}),
  });
  const updated = await documentRepo.getDoc(docId);
  if (!updated) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  return ok(c, toDetail(updated));
});

/** GET /api/v1/documents/:docId */
documentRoutes.get('/documents/:docId', requirePermissionWhenEnforced('doc.view'), async (c) => {
  const docId = c.req.param('docId');
  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  const kb = await documentRepo.getKb(doc.kbId);
  const enforce = resolveDeptAclEnforce(
    parseDeptAclEnforceFromConfig(kb?.configJson ?? null),
  );
  const auth = c.get('auth');
  const bypass = roleBypassesKbMembership(auth?.roles ?? []);
  if (enforce) {
    if (bypass) {
      logger.info(
        { event: 'dept_acl_bypass', userId: auth?.userId, kbId: doc.kbId, docId: doc.id },
        'dept acl bypass',
      );
    } else {
      const [assignments, depts, grants] = await Promise.all([
        loadDeptAssignments(doc.tenantId, auth?.userId),
        loadDeptNodes(doc.tenantId),
        loadDeptGrants(doc.tenantId, auth?.userId),
      ]);
      const inheritDown = resolveDeptInheritDown(
        parseDeptInheritDownFromConfig(kb?.configJson ?? null),
      );
      if (
        !isDocVisibleForDeptAcl(
          doc,
          assignments,
          true,
          depts,
          grants,
          undefined,
          undefined,
          inheritDown,
        )
      ) {
        return fail(c, BizCode.FORBIDDEN, 'department acl denied', 403);
      }
    }
  }
  if (!isDocVisibleForAclPrincipals(doc, { userId: auth?.userId, bypass })) {
    return fail(c, BizCode.FORBIDDEN, 'document acl denied', 403);
  }
  return ok(c, toDetail(doc));
});

/** GET /api/v1/documents/:docId/ingest-jobs — 只读账本，不写 */
documentRoutes.get(
  '/documents/:docId/ingest-jobs',
  requirePermissionWhenEnforced('doc.view'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    const data: IngestJobListItem[] = await ingestJobsRepo.listByDocId(docId);
    return ok(c, data);
  },
);

  return documentRoutes;
}

export const documentRoutes = createDocumentRoutes();
