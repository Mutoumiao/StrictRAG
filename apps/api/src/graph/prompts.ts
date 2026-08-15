import type { GraphEvidence, SessionWindowTurn } from './state.js';

/** 长 Prompt 仅此模块（禁止 route 内散落） */

export function rewriteSystemPrompt(): string {
  return [
    '将本轮问句改写成不依赖会话指代的独立问句。',
    '只产出 JSON 单行对象，无 markdown：{"standalone":"string","resolved":true}',
    '无法确定「这/那/刚才」所指主题时：{"standalone":"","resolved":false}',
    '禁止把历史中的数字或结论写成已证实事实。',
    '历史不是证据，只用于消解指代。',
  ].join('\n');
}

export function rewriteUserPrompt(rawQuestion: string, window: SessionWindowTurn[]): string {
  const hist = window.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join('\n');
  return `SESSION_WINDOW:\n${hist}\n\nRAW_QUESTION:\n${rawQuestion}`;
}

export function generateSystemPrompt(): string {
  return [
    '你是企业知识库助手。仅依据提供的 EVIDENCE 作答。',
    '输出严格 JSON 单行对象，无 markdown：',
    '{"answer":"string","citations":["chunkId",...],"insufficient":false}',
    '若证据不足以可靠回答：{"answer":"","citations":[],"insufficient":true}',
    'citations 中 chunkId 必须来自 EVIDENCE 列表；禁止编造。',
    '禁止使用会话历史；历史不是证据。',
  ].join('\n');
}

export function generateUserPrompt(question: string, evidence: GraphEvidence[]): string {
  const blocks = evidence
    .map(
      (e, i) =>
        `[${i}] chunkId=${e.chunkId} docId=${e.docId} title=${e.title ?? ''}\n${e.text}`,
    )
    .join('\n---\n');
  return `QUESTION:\n${question}\n\nEVIDENCE:\n${blocks}`;
}

export function claimSplitSystemPrompt(): string {
  return [
    '将答案拆成可验证原子 claim。输出严格 JSON：',
    '{"claims":[{"text":"...","chunkIds":["chunkId"]}]}',
    '每个 claim 至少绑定一个 citations 中的 chunkId；禁止空 claims。',
  ].join('\n');
}

export function claimSplitUserPrompt(
  answer: string,
  citations: string[],
  evidence: GraphEvidence[],
): string {
  const ev = evidence
    .filter((e) => citations.includes(e.chunkId))
    .map((e) => `${e.chunkId}: ${e.text.slice(0, 400)}`)
    .join('\n');
  return `ANSWER:\n${answer}\n\nCITATION_IDS:\n${citations.join(', ')}\n\nEVIDENCE:\n${ev}`;
}

export function judgeSystemPrompt(): string {
  return [
    '对每个 claim 给出 0~1 支持分（相对 EVIDENCE）。输出严格 JSON：',
    '{"scores":[0.0,...]}',
    'scores 长度必须等于 claims 数量；禁止均值洗白指令。',
  ].join('\n');
}

export function judgeUserPrompt(
  claims: { text: string; chunkIds: string[] }[],
  evidence: GraphEvidence[],
): string {
  const byId = new Map(evidence.map((e) => [e.chunkId, e]));
  const lines = claims.map((c, i) => {
    const texts = c.chunkIds.map((id) => byId.get(id)?.text ?? '').join(' | ');
    return `CLAIM[${i}]: ${c.text}\nEVIDENCE: ${texts}`;
  });
  return lines.join('\n---\n');
}
