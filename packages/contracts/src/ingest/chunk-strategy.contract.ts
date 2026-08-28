import { z } from 'zod';

import { CHUNK_STRATEGY_DOC_FAMILIES } from './chunk-strategy.js';

export const ChunkStrategyDocFamilySchema = z.enum(CHUNK_STRATEGY_DOC_FAMILIES);
export type ChunkStrategyDocFamilyWire = z.infer<typeof ChunkStrategyDocFamilySchema>;

export const ChunkStrategyCatalogItemSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  implemented: z.boolean(),
  system: z.boolean(),
  docFamilies: z.array(ChunkStrategyDocFamilySchema),
  paramSchema: z.record(z.string(), z.unknown()),
  pipelineId: z.string().min(1).max(80),
  enabled: z.boolean(),
  recommendedFamilies: z.array(ChunkStrategyDocFamilySchema),
  paramOverrides: z.record(z.string(), z.unknown()).nullable(),
});
export type ChunkStrategyCatalogItem = z.infer<typeof ChunkStrategyCatalogItemSchema>;

export const ChunkStrategyCatalogResponseSchema = z.object({
  items: z.array(ChunkStrategyCatalogItemSchema),
});
export type ChunkStrategyCatalogResponse = z.infer<typeof ChunkStrategyCatalogResponseSchema>;

export const ChunkStrategySchemaItemSchema = z.object({
  code: z.string().min(1).max(64),
  paramSchema: z.record(z.string(), z.unknown()),
});
export const ChunkStrategySchemaResponseSchema = z.object({
  items: z.array(ChunkStrategySchemaItemSchema),
});
export type ChunkStrategySchemaResponse = z.infer<typeof ChunkStrategySchemaResponseSchema>;

export const ForUploadQuerySchema = z.object({
  contentType: z.string().min(1).max(200),
});
export type ForUploadQuery = z.infer<typeof ForUploadQuerySchema>;

export const ForUploadOptionSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1),
  implemented: z.boolean(),
  recommended: z.boolean(),
});
export const ForUploadResponseSchema = z.object({
  contentType: z.string(),
  family: ChunkStrategyDocFamilySchema,
  available: z.array(ForUploadOptionSchema),
  recommendedCode: z.string().nullable(),
  requireExplicit: z.boolean(),
  autoCode: z.string().nullable(),
});
export type ForUploadResponse = z.infer<typeof ForUploadResponseSchema>;

export const PatchKbChunkStrategyItemSchema = z.object({
  code: z.string().min(1).max(64),
  enabled: z.boolean(),
  recommendedFamilies: z.array(ChunkStrategyDocFamilySchema).optional(),
  paramOverrides: z.record(z.string(), z.unknown()).nullable().optional(),
});
export const PatchKbChunkStrategiesBodySchema = z.object({
  items: z.array(PatchKbChunkStrategyItemSchema).min(1),
});
export type PatchKbChunkStrategiesBody = z.infer<typeof PatchKbChunkStrategiesBodySchema>;
