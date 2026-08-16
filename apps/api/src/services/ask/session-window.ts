type Turn = { role: 'user' | 'assistant'; content: string };

const MAX_USERS = 2;
const MAX_TURNS = 6;
const DEEP_MAX_USERS = 4;
const DEEP_MAX_TURNS = 8;
const ASSISTANT_CLIP = 160;

/** 显式会话回溯：贴「刚才/之前/刚刚 + 说/聊」；禁止裸匹配「刚才」 */
export function isExplicitSessionBackref(q: string): boolean {
  // ponytail: 正则够用，不新开 intent LLM
  return /(?:刚才|之前|刚刚).{0,6}(?:说[过的]|聊)/.test(q);
}

/** 显式文档回溯：贴「这份/那份/这篇/那篇/上面那/该 + 文档|文件|制度|材料」 */
export function isExplicitDocumentBackref(q: string): boolean {
  // ponytail: 正则够用，不新开 intent LLM
  return /(?:这份|那份|这篇|那篇|上面那[份篇个]?|该).{0,6}(?:文档|文件|制度|材料)/.test(q);
}

/** 末轮 evidence snapshot 的保序去重 docId；空/缺省 → [] */
export function uniqueEvidenceDocIds(
  snapshot: ReadonlyArray<{ docId?: string }> | null | undefined,
): string[] {
  if (!snapshot?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of snapshot) {
    const id = item.docId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

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
 * 从末尾回溯：默认最多 2 条 user、合计 ≤6；`deepened` 时 4 user / 硬顶 8。
 * 不含本轮（调用方只传入已落库历史）。
 */
export function clipSessionWindow(
  messages: ReadonlyArray<Turn>,
  opts?: { deepened?: boolean },
): Turn[] {
  const maxUsers = opts?.deepened ? DEEP_MAX_USERS : MAX_USERS;
  const maxTurns = opts?.deepened ? DEEP_MAX_TURNS : MAX_TURNS;
  let usersFound = 0;
  let start = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      usersFound += 1;
      start = i;
      if (usersFound >= maxUsers) break;
    }
  }
  if (usersFound === 0) return [];

  const slice: Turn[] = messages.slice(start).map((m) => ({
    role: m.role,
    content: m.role === 'assistant' ? clipAssistantContent(m.content) : m.content,
  }));

  if (slice.length <= maxTurns) return slice;
  return slice.slice(slice.length - maxTurns);
}
