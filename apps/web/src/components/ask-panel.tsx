'use client';

/**
 * 问答 + 薄会话壳（UI）。
 * 历史仅回放；**不是** citation 证据。rewrite 未开；无连续追问卖点。
 * 流式由 useKnowledgeAsk 驱动；会话编排在 sessions.services。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AskResponse, SessionMessage, SessionSummary } from '@strict-rag/contracts';
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
import { Textarea } from '@strict-rag/ui/components/ui/textarea';
import { cn } from '@strict-rag/ui/lib/utils';
import { useRouter } from 'next/navigation';

import { parseScopeDocTypesInput } from '@/api/ask';
import { createAskFeedback } from '@/api/feedback';
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

export function AskPanel() {
  const { me } = useWebAuth();
  const router = useRouter();
  const [kbId, setKbId] = useState('');
  const [question, setQuestion] = useState('');
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

  const { view, setView, lastFinal, ask, reset, busy } = useKnowledgeAsk({
    kbId,
    sessionId: activeSessionId,
    getScope,
  });

  useEffect(() => {
    setKbId(window.localStorage.getItem(KB_STORAGE) ?? '');
  }, []);

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

        <Card>
          <CardContent className="pt-4">
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ask-kb">知识库 ID</Label>
                <Input
                  id="ask-kb"
                  value={kbId}
                  onChange={(ev) => setKbId(ev.target.value)}
                  placeholder="uuid"
                  required
                />
              </div>
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
            </form>
          </CardContent>
        </Card>

        <div className="mt-5">
          {view.type === 'loading' ? (
            <p className="text-sm text-muted-foreground">正在检索与校验…</p>
          ) : null}
          {view.type === 'answered' ? <AnsweredCard data={view.data} /> : null}
          {view.type === 'abstained' ? <AbstainedCard data={view.data} /> : null}
          {view.type === 'error' ? (
            <ErrorCard code={view.code} message={view.message} />
          ) : null}
        </div>
      </div>
    </div>
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

  async function send(rating: 'up' | 'down') {
    setState('sending');
    setMsg(null);
    try {
      await createAskFeedback(requestId, { rating });
      setState('ok');
      setMsg(rating === 'up' ? '已提交：有帮助' : '已提交：无帮助');
    } catch (e) {
      setState('err');
      setMsg(e instanceof Error ? e.message : '提交失败');
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">本次回答反馈</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={state === 'sending' || state === 'ok'}
        onClick={() => void send('up')}
      >
        有帮助
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={state === 'sending' || state === 'ok'}
        onClick={() => void send('down')}
      >
        无帮助
      </Button>
      {msg ? (
        <span className={cn('text-xs', state === 'err' ? 'text-destructive' : 'text-muted-foreground')}>
          {msg}
        </span>
      ) : null}
    </div>
  );
}

function AnsweredCard({ data }: { data: AskResponse }) {
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
        <div className="mt-4">
          <h2 className="m-0 text-[13px] font-semibold text-muted-foreground">
            引用（服务端返回 · 非会话历史）
          </h2>
          <ul className="mt-2 mb-0 list-disc pl-[18px] text-[13px] leading-normal">
            {data.citations.map((c) => (
              <li key={c.chunkId} className="mb-1.5">
                <strong>{c.title ?? c.docId.slice(0, 8)}</strong>
                {c.sectionPath ? ` · ${c.sectionPath}` : null}
                {c.preview ? (
                  <div className="mt-0.5 text-muted-foreground">{c.preview}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {isChitchat ? (
        <p className="mt-3 mb-0 text-xs text-muted-foreground">闲聊路径，无知识库引用。</p>
      ) : null}
      {data.latencyMs != null ? (
        <p className="mt-3 mb-0 text-[11px] text-muted-foreground">
          {data.latencyMs} ms · {data.requestId}
        </p>
      ) : null}
      {data.requestId ? <FeedbackBar requestId={data.requestId} /> : null}
    </Alert>
  );
}

function AbstainedCard({ data }: { data: AskResponse }) {
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
      {data.requestId ? <FeedbackBar requestId={data.requestId} /> : null}
      {data.suggestedActions && data.suggestedActions.length > 0 ? (
        <ul className="mt-3 mb-0 list-disc pl-[18px] text-[13px]">
          {data.suggestedActions.map((a) => (
            <li key={`${a.type}-${a.label}`}>{a.label}</li>
          ))}
        </ul>
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
  const isForbidden = code === 'FORBIDDEN' || httpStatus === 403;
  const isAuth = code === 'UNAUTHORIZED' || httpStatus === 401;
  const title = isForbidden
    ? '无权限访问该知识库'
    : isAuth
      ? '登录已失效'
      : '请求失败';
  return (
    <Alert variant="destructive">
      <AlertTitle className="text-destructive">
        系统错误 · {code}
        {httpStatus != null ? ` · HTTP ${httpStatus}` : ''}
      </AlertTitle>
      <p className="mt-3 mb-0 text-[15px] font-semibold">{title}</p>
      <AlertDescription className="mt-1.5 text-[13px] text-muted-foreground">
        {message}
      </AlertDescription>
    </Alert>
  );
}
