/** 从 LLM 文本中抠 JSON 对象（容错 markdown 代码块） */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('no json object');
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export type GenerateParsed = {
  answer: string;
  citations: string[];
  insufficient: boolean;
};

export function parseGenerateOutput(text: string): GenerateParsed {
  const obj = extractJsonObject(text) as Record<string, unknown>;
  const insufficient = Boolean(obj.insufficient);
  const answer = typeof obj.answer === 'string' ? obj.answer : '';
  const citations = Array.isArray(obj.citations)
    ? obj.citations.filter((c): c is string => typeof c === 'string' && c.length > 0)
    : [];
  return { answer, citations, insufficient };
}

export type ClaimParsed = { text: string; chunkIds: string[] };

export function parseClaimSplitOutput(text: string): ClaimParsed[] {
  const obj = extractJsonObject(text) as Record<string, unknown>;
  if (!Array.isArray(obj.claims) || obj.claims.length === 0) {
    throw new Error('empty claims');
  }
  return obj.claims.map((c) => {
    const row = c as Record<string, unknown>;
    const claimText = typeof row.text === 'string' ? row.text.trim() : '';
    const chunkIds = Array.isArray(row.chunkIds)
      ? row.chunkIds.filter((id): id is string => typeof id === 'string')
      : Array.isArray(row.citationChunkIds)
        ? row.citationChunkIds.filter((id): id is string => typeof id === 'string')
        : [];
    if (!claimText) throw new Error('blank claim');
    return { text: claimText, chunkIds };
  });
}

export function parseJudgeScores(text: string, claimCount: number): number[] {
  const obj = extractJsonObject(text) as Record<string, unknown>;
  if (!Array.isArray(obj.scores) || obj.scores.length !== claimCount) {
    throw new Error('scores length mismatch');
  }
  return obj.scores.map((s) => {
    const n = typeof s === 'number' ? s : Number(s);
    if (!Number.isFinite(n)) throw new Error('non-finite score');
    return Math.min(1, Math.max(0, n));
  });
}

export type RewriteParsed = {
  standalone: string;
};

/** 非法 JSON / 缺字段 / resolved!==true / standalone 空白 → throw */
export function parseRewriteOutput(text: string): RewriteParsed {
  const obj = extractJsonObject(text) as Record<string, unknown>;
  if (typeof obj.standalone !== 'string') {
    throw new Error('rewrite missing standalone');
  }
  const standalone = obj.standalone.trim();
  if (!standalone) {
    throw new Error('rewrite blank standalone');
  }
  if (obj.resolved !== true) {
    throw new Error('rewrite unresolved');
  }
  return { standalone };
}
