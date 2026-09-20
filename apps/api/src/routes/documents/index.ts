import {
  BizCode,
  CompleteUploadBodySchema,
  CreateKbBodySchema,
  type KnowledgeBaseListItem,
  type IngestJobListItem,
  type DocumentApprovalActionResponse,
  type DocumentScanEnqueueResponse,
  type PatchLifecycleResponse,
  type PutObjectResponse,
  type ReindexDocumentResponse,
  type SupersedeDocumentResponse,
  type DeleteDocumentResponse,
  type UploadUrlResponse,
  type WriteDocumentResponse,
  PatchDocumentMetaBodySchema,
  DocumentAclSchema,
  PutDocumentAclBodySchema,
  PutDocumentAclResponseSchema,
  aclTightens,
  PatchLifecycleBodySchema,
  SupersedeDocumentBodySchema,
  ResolveDedupeConflictBodySchema,
  ResolveDedupeConflictResponseSchema,
  ReindexDocumentBodySchema,
  UploadUrlBodySchema,
  WriteDocumentBodySchema,
  resolveIngestContentType,
} from '@strict-rag/contracts';
import { isEffectiveWindowOrdered } from '@strict-rag/db';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { createDocMemberGate } from '../../auth/doc-scope.js';
import {
  requirePermission,
  requirePermissionWhenEnforced,
  type ResolveKbMember,
} from '../../auth/middleware.js';
import { roleBypassesKbMembership } from '../../auth/permissions/resolve.js';
import { canBecomeActive, canEnqueueScan, evaluateSelfDecide, scanDeniedCode } from '../../gates/approval-scan.js';
import { checkUploadMedia } from '../../gates/upload-media.js';
import { fail, ok } from '../../lib/response.js';
import { childLogger, logger } from '../../logger.js';
import type { ApiVariables } from '../../middleware/request-id.js';
import { getForUpload, paramsSnapshotFor } from '../../services/chunk-strategy-catalog.js';
import { resolveReindexChunkStrategy } from '../../services/chunk-strategies.js';
import {
  dedupeConflictRepo,
  evaluateResolveRequest,
} from '../../services/dedupe-conflict.js';
import { evaluateDocumentDelete } from '../../services/document-delete.js';
import { evaluateSupersedeLink } from '../../services/document-supersede.js';
import { documentRepo } from '../../services/documents.js';
import { ingestJobsRepo } from '../../services/ingest-jobs.js';
import { selectVisibleKbs, toKbListItem } from '../../services/kb-list.js';
import { DEV_DEFAULT_TENANT } from '../../services/members.js';
import {
  assertDocTypeAllowed,
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
import {
  checkFixedWindowRateLimit,
  ingestRateLimitKey,
  ingestRateLimitStore,
  planeQuotas,
  recordIngestComplete,
  type RateLimitResult,
} from '../../obs/index.js';
import {
  evaluateWriteIngestGates,
  finalizePendingIngest,
} from '../../services/ingest-complete-pending.js';
import { reindexEnqueueStage } from '../../services/ingest-reindex-stage.js';
import { enqueueIngest } from '../../services/queue.js';
import { effectiveMaxUploadBytes, getStorage } from '../../services/storage.js';
import { toDetail, toListItem } from './mappers.js';

export type DocumentRouteDeps = {
  /** ingest 平面限流；默认 INGEST_RATE_LIMIT_RPM + ingest store */
  checkIngestRateLimit?: (tenantId: string, kbId: string) => RateLimitResult;
  /** 文档写入口成员闸的成员解析；默认查 kb_members，测例注入内存实现 */
  resolveKbMember?: ResolveKbMember;
};

export function createDocumentRoutes(deps: DocumentRouteDeps = {}) {
const documentRoutes = new Hono<{ Variables: ApiVariables }>();

/** 文档级 KB 成员闸（读写共用，见 `auth/doc-scope.ts`）；姿态随各入口权限码 */
const docMemberDenied = createDocMemberGate(deps);

const checkIngestLimit =
  deps.checkIngestRateLimit ??
  ((tenantId: string, kbId: string) =>
    checkFixedWindowRateLimit(ingestRateLimitKey(tenantId, kbId), {
      limit: planeQuotas.ingest.rpm,
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

    const contentType = resolveIngestContentType({
      contentType: parsed.data.contentType,
      fileName: parsed.data.title,
    });
    if (!contentType) {
      return fail(c, BizCode.UNSUPPORTED_MEDIA_TYPE, 'unsupported media type', 415);
    }

    const kb = await documentRepo.getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const storage = getStorage();
    const docId = uuidv7();
    const slot = storage.createUploadSlot(kbId, docId, contentType);
    await documentRepo.insertUploadedDoc({
      id: docId,
      tenantId: kb.tenantId,
      kbId,
      title: parsed.data.title,
      objectBucket: slot.bucket,
      objectKey: slot.key,
      contentType,
    });

    const data: UploadUrlResponse = {
      docId,
      uploadUrl: slot.uploadUrl,
      method: slot.method,
      objectKey: slot.key,
      maxBytes: effectiveMaxUploadBytes(contentType),
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
  const contentType = c.req.header('content-type') ?? '';
  const mediaGate = checkUploadMedia({ contentType });
  if (!mediaGate.ok) {
    return fail(c, mediaGate.code, 'unsupported media type', 415);
  }
  const ab = await c.req.arrayBuffer();
  const buf = Buffer.from(ab);
  const max = effectiveMaxUploadBytes(contentType);
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

    // ADR-048 #4：认得出 actor 才记提交人；AUTH_ENFORCE 关时不编造
    const actorUserId = c.get('auth')?.userId;
    const finalized = await finalizePendingIngest({
      kbId,
      docId,
      fields: body.data,
      requestId: c.get('requestId'),
      checkIngestLimit,
      ...(actorUserId ? { actorUserId } : {}),
    });
    if (!finalized.ok) {
      return fail(c, finalized.code, finalized.message, finalized.httpStatus, finalized.details);
    }
    return ok(c, finalized.data);
  },
);

/** POST …/documents/write — 在线编写 Markdown，进审批，不入队 scan */
documentRoutes.post(
  '/knowledge-bases/:kbId/documents/write',
  requirePermissionWhenEnforced('doc.editor'),
  async (c) => {
    const kbId = c.req.param('kbId');
    const parsed = WriteDocumentBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const title = parsed.data.title.trim();
    const markdown = parsed.data.markdown.trim();
    if (!title || !markdown) {
      return fail(c, BizCode.VALIDATION_ERROR, 'title and markdown are required');
    }

    const kb = await documentRepo.getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const buf = Buffer.from(markdown, 'utf8');
    const fields = {
      chunkStrategy: parsed.data.chunkStrategy,
      ownerDeptId: parsed.data.ownerDeptId,
      visibilityLevel: parsed.data.visibilityLevel,
      aclPrincipals: parsed.data.aclPrincipals,
    };
    const gated = await evaluateWriteIngestGates({
      kbId,
      tenantId: kb.tenantId,
      contentType: 'text/markdown',
      fileName: title,
      byteSize: buf.byteLength,
      fields,
      requestId: c.get('requestId'),
      checkIngestLimit,
    });
    if (!gated.ok) {
      return fail(c, gated.code, gated.message, gated.httpStatus, gated.details);
    }

    const storage = getStorage();
    const docId = uuidv7();
    const slot = storage.createUploadSlot(kbId, docId, 'text/markdown');
    const stored = await storage.putObject(slot.key, buf, 'text/markdown');
    // ADR-048 #4：认得出 actor 才记提交人；AUTH_ENFORCE 关时不编造
    const actorUserId = c.get('auth')?.userId;
    await documentRepo.insertUploadedDoc({
      id: docId,
      tenantId: kb.tenantId,
      kbId,
      title,
      objectBucket: slot.bucket,
      objectKey: slot.key,
      contentType: 'text/markdown',
      sourceType: 'write',
    });
    if (fields.ownerDeptId !== undefined || fields.visibilityLevel !== undefined || fields.aclPrincipals !== undefined) {
      await documentRepo.patchMeta(docId, {
        ownerDeptId: fields.ownerDeptId,
        visibilityLevel: fields.visibilityLevel,
        aclPrincipals: fields.aclPrincipals,
      });
    }
    await documentRepo.markCompletePending(docId, buf.byteLength, {
      chunkStrategy: gated.strategyCode,
      chunkStrategyParams: gated.strategyParams,
      checksumSha256: stored.checksumSha256,
      ...(actorUserId ? { uploadedBy: actorUserId } : {}),
    });
    recordIngestComplete({ result: 'ok' });

    const data: WriteDocumentResponse = {
      docId,
      byteSize: buf.byteLength,
      approvalStatus: 'pending',
      status: 'uploaded',
      chunkStrategy: gated.strategyCode,
      sourceType: 'write',
    };
    return ok(c, data, 201);
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

    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

    const forUpload = await getForUpload(doc.kbId, doc.contentType ?? 'text/plain');
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

    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

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

    // ADR-048 #4 四眼：提交人不得批自己的单（无 actor / 无提交人时不误伤）
    const actorUserId = c.get('auth')?.userId ?? null;
    const selfDecide = evaluateSelfDecide({ actorUserId, submittedBy: doc.uploadedBy });
    if (!selfDecide.ok) {
      return fail(c, BizCode.FORBIDDEN, selfDecide.message, 403, {
        reason: 'self_approve_forbidden',
      });
    }

    await documentRepo.approve(docId, actorUserId);
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

    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

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

    // ADR-048 #4 四眼：驳回同口径，防自审者自行驳回规避
    const actorUserId = c.get('auth')?.userId ?? null;
    const selfDecide = evaluateSelfDecide({ actorUserId, submittedBy: doc.uploadedBy });
    if (!selfDecide.ok) {
      return fail(c, BizCode.FORBIDDEN, selfDecide.message, 403, {
        reason: 'self_approve_forbidden',
      });
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

    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

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

    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

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

/** POST /api/v1/documents/:docId/supersede — 旧文 superseded，后继 active；两列互指 */
documentRoutes.post(
  '/documents/:docId/supersede',
  requirePermissionWhenEnforced('doc.lifecycle'),
  async (c) => {
    const docId = c.req.param('docId');
    const parsed = SupersedeDocumentBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const old = await documentRepo.getDoc(docId);
    const successor = await documentRepo.getDoc(parsed.data.successorDocId);
    const verdict = evaluateSupersedeLink({
      old,
      successor,
      successorDocId: parsed.data.successorDocId,
    });
    if (!verdict.ok) {
      return fail(c, verdict.code, verdict.message, verdict.httpStatus);
    }

    // 成员闸以旧文所属库为准；旧文缺失由 verdict 先给 404
    if (old) {
      const memberDenied = await docMemberDenied(c, old.kbId, 'whenEnforced');
      if (memberDenied) return memberDenied;
    }

    await documentRepo.supersedePair(docId, parsed.data.successorDocId);
    const data: SupersedeDocumentResponse = {
      oldDocId: docId,
      successorDocId: parsed.data.successorDocId,
      oldLifecycle: 'superseded',
      successorLifecycle: 'active',
    };
    return ok(c, data);
  },
);

/**
 * POST /api/v1/documents/:docId/dedupe-conflicts/:chunkId/resolve — 跨 doc 去重的人工二选一（剧本 E4）。
 * 权限与 `PATCH /documents/:docId` 同码（`doc.editor`）；**不**代跑 reindex：
 * 重新入库须持 `doc.reindex`，本端点不替调用方升级权限，只回 `reindexRequired`。
 */
documentRoutes.post(
  '/documents/:docId/dedupe-conflicts/:chunkId/resolve',
  requirePermission('doc.editor'),
  async (c) => {
    const docId = c.req.param('docId');
    const chunkId = c.req.param('chunkId');
    const parsed = ResolveDedupeConflictBodySchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const chunk = await dedupeConflictRepo.getChunk(docId, chunkId);
    // 成员闸用该块所属库；块不存在时不给 403（留给 verdict 的 404）
    if (chunk) {
      const memberDenied = await docMemberDenied(c, chunk.kbId, 'always');
      if (memberDenied) return memberDenied;
    }
    const verdict = evaluateResolveRequest(chunk);
    if (!verdict.ok) {
      return fail(c, BizCode[verdict.code], verdict.message, verdict.httpStatus);
    }

    await dedupeConflictRepo.resolve({ docId, chunkId, winner: parsed.data.winner });
    return ok(
      c,
      ResolveDedupeConflictResponseSchema.parse({
        docId,
        chunkId,
        winner: parsed.data.winner,
        reindexRequired: parsed.data.winner === 'this',
      }),
    );
  },
);

/** DELETE /api/v1/documents/:docId — archived 后入队 purge；PATCH archived 不入队 */
documentRoutes.delete(
  '/documents/:docId',
  requirePermissionWhenEnforced('doc.lifecycle'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    const verdict = evaluateDocumentDelete(doc);
    if (!verdict.ok) {
      return fail(c, verdict.code, verdict.message, verdict.httpStatus);
    }
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }

    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

    await documentRepo.archiveForPurge(docId);
    const job: Parameters<typeof enqueueIngest>[0] = {
      docId: doc.id,
      kbId: doc.kbId,
      tenantId: doc.tenantId,
      stage: 'purge',
    };
    if (doc.indexVersion > 0) {
      job.indexVersion = doc.indexVersion;
    }
    await enqueueIngest(job);
    const data: DeleteDocumentResponse = {
      docId,
      lifecycle: 'archived',
      purgeEnqueued: true,
    };
    return ok(c, data);
  },
);

/** PATCH /api/v1/documents/:docId — 部门 / 可见级 / 类型 / 名单 / 生效区间；不改 lifecycle、不入队 */
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

  const memberDenied = await docMemberDenied(c, doc.kbId, 'always');
  if (memberDenied) return memberDenied;

  if (parsed.data.docType !== undefined) {
    const kb = await documentRepo.getKb(doc.kbId);
    const allowed = parseDocTypesFromConfig(kb?.configJson ?? null);
    const gate = assertDocTypeAllowed(allowed, parsed.data.docType);
    if (!gate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, gate.message, 400);
    }
  }

  const nextFrom =
    parsed.data.effectiveFrom !== undefined ? parsed.data.effectiveFrom : (doc.effectiveFrom ?? null);
  const nextTo =
    parsed.data.effectiveTo !== undefined ? parsed.data.effectiveTo : (doc.effectiveTo ?? null);
  if (!isEffectiveWindowOrdered(nextFrom, nextTo)) {
    return fail(c, BizCode.VALIDATION_ERROR, 'effectiveFrom must be <= effectiveTo', 400);
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
    ...(parsed.data.effectiveFrom !== undefined ? { effectiveFrom: parsed.data.effectiveFrom } : {}),
    ...(parsed.data.effectiveTo !== undefined ? { effectiveTo: parsed.data.effectiveTo } : {}),
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
  const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
  if (memberDenied) return memberDenied;

  const kb = await documentRepo.getKb(doc.kbId);
  const auth = c.get('auth');
  const denied = await docReadDenied({
    doc,
    kbConfigJson: kb?.configJson ?? null,
    userId: auth?.userId,
    roles: auth?.roles,
  });
  if (denied) {
    return fail(c, BizCode.FORBIDDEN, denied, 403);
  }
  return ok(c, toDetail(doc));
});

/**
 * 文档可见性闸：部门强制（按 KB/env 开时）→ aclPrincipals 名单。
 * 返回拒绝文案；通过返回 null。
 * **详情与 ACL 入口共用同一份判定**：ACL 名单本身也是 ACL 元数据，
 * 看不到该文档的人不得读它的名单（禁止只在一处加严）。
 */
async function docReadDenied(input: {
  doc: NonNullable<Awaited<ReturnType<typeof documentRepo.getDoc>>>;
  kbConfigJson: Record<string, unknown> | null;
  userId?: string | undefined;
  roles?: readonly string[] | undefined;
}): Promise<string | null> {
  const { doc } = input;
  const bypass = roleBypassesKbMembership(input.roles ?? []);
  const enforce = resolveDeptAclEnforce(parseDeptAclEnforceFromConfig(input.kbConfigJson ?? null));
  if (enforce) {
    if (bypass) {
      logger.info(
        { event: 'dept_acl_bypass', userId: input.userId, kbId: doc.kbId, docId: doc.id },
        'dept acl bypass',
      );
    } else {
      const [assignments, depts, grants] = await Promise.all([
        loadDeptAssignments(doc.tenantId, input.userId),
        loadDeptNodes(doc.tenantId),
        loadDeptGrants(doc.tenantId, input.userId),
      ]);
      const inheritDown = resolveDeptInheritDown(
        parseDeptInheritDownFromConfig(input.kbConfigJson ?? null),
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
        return 'department acl denied';
      }
    }
  }
  if (!isDocVisibleForAclPrincipals(doc, { userId: input.userId, bypass })) {
    return 'document acl denied';
  }
  return null;
}

/** GET /api/v1/documents/:docId/acl — 文档 ACL 专用入口（PRD 05-api §2.4）；可见性闸同详情 */
documentRoutes.get(
  '/documents/:docId/acl',
  requirePermissionWhenEnforced('doc.view'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

    const kb = await documentRepo.getKb(doc.kbId);
    const auth = c.get('auth');
    const denied = await docReadDenied({
      doc,
      kbConfigJson: kb?.configJson ?? null,
      userId: auth?.userId,
      roles: auth?.roles,
    });
    if (denied) {
      return fail(c, BizCode.FORBIDDEN, denied, 403);
    }
    return ok(c, DocumentAclSchema.parse({ docId, aclPrincipals: doc.aclPrincipals ?? null }));
  },
);

/**
 * PUT /api/v1/documents/:docId/acl — 三态写（`null` 清回缺省 / `[]` 显式空 / 非空名单）。
 * 权限与 `PATCH /documents/:docId` **同一码**（`doc.editor`）；**不叠**可见性闸：
 * `[]` 的文档对非超管本就不可读，若写路径也过闸，谁都无法把它修回来。
 */
documentRoutes.put('/documents/:docId/acl', requirePermission('doc.editor'), async (c) => {
  const docId = c.req.param('docId');
  const parsed = PutDocumentAclBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }
  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  const memberDenied = await docMemberDenied(c, doc.kbId, 'always');
  if (memberDenied) return memberDenied;

  // 收紧（有人失去可读性）→ ES 索引字段滞后，须 reindex 才对稀疏路生效（ADR-009 决策 4）
  const reindexRequired = aclTightens(doc.aclPrincipals ?? null, parsed.data.aclPrincipals);
  await documentRepo.patchMeta(docId, { aclPrincipals: parsed.data.aclPrincipals });
  const updated = await documentRepo.getDoc(docId);
  if (!updated) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  if (reindexRequired) {
    logger.info(
      {
        event: 'doc_acl_tightened',
        docId,
        kbId: doc.kbId,
        indexVersion: doc.indexVersion,
        reindexRequired: true,
      },
      'doc acl tightened; ES 侧须 reindex 后才最终一致',
    );
  }
  return ok(
    c,
    PutDocumentAclResponseSchema.parse({
      docId,
      aclPrincipals: updated.aclPrincipals ?? null,
      reindexRequired,
    }),
  );
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
    const memberDenied = await docMemberDenied(c, doc.kbId, 'whenEnforced');
    if (memberDenied) return memberDenied;

    const data: IngestJobListItem[] = await ingestJobsRepo.listByDocId(docId);
    return ok(c, data);
  },
);

  return documentRoutes;
}

export const documentRoutes = createDocumentRoutes();
