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
  resolveChatModel,
  resolveEmbedModel,
  resolveRerankModel,
  type GatewayConfig,
  type GatewayMode,
  type GatewayEnvSlice,
  type ChatPurpose,
} from './resolve.js';
export { createMockGateway, mockEmbedVector, type MockGatewayHooks } from './mock-client.js';
export { createHttpGateway, type FetchLike } from './http-client.js';
export {
  createGateway,
  getGateway,
  getGatewayConfig,
  resetGatewayForTests,
  type GatewayClient,
  type ChatRequest,
  type ChatResult,
  type RerankHit,
} from './client.js';
