export {
  GatewayError,
  GatewayConfigError,
  mapGatewayFailureToAskReason,
  kindFromHttpStatus,
  type GatewayErrorKind,
  type GatewayPurpose,
} from './errors.js';
export { withSameModelRetry, DEFAULT_MAX_ATTEMPTS } from './retry.js';
export {
  buildGatewayConfig,
  applyBindingsToGatewayConfig,
  resolveChatModel,
  resolveEmbedModel,
  resolveRerankModel,
  resolveEndpoint,
  type GatewayConfig,
  type GatewayMode,
  type GatewayEnvSlice,
  type ChatPurpose,
  type PurposeEndpoint,
  type BindingSnapshotRow,
  type ProviderSnapshotRow,
} from './resolve.js';
export { loadPlatformBindingSnapshot, clearBindingCache } from './bindings.js';
export { createMockGateway, mockEmbedVector, type MockGatewayHooks } from './mock-client.js';
export { createHttpGateway, type FetchLike } from './http-client.js';
export {
  createGateway,
  getGateway,
  getGatewayForTenant,
  getGatewayConfig,
  getGatewayConfigForTenant,
  resetGatewayForTests,
  type GatewayClient,
  type ChatRequest,
  type ChatResult,
  type RerankHit,
} from './client.js';
