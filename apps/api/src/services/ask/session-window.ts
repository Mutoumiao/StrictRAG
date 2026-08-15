type Turn = { role: 'user' | 'assistant'; content: string };

const MAX_USERS = 2;
const MAX_TURNS = 6;
const ASSISTANT_CLIP = 160;

/** 助手一句截断：去掉 citations 全文，再取首句且 ≤160 字 */
export function clipAssistantContent(content: string): string {
  const stripped = content
    .replace(/\n(?:CITATIONS?|引用)\s*[:：][\s\S]*$/i, '')
    .replace(/\[(?:cite|citation|chunkId)[^\]]*\]/gi, '')
    .trim();
  const sentence = stripped.match(/^[\s\S]*?[。！？.!?]/);
  const one = (sentence ? sentence[0] : stripped).trim();
  return one.length <= ASSISTANT_CLIP ? one : one.slice(0, ASSISTANT_CLIP);
}

/**
 * 从末尾回溯：最多 2 条 user + 其间/其后 assistant（各截断）。
 * 合计 ≤6。不含本轮（调用方只传入已落库历史）。
 */
export function clipSessionWindow(messages: ReadonlyArray<Turn>): Turn[] {
  let usersFound = 0;
  let start = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      usersFound += 1;
      start = i;
      if (usersFound >= MAX_USERS) break;
    }
  }
  if (usersFound === 0) return [];

  const slice: Turn[] = messages.slice(start).map((m) => ({
    role: m.role,
    content: m.role === 'assistant' ? clipAssistantContent(m.content) : m.content,
  }));

  if (slice.length <= MAX_TURNS) return slice;
  return slice.slice(slice.length - MAX_TURNS);
}
