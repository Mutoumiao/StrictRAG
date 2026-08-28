'use client';

/**
 * 问答 + 薄会话壳（UI）。
 * 历史仅回放；**不是** citation 证据。rewrite 未开；无连续追问卖点。
 * 流式由 useKnowledgeAsk 驱动；会话编排在 sessions.services。
 */

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  AskModeSchema,
  type AskAuditResponse,
  type AskCitation,
  type AskMode,
  type AskModes,
  type AskResponse,
  type SessionMessage,
  type SessionSummary,
  type SuggestedAction,
} from '@strict-rag/contracts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@strict-rag/ui/components/ui/alert';
import { Badge } from '@strict-rag/ui/components/ui/badge';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Card, CardContent } from '@strict-rag/ui/components/ui/card';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { Select } from '@strict-rag/ui/components/ui/select';
import { Textarea } from '@strict-rag/ui/components/ui/textarea';
import { cn } from '@strict-rag/ui/lib/utils';
import { useRouter } from 'next/navigation';

import { getAskAudit, getAskModes, parseScopeDocTypesInput } from '@/api/ask';
import { createAskFeedback, FEEDBACK_CATEGORY } from '@/api/feedback';
import { listKnowledgeBases } from '@/api/knowledge-bases';
import { logoutLocal } from '@/auth/services';
import { useWebAuth } from '@/components/auth-guard';
import { useKnowledgeAsk } from '@/hooks/use-knowledge-ask';
import {
  createNewSession,
  loadSessionHistory,
  loadSessionList,
  refreshAfterAskFinal,
} from '@/services/sessions.services';

const KB_STORAGE = 'strict-rag:web:last-kb-id';
const KB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ASK_MODE_LABELS: Record<AskMode, string> = {
  strict: '严谨',
  balanced: '均衡',
  fast: '快速',
};

export function AskPanel() {
  const { me } = useWebAuth();
  const router = useRouter();
  const [kbId, setKbId] = useState('');
  const [kbOptions, setKbOptions] = useState<{ id: string; name: string }[]>([]);
  const [kbListStatus, setKbListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [askModes, setAskModes] = useState<AskModes | null>(null);
  const [mode, setMode] = useState<AskMode | ''>('');
  const [modesLoadFailed, setModesLoadFailed] = useState(false);
  const [question, setQuestion] = useState('');
  const [actionHint, setActionHint] = useState<string | null>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const feedbackActionBusy = useRef(false);
  /** B11：可选文档类型（逗号分隔）；空=不收窄 */
  const [docTypesInput, setDocTypesInput] = useState('');
  /** 最近一次成功发起的提问文案；重试用（提交后会清空输入框） */
  const [lastQuestion, setLastQuestion] = useState('');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionMessage[]>([]);
  const [sessionBusy, setSessionBusy] = useState(false);
  /** 会话壳错误（列表/历史）；不覆盖主问答 view */
  const [shellError, setShellError] = useState<string | null>(null);

  const getScope = useCallback(() => {
    const docTypes = parseScopeDocTypesInput(docTypesInput);
    return docTypes ? { docTypes } : undefined;
  }, [docTypesInput]);

  const getMode = useCallback(() => (mode === '' ? undefined : mode), [mode]);

  const { view, setView, lastFinal, ask, reset, busy } = useKnowledgeAsk({
    kbId,
    sessionId: activeSessionId,
    getScope,
    getMode,
  });

  useEffect(() => {
    setKbId(window.localStorage.getItem(KB_STORAGE) ?? '');
    void listKnowledgeBases()
      .then((rows) => {
        setKbOptions(rows.map((r) => ({ id: r.id, name: r.name })));
        setKbListStatus('ready');
      })
      .catch(() => {
        setKbOptions([]);
        setKbListStatus('error');
      });
  }, []);

  useEffect(() => {
    const id = kbId.trim();
    if (!id || !KB_ID_RE.test(id)) {
      setAskModes(null);
      setMode('');
      setModesLoadFailed(false);
      return;
    }
    setAskModes(null);
    setMode('');
    setModesLoadFailed(false);
    let cancelled = false;
    void getAskModes(id)
      .then((m) => {
        if (cancelled) return;
        setAskModes(m);
        setMode(m.defaultMode);
        setModesLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAskModes(null);
        setMode('');
        setModesLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const refreshSessions = useCallback(async (id: string) => {
    const result = await loadSessionList(id);
    if (result.ok) {
      setSessions(result.sessions);
      setShellError(null);
    } else {
      setSessions([]);
      setShellError(result.message);
    }
  }, []);

  useEffect(() => {
    const id = kbId.trim();
    if (!id) {
      setSessions([]);
      setShellError(null);
      return;
    }
    void refreshSessions(id);
  }, [kbId, refreshSessions]);

  // 收到 data-ask-final 后刷新会话回放（非证据）
  useEffect(() => {
    if (!lastFinal) return;
    const id = kbId.trim();
    if (!id) return;
    void (async () => {
      const result = await refreshAfterAskFinal({
        kbId: id,
        finalSessionId: lastFinal.sessionId,
        activeSessionId,
      });
      if (result.sessionId) setActiveSessionId(result.sessionId);
      setHistory(result.history);
      setSessions(result.sessions);
      setShellError(result.error ?? null);
    })();
  }, [lastFinal, kbId, activeSessionId]);

  async function selectSession(sessionId: string) {
    const id = kbId.trim();
    if (!id) return;
    setActiveSessionId(sessionId);
    reset();
    const result = await loadSessionHistory(id, sessionId);
    if (result.ok) {
      setHistory(result.messages);
      setShellError(null);
    } else {
      setHistory([]);
      setShellError(result.message);
    }
  }

  async function onNewSession() {
    const id = kbId.trim();
    if (!id) return;
    setSessionBusy(true);
    const result = await createNewSession(id);
    if (result.ok) {
      await refreshSessions(id);
      setActiveSessionId(result.sessionId);
      setHistory([]);
      reset();
    } else {
      setShellError(result.message);
      setView({
        type: 'error',
        code: 'INTERNAL',
        message: result.message,
      });
    }
    setSessionBusy(false);
  }

  async function submitQuestion(raw: string) {
    const q = raw.trim();
    const id = kbId.trim();
    if (!q || !id || busy) return;
    window.localStorage.setItem(KB_STORAGE, id);
    setLastQuestion(q);
    setQuestion('');
    setActionHint(null);
    await ask(q);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitQuestion(question);
  }

  function onRetry() {
    const q = lastQuestion.trim() || question.trim();
    if (!q || busy) return;
    void submitQuestion(q);
  }

  function onSuggestedAction(action: SuggestedAction, requestId?: string) {
    setActionHint(null);
    if (action.type === 'rephrase' || action.type === 'ask_knowledge') {
      const q = lastQuestion.trim();
      if (action.type === 'rephrase' && q) setQuestion(q);
      questionRef.current?.focus();
      return;
    }
    if (action.type === 'retry_later') {
      onRetry();
      return;
    }
    if (action.type === 'view_citations') {
      document.getElementById('ask-citations')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (action.type === 'feedback_missing_doc' || action.type === 'feedback') {
      if (!requestId || feedbackActionBusy.current) return;
      feedbackActionBusy.current = true;
      void createAskFeedback(requestId, {
        category:
          action.type === 'feedback_missing_doc'
            ? FEEDBACK_CATEGORY.missingDoc
            : FEEDBACK_CATEGORY.wrongAnswer,
      }).then(
        () => setActionHint('已提交反馈'),
        (e: unknown) => setActionHint(e instanceof Error ? e.message : '反馈提交失败'),
      ).finally(() => {
        feedbackActionBusy.current = false;
      });
      return;
    }
    if (action.type === 'contact_admin') {
      setActionHint('请联系本库管理员开通成员或补充资料。');
    }
  }

  const showAskForm = kbListStatus === 'error' || kbOptions.length > 0;

  function onLogout() {
    logoutLocal();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-[220px] shrink-0 flex-col gap-2 border-r border-border bg-card p-3">
        <div className="text-xs font-semibold text-muted-foreground">会话</div>
        {shellError ? (
          <p className="m-0 text-[11px] leading-snug text-destructive">{shellError}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onNewSession()}
          disabled={sessionBusy || !kbId.trim()}
          className="justify-start"
        >
          新建会话
        </Button>
        <button
          type="button"
          onClick={() => {
            setActiveSessionId(null);
            setHistory([]);
            reset();
          }}
          className={sessionBtnClass(activeSessionId === null)}
        >
          单轮（不归属会话）
        </button>
        <ul className="m-0 flex-1 list-none overflow-auto p-0">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <button
                type="button"
                onClick={() => void selectSession(s.sessionId)}
                className={sessionBtnClass(activeSessionId === s.sessionId)}
              >
                {s.title?.trim() || s.sessionId.slice(0, 8)}
              </button>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[11px] leading-snug text-muted-foreground">
          历史仅供回看，不作引用证据。本阶段不改写指代。
        </p>
      </aside>

      <div className="mx-auto max-w-[720px] flex-1 px-5 py-8 pb-16">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-xs tracking-wider text-muted-foreground uppercase">
              StrictRAG · 问答
            </p>
            <h1 className="mt-1.5 mb-0 text-[22px] font-semibold">知识库提问</h1>
            <p className="mt-2 max-w-[480px] text-[13px] text-muted-foreground">
              答案须有证据支撑；无法核验时会拒答。可多会话隔离；每轮仍独立检索验证。
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{me.email ?? me.userId.slice(0, 8)}</div>
            <Button type="button" variant="link" size="sm" className="mt-1.5" onClick={onLogout}>
              退出
            </Button>
          </div>
        </header>

        {history.length > 0 ? (
          <Card className="mb-4 border-dashed">
            <CardContent className="pt-3">
              <h2 className="m-0 text-xs font-semibold text-muted-foreground">
                本会话回放（非证据）
              </h2>
              <ul className="mt-2 mb-0 list-none p-0 text-[13px]">
                {history.map((m, i) => (
                  <li
                    key={`${m.requestId ?? i}-${m.role}-${i}`}
                    className={cn(
                      'mb-2',
                      m.role === 'user' ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <strong className="text-[11px]">{m.role === 'user' ? '问' : '答'}</strong>{' '}
                    {m.content.slice(0, 280)}
                    {m.content.length > 280 ? '…' : ''}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {kbListStatus === 'loading' ? (
          <p className="text-sm text-muted-foreground" role="status">
            正在加载可用知识库…
          </p>
        ) : !showAskForm ? (
          <EmptyKbCard />
        ) : (
          <Card>
            <CardContent className="pt-4">
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ask-kb">知识库 ID</Label>
                  <Input
                    id="ask-kb"
                    list="web-kb-list"
                    value={kbId}
                    onChange={(ev) => {
                      const v = ev.target.value;
                      setKbId(v);
                      window.localStorage.setItem(KB_STORAGE, v.trim());
                    }}
                    placeholder="uuid"
                    required
                  />
                  <datalist id="web-kb-list">
                    {kbOptions.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </datalist>
                </div>
                {askModes ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ask-mode">问答档位</Label>
                    <Select
                      id="ask-mode"
                      value={mode}
                      onChange={(ev) => {
                        const parsed = AskModeSchema.safeParse(ev.target.value);
                        if (parsed.success && askModes.allowedModes.includes(parsed.data)) {
                          setMode(parsed.data);
                        }
                      }}
                    >
                      {askModes.allowedModes.map((m) => (
                        <option key={m} value={m}>
                          {ASK_MODE_LABELS[m]}（{m}）
                        </option>
                      ))}
                    </Select>
                    <p className="m-0 text-[11px] text-muted-foreground">
                      选项来自本库允许档位；客户端不可改阈值或检索预算。
                    </p>
                  </div>
                ) : modesLoadFailed ? (
                  <p className="m-0 text-[11px] text-muted-foreground">
                    未能读取本库档位，提问将使用服务端默认档。
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="ask-doc-types">文档类型（可选）</Label>
                  <Input
                    id="ask-doc-types"
                    value={docTypesInput}
                    onChange={(ev) => setDocTypesInput(ev.target.value)}
                    placeholder="如 hr, legal；空=不按类型收窄"
                    autoComplete="off"
                  />
                  <p className="m-0 text-[11px] text-muted-foreground">
                    多个类型用逗号分隔；仅检索标注了对应类型的文档（ADR-050）。
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ask-q">问题</Label>
                  <Textarea
                    id="ask-q"
                    ref={questionRef}
                    value={question}
                    onChange={(ev) => setQuestion(ev.target.value)}
                    rows={3}
                    required
                    maxLength={8000}
                    placeholder="输入要检索的问题…"
                    className="resize-y"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={view.type === 'loading'}>
                    {view.type === 'loading' ? `处理中（${view.phase ?? '…'}）` : '提问'}
                  </Button>
                  {view.type === 'error' || view.type === 'abstained' ? (
                    <Button type="button" variant="link" onClick={onRetry}>
                      重试
                    </Button>
                  ) : null}
                  {activeSessionId ? (
                    <span className="text-[11px] text-muted-foreground">
                      会话 {activeSessionId.slice(0, 8)}…
                    </span>
                  ) : null}
                </div>
                {kbListStatus === 'error' ? (
                  <p className="m-0 text-xs text-destructive">
                    知识库列表加载失败，可粘贴知识库 ID 继续提问。
                  </p>
                ) : null}
                {actionHint ? (
                  <p className="m-0 text-xs text-muted-foreground">{actionHint}</p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-5">
          {view.type === 'loading' ? (
            <p className="text-sm text-muted-foreground" role="status">
              正在检索与校验…
            </p>
          ) : null}
          {view.type === 'answered' ? (
            <AnsweredCard data={view.data} onSuggestedAction={onSuggestedAction} />
          ) : null}
          {view.type === 'abstained' ? (
            <AbstainedCard data={view.data} onSuggestedAction={onSuggestedAction} />
          ) : null}
          {view.type === 'error' ? (
            <ErrorCard code={view.code} message={view.message} httpStatus={view.httpStatus} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyKbCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="m-0 text-base font-semibold">暂无可用知识库</h2>
        <p className="mt-2 mb-0 text-sm text-muted-foreground">
          你还不是任何知识库的成员，无法提问。请找管理员开通成员。
        </p>
      </CardContent>
    </Card>
  );
}

function sessionBtnClass(active: boolean) {
  return cn(
    'mb-1 block w-full cursor-pointer rounded-md border px-2.5 py-2 text-left text-[13px]',
    active
      ? 'border-primary bg-accent text-foreground'
      : 'border-transparent bg-transparent text-foreground',
  );
}

function FeedbackBar({ requestId }: { requestId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function send(body: { rating?: 'up' | 'down'; category?: string }) {
    setState('sending');
    setMsg(null);
    try {
      await createAskFeedback(requestId, body);
      setState('ok');
      if (body.category === FEEDBACK_CATEGORY.missingDoc) setMsg('已提交：缺文档');
      else if (body.category === FEEDBACK_CATEGORY.wrongAnswer) setMsg('已提交：报错');
      else setMsg(body.rating === 'up' ? '已提交：有帮助' : '已提交：无帮助');
    } catch (e) {
      setState('err');
      setMsg(e instanceof Error ? e.message : '提交失败');
    }
  }

  const disabled = state === 'sending' || state === 'ok';

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">本次回答反馈</span>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void send({ rating: 'up' })}>
        有帮助
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void send({ rating: 'down' })}>
        无帮助
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => void send({ category: FEEDBACK_CATEGORY.wrongAnswer, rating: 'down' })}
      >
        报错
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => void send({ category: FEEDBACK_CATEGORY.missingDoc })}
      >
        缺文档
      </Button>
      {msg ? (
        <span className={cn('text-xs', state === 'err' ? 'text-destructive' : 'text-muted-foreground')}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}

function CitationBlock({
  requestId,
  citations,
}: {
  requestId: string;
  citations: AskCitation[];
}) {
  const panelId = useId();
  const inflight = useRef(false);
  const [audit, setAudit] = useState<AskAuditResponse | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openChunk(chunkId: string) {
    let next: string | null = chunkId;
    setSelectedChunkId((cur) => {
      next = cur === chunkId ? null : chunkId;
      return next;
    });
    setError(null);
    if (!next || audit || inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      setAudit(await getAskAudit(requestId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法加载分片详情');
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }

  const selected = audit?.evidenceSnapshot.find((item) => item.chunkId === selectedChunkId);

  return (
    <div className="mt-4" id="ask-citations">
      <h2 className="m-0 text-[13px] font-semibold text-muted-foreground">
        引用（服务端返回 · 非会话历史）
      </h2>
      <ul className="mt-2 mb-0 list-none pl-0 text-[13px] leading-normal">
        {citations.map((c) => (
          <li key={c.chunkId} className="mb-1.5">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-semibold text-foreground"
              aria-expanded={selectedChunkId === c.chunkId}
              aria-controls={panelId}
              onClick={() => void openChunk(c.chunkId)}
            >
              {c.title ?? c.docId.slice(0, 8)}
            </Button>
            {c.sectionPath ? ` · ${c.sectionPath}` : null}
            {c.preview ? (
              <div className="mt-0.5 text-muted-foreground">{c.preview}</div>
            ) : null}
          </li>
        ))}
      </ul>
      {loading ? (
        <p className="mt-2 mb-0 text-xs text-muted-foreground" role="status">
          正在加载当时快照…
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 mb-0 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {selectedChunkId && !loading && !error ? (
        <div
          id={panelId}
          className="mt-3 rounded-md border border-border bg-card px-3 py-2"
          role="region"
          aria-label="分片详情"
        >
          <h3 className="m-0 text-[13px] font-semibold">分片详情（当时快照）</h3>
          {selected ? (
            <>
              <p className="mt-1.5 mb-0 text-[13px]">{selected.title ?? selected.docId.slice(0, 8)}</p>
              {selected.lifecycle ? (
                <p className="mt-1 mb-0 text-xs text-muted-foreground">
                  生命周期 {selected.lifecycle}
                </p>
              ) : null}
              {selected.preview ? (
                <p className="mt-1.5 mb-0 text-[13px] leading-normal text-muted-foreground">
                  {selected.preview}
                </p>
              ) : null}
              <p className="mt-1.5 mb-0 text-[11px] text-muted-foreground">
                分片 {selected.chunkId.slice(0, 8)} · 文档 {selected.docId.slice(0, 8)}
              </p>
            </>
          ) : (
            <p className="mt-1.5 mb-0 text-xs text-muted-foreground">该引用无当时快照。</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SuggestedActionBar({
  actions,
  requestId,
  onSuggestedAction,
}: {
  actions: SuggestedAction[];
  requestId?: string;
  onSuggestedAction: (action: SuggestedAction, requestId?: string) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {actions.map((a, i) => (
        <Button
          key={`${a.type}-${a.label}`}
          type="button"
          size="sm"
          variant={i === 0 ? 'default' : 'outline'}
          onClick={() => onSuggestedAction(a, requestId)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function AnsweredCard({
  data,
  onSuggestedAction,
}: {
  data: AskResponse;
  onSuggestedAction: (action: SuggestedAction, requestId?: string) => void;
}) {
  const isChitchat = data.answerKind === 'chitchat' || data.reason === 'chitchat';
  return (
    <Alert variant="success">
      <Badge variant="success" className="bg-transparent px-0">
        已回答 · {data.reason}
      </Badge>
      <AlertDescription className="mt-3 whitespace-pre-wrap">
        {data.answer || data.userMessage || '（空答案）'}
      </AlertDescription>
      {!isChitchat && data.citations && data.citations.length > 0 ? (
        <CitationBlock
          key={data.requestId}
          requestId={data.requestId}
          citations={data.citations}
        />
      ) : null}
      {isChitchat ? (
        <p className="mt-3 mb-0 text-xs text-muted-foreground">闲聊路径，无知识库引用。</p>
      ) : null}
      <SuggestedActionBar
        actions={data.suggestedActions ?? []}
        requestId={data.requestId}
        onSuggestedAction={onSuggestedAction}
      />
      {data.latencyMs != null ? (
        <p className="mt-3 mb-0 text-[11px] text-muted-foreground">
          {data.latencyMs} ms · {data.requestId}
        </p>
      ) : null}
      {data.requestId ? (
        <FeedbackBar key={`feedback-${data.requestId}`} requestId={data.requestId} />
      ) : null}
    </Alert>
  );
}

function AbstainedCard({
  data,
  onSuggestedAction,
}: {
  data: AskResponse;
  onSuggestedAction: (action: SuggestedAction, requestId?: string) => void;
}) {
  return (
    <Alert variant="abstain">
      <Badge variant="abstain" className="bg-transparent px-0">
        拒答 · {data.reason}
      </Badge>
      <AlertDescription className="mt-3">
        {data.userMessage || data.answer || '当前无法给出有证据支撑的答案。'}
      </AlertDescription>
      <p className="mt-2 mb-0 text-xs text-muted-foreground">
        这是业务结果，不是系统崩溃。可调整问题表述或补充入库后重试。
      </p>
      <SuggestedActionBar
        actions={data.suggestedActions ?? []}
        requestId={data.requestId}
        onSuggestedAction={onSuggestedAction}
      />
      {data.requestId ? (
        <FeedbackBar key={`feedback-${data.requestId}`} requestId={data.requestId} />
      ) : null}
    </Alert>
  );
}

function ErrorCard({
  code,
  message,
  httpStatus,
}: {
  code: string;
  message: string;
  httpStatus?: number;
}) {
  const isQuota = code === 'RATE_LIMITED' || httpStatus === 429;
  const isForbidden = code === 'FORBIDDEN' || httpStatus === 403;
  const isAuth = code === 'UNAUTHORIZED' || httpStatus === 401;
  const title = isQuota
    ? '提问次数已达上限'
    : isForbidden
      ? '无权限访问该知识库'
      : isAuth
        ? '登录已失效'
        : '请求失败';
  return (
    <Alert variant="destructive">
      <AlertTitle className="text-destructive">
        {isQuota ? '配额已用尽' : '系统错误'} · {code}
        {httpStatus != null ? ` · HTTP ${httpStatus}` : ''}
      </AlertTitle>
      <p className="mt-3 mb-0 text-[15px] font-semibold">{title}</p>
      <AlertDescription className="mt-1.5 text-[13px] text-muted-foreground">
        {isQuota
          ? `当前提问配额已用尽，请稍后再试。${message}`
          : message}
      </AlertDescription>
    </Alert>
  );
}
