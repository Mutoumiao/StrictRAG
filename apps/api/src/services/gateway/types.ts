import type { ChatPurpose } from './resolve.js';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatRequest = {
  purpose: ChatPurpose;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type ChatResult = {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
  meta: {
    provider: string;
    model: string;
    attempt: number;
    fallbackUsed: boolean;
    latencyMs: number;
  };
};

export type RerankHit = { index: number; score: number };

export type GatewayClient = {
  chat(req: ChatRequest): Promise<ChatResult>;
  embed(texts: string[], model?: string): Promise<number[][]>;
  rerank(query: string, passages: string[], topN?: number, model?: string): Promise<RerankHit[]>;
};
