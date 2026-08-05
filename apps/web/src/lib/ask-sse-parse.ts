import { AskResponseSchema, type AskResponse } from '@strict-rag/contracts';

export type AskSseStatus = { phase: string; status?: string };
export type AskSseError = { code: string; message: string; reason?: string };

/** 解析 SSE 文本块；只信 event: final 的 data。 */
export function parseAskSseText(text: string): {
  final: AskResponse | null;
  error: AskSseError | null;
  statuses: AskSseStatus[];
} {
  const statuses: AskSseStatus[] = [];
  let error: AskSseError | null = null;
  let final: AskResponse | null = null;

  // ponytail: 按双换行分帧，够用；不引 eventsource 库
  const frames = text.replace(/\r\n/g, '\n').split('\n\n');
  for (const frame of frames) {
    if (!frame.trim()) continue;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) continue;
    const raw = dataLines.join('\n');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event === 'status' && parsed && typeof parsed === 'object') {
      statuses.push(parsed as AskSseStatus);
    } else if (event === 'error' && parsed && typeof parsed === 'object') {
      const e = parsed as AskSseError;
      error = { code: e.code ?? 'INTERNAL', message: e.message ?? 'error', reason: e.reason };
    } else if (event === 'final') {
      const r = AskResponseSchema.safeParse(parsed);
      if (r.success) final = r.data;
    }
  }
  return { final, error, statuses };
}
