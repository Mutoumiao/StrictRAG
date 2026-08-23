/**
 * 目标：OpenAPI 文档必须从 contracts 生成。
 * 需求：ARCH-P2-1
 * 被测：buildOpenApiDocument / isOpenApiDocsEnabled
 * 简介：OpenAPI 文档自 contracts 生成。
 */

import { AskRequestSchema, HealthResponseSchema } from '@strict-rag/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildOpenApiDocument } from '../../src/openapi/document.js';
import { isOpenApiDocsEnabled } from '../../src/openapi/routes.js';

describe('buildOpenApiDocument (ARCH-P2-1)', () => {
  it('emits OpenAPI 3.1 with StrictRAG title', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toMatch(/StrictRAG/i);
  });

  it('embeds HealthResponse / AskRequest / AskResponse from contracts Zod', () => {
    const doc = buildOpenApiDocument();
    const schemas = doc.components.schemas;

    // 与 contracts 真源对照：字段集合须覆盖 Zod 生成结果（非测试内硬编码表）
    const healthFromZod = z.toJSONSchema(HealthResponseSchema) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    const askReqFromZod = z.toJSONSchema(AskRequestSchema) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };

    const health = schemas.HealthResponse as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    const askReq = schemas.AskRequest as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    const askRes = schemas.AskResponse as { properties?: Record<string, unknown> };

    expect(health?.properties).toBeDefined();
    expect(Object.keys(health.properties ?? {}).sort()).toEqual(
      Object.keys(healthFromZod.properties ?? {}).sort(),
    );
    expect(health.required?.slice().sort()).toEqual(healthFromZod.required?.slice().sort());

    expect(askReq?.properties).toBeDefined();
    expect(Object.keys(askReq.properties ?? {}).sort()).toEqual(
      Object.keys(askReqFromZod.properties ?? {}).sort(),
    );
    expect(askRes?.properties).toBeDefined();
    expect(askRes.properties).toHaveProperty('status');
    expect(askRes.properties).toHaveProperty('answer');
    expect(askRes.properties).toHaveProperty('citations');
  });

  it('documents GET /health and POST ask path', () => {
    const doc = buildOpenApiDocument();
    expect(doc.paths['/health']).toBeDefined();
    expect((doc.paths['/health'] as { get?: unknown }).get).toBeDefined();
    const askPath = doc.paths['/api/v1/knowledge-bases/{kbId}/ask'] as {
      post?: { requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> } };
    };
    expect(askPath?.post).toBeDefined();
    const ref = askPath.post?.requestBody?.content?.['application/json']?.schema?.$ref;
    expect(ref).toBe('#/components/schemas/AskRequest');
  });
});

describe('isOpenApiDocsEnabled', () => {
  it('defaults on for development and test', () => {
    expect(isOpenApiDocsEnabled('development', undefined)).toBe(true);
    expect(isOpenApiDocsEnabled('test', undefined)).toBe(true);
  });

  it('defaults off for staging and production', () => {
    expect(isOpenApiDocsEnabled('staging', undefined)).toBe(false);
    expect(isOpenApiDocsEnabled('production', undefined)).toBe(false);
  });

  it('explicit flag overrides app env', () => {
    expect(isOpenApiDocsEnabled('production', true)).toBe(true);
    expect(isOpenApiDocsEnabled('development', false)).toBe(false);
  });
});
