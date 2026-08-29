/**
 * ARCH-P2-1：OpenAPI 3.1 文档构建（schema 源 = @strict-rag/contracts Zod）。
 * 不改 route 实现；代表性路径 + 组件引用。
 */
import {
  AskAuditResponseSchema,
  AskModesSchema,
  AskRequestSchema,
  AskResponseSchema,
  BizCode,
  CompleteUploadBodySchema,
  CompleteUploadResponseSchema,
  CreateEvalRunBodySchema,
  CreateEvalRunResponseSchema,
  CreateGoldQuestionBodySchema,
  CreateKbBodySchema,
  CreateKbResponseSchema,
  EvalRunSchema,
  GoldQuestionSchema,
  DevLoginRequestSchema,
  HealthResponseSchema,
  ReadyResponseSchema,
  TokenPairResponseSchema,
  UploadUrlBodySchema,
  UploadUrlResponseSchema,
} from '@strict-rag/contracts';
import { z } from 'zod';

/** OpenAPI 3.1 document（JSON-serializable） */
export type OpenApiDocument = {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
};

function zodSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  // OpenAPI components 不需要 JSON Schema 的 $schema 元字段
  delete json.$schema;
  return json;
}

function ref(name: string): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

/** 信封 meta / error（contracts 现为 TS 类型，无 Zod；形状对齐 response.ts） */
function envelopeSchemas(): Record<string, unknown> {
  const bizCodeValues = Object.values(BizCode);
  return {
    ApiMeta: {
      type: 'object',
      required: ['requestId', 'timestamp'],
      properties: {
        requestId: { type: 'string' },
        timestamp: { type: 'string', description: '本地时间串 yyyy-MM-dd HH:mm:ss' },
      },
      additionalProperties: false,
    },
    ApiError: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', enum: bizCodeValues },
        message: { type: 'string' },
        details: {},
      },
      additionalProperties: false,
    },
    ApiFailure: {
      type: 'object',
      required: ['ok', 'error', 'meta'],
      properties: {
        ok: { type: 'boolean', const: false },
        error: ref('ApiError'),
        meta: ref('ApiMeta'),
      },
      additionalProperties: false,
    },
  };
}

/**
 * 从 contracts Zod 生成 OpenAPI 文档。
 * 路径为代表性子集，**非**全 API 表面。
 */
export function buildOpenApiDocument(): OpenApiDocument {
  const fromContracts: Record<string, unknown> = {
    HealthResponse: zodSchema(HealthResponseSchema),
    ReadyResponse: zodSchema(ReadyResponseSchema),
    AskRequest: zodSchema(AskRequestSchema),
    AskResponse: zodSchema(AskResponseSchema),
    AskAuditResponse: zodSchema(AskAuditResponseSchema),
    AskModes: zodSchema(AskModesSchema),
    GoldQuestion: zodSchema(GoldQuestionSchema),
    CreateGoldQuestionBody: zodSchema(CreateGoldQuestionBodySchema),
    EvalRun: zodSchema(EvalRunSchema),
    CreateEvalRunBody: zodSchema(CreateEvalRunBodySchema),
    CreateEvalRunResponse: zodSchema(CreateEvalRunResponseSchema),
    CreateKbBody: zodSchema(CreateKbBodySchema),
    CreateKbResponse: zodSchema(CreateKbResponseSchema),
    UploadUrlBody: zodSchema(UploadUrlBodySchema),
    UploadUrlResponse: zodSchema(UploadUrlResponseSchema),
    CompleteUploadBody: zodSchema(CompleteUploadBodySchema),
    CompleteUploadResponse: zodSchema(CompleteUploadResponseSchema),
    DevLoginRequest: zodSchema(DevLoginRequestSchema),
    TokenPairResponse: zodSchema(TokenPairResponseSchema),
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'StrictRAG API',
      version: '0.4.x',
      description:
        '企业知识库 API（dev 文档面 · ARCH-P2-1）。components.schemas 由 @strict-rag/contracts Zod 生成；' +
        'paths 为代表性子集，非全量端点清单。禁止将 mock 数字写入签字包。',
    },
    servers: [{ url: 'http://localhost:4000', description: 'local api (default port)' }],
    paths: {
      '/health': {
        get: {
          operationId: 'getHealth',
          summary: '进程存活',
          tags: ['system'],
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': { schema: ref('HealthResponse') },
              },
            },
          },
        },
      },
      '/ready': {
        get: {
          operationId: 'getReady',
          summary: '依赖就绪探测',
          tags: ['system'],
          responses: {
            '200': {
              description: 'ready',
              content: {
                'application/json': { schema: ref('ReadyResponse') },
              },
            },
            '503': {
              description: 'not ready',
              content: {
                'application/json': { schema: ref('ReadyResponse') },
              },
            },
          },
        },
      },
      '/api/v1/auth/dev-login': {
        post: {
          operationId: 'postDevLogin',
          summary: '开发登录（仅 development）',
          tags: ['auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: ref('DevLoginRequest') },
            },
          },
          responses: {
            '200': {
              description: 'ApiSuccess TokenPair',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok', 'data', 'meta'],
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('TokenPairResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '400': {
              description: 'validation / not dev',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases': {
        post: {
          operationId: 'createKnowledgeBase',
          summary: '创建知识库',
          tags: ['ingest'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: ref('CreateKbBody') },
            },
          },
          responses: {
            '200': {
              description: 'created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('CreateKbResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '401': {
              description: 'unauthorized',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/documents/upload-url': {
        post: {
          operationId: 'createUploadUrl',
          summary: '预签名/本地上传 URL',
          tags: ['ingest'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: ref('UploadUrlBody') },
            },
          },
          responses: {
            '200': {
              description: 'upload target',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('UploadUrlResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/documents/{docId}/complete': {
        post: {
          operationId: 'completeUpload',
          summary: '上传完成闸（可带 chunkStrategy）',
          tags: ['ingest'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'docId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': { schema: ref('CompleteUploadBody') },
            },
          },
          responses: {
            '200': {
              description: 'completed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('CompleteUploadResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/ask-modes': {
        get: {
          operationId: 'getAskModes',
          summary: '成员读取库允许的问答档位（不含 τ / 质量快照）',
          tags: ['ask'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'ApiSuccess AskModes',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('AskModes'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '401': {
              description: 'unauthorized',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
            '403': {
              description: 'forbidden',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
            '404': {
              description: 'knowledge base not found',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/gold-questions': {
        get: {
          operationId: 'listGoldQuestions',
          summary: '列出知识库黄金集题面',
          tags: ['eval'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'ApiSuccess GoldQuestion[]',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: {
                        type: 'object',
                        properties: { items: { type: 'array', items: ref('GoldQuestion') } },
                      },
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '401': {
              description: 'unauthorized',
              content: { 'application/json': { schema: ref('ApiFailure') } },
            },
            '403': {
              description: 'forbidden',
              content: { 'application/json': { schema: ref('ApiFailure') } },
            },
          },
        },
        post: {
          operationId: 'createGoldQuestion',
          summary: '新增黄金集题面',
          tags: ['eval'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: ref('CreateGoldQuestionBody') } },
          },
          responses: {
            '201': {
              description: 'created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('GoldQuestion'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/eval/runs': {
        post: {
          operationId: 'createEvalRun',
          summary: '入队 L1 黄金集跑批（worker 消费，请求线程不跑完）',
          tags: ['eval'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: false,
            content: { 'application/json': { schema: ref('CreateEvalRunBody') } },
          },
          responses: {
            '200': {
              description: 'queued',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('CreateEvalRunResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/eval/runs/{runId}': {
        get: {
          operationId: 'getEvalRun',
          summary: '查询评测 run 结果（含 2×2）',
          tags: ['eval'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'runId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'ApiSuccess EvalRun',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('EvalRun'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '404': {
              description: 'eval run not found',
              content: { 'application/json': { schema: ref('ApiFailure') } },
            },
          },
        },
      },
      '/api/v1/knowledge-bases/{kbId}/ask': {
        post: {
          operationId: 'postAsk',
          summary: '单轮 ask（同步；流见 AI SDK 协议）',
          tags: ['ask'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'kbId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: ref('AskRequest') },
            },
          },
          responses: {
            '200': {
              description: 'ApiSuccess AskResponse（业务 answered|abstained 仍 HTTP 200）',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('AskResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '401': {
              description: 'unauthorized',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
            '403': {
              description: 'forbidden',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
      '/api/v1/ask/{requestId}': {
        get: {
          operationId: 'getAskAudit',
          summary: '按 requestId 回溯当时 evidence 快照（非断线重拉）',
          tags: ['ask'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'requestId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'ApiSuccess AskAuditResponse',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', const: true },
                      data: ref('AskAuditResponse'),
                      meta: ref('ApiMeta'),
                    },
                  },
                },
              },
            },
            '401': {
              description: 'unauthorized',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
            '403': {
              description: 'forbidden',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
            '404': {
              description: 'ask trace not found',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          operationId: 'getOpenApiDocument',
          summary: '本 OpenAPI 文档（开关开启时）',
          tags: ['docs'],
          responses: {
            '200': {
              description: 'OpenAPI 3.1 JSON',
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
            '404': {
              description: 'docs disabled',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
      '/api/v1/docs': {
        get: {
          operationId: 'getOpenApiDocs',
          summary: 'Scalar API Reference（开关开启时）',
          tags: ['docs'],
          responses: {
            '200': { description: 'HTML' },
            '404': {
              description: 'docs disabled',
              content: {
                'application/json': { schema: ref('ApiFailure') },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ...envelopeSchemas(),
        ...fromContracts,
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authorization: Bearer <accessToken>',
        },
      },
    },
  };
}
