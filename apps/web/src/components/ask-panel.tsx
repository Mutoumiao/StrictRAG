'use client';

/**
 * 问答 + 薄会话壳（UI）。
 * 历史仅回放；**不是** citation 证据。rewrite 未开；无连续追问卖点。
 * 流式由 useKnowledgeAsk 驱动；会话编排在 sessions.services。
 */

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { AskResponse, SessionMessage, SessionSummary } from '@strict-rag/contracts';
import { useRouter } from 'next/navigation';

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
  /** 最近一次成功发起的提问文案；重试用（提交后会清空输入框） */
  const [lastQuestion, setLastQuestion] = useState('');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<SessionMessage[]>([]);
  const [sessionBusy, setSessionBusy] = useState(false);
  /** 会话壳错误（列表/历史）；不覆盖主问答 view */
  const [shellError, setShellError] = useState<string | null>(null);

  const { view, setView, lastFinal, ask, reset, busy } = useKnowledgeAsk({
    kbId,
    sessionId: activeSessionId,
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
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--sr-foreground)',
        background: 'var(--sr-background)',
      }}
    >
      {/* 左栏：会话列表（回放壳，非证据源） */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid var(--sr-border)',
          padding: 12,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sr-muted)' }}>会话</div>
        {shellError ? (
          <p style={{ margin: 0, fontSize: 11, color: '#b91c1c', lineHeight: 1.4 }}>{shellError}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void onNewSession()}
          disabled={sessionBusy || !kbId.trim()}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--sr-border)',
            background: 'var(--sr-background)',
            cursor: sessionBusy ? 'wait' : 'pointer',
            fontSize: 13,
          }}
        >
          新建会话
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSessionId(null);
            setHistory([]);
            reset();
          }}
          style={{
            ...sessionBtnStyle(activeSessionId === null),
            fontSize: 12,
          }}
        >
          单轮（不归属会话）
        </button>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflow: 'auto', flex: 1 }}>
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <button
                type="button"
                onClick={() => void selectSession(s.sessionId)}
                style={sessionBtnStyle(activeSessionId === s.sessionId)}
              >
                {s.title?.trim() || s.sessionId.slice(0, 8)}
              </button>
            </li>
          ))}
        </ul>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--sr-muted)', lineHeight: 1.4 }}>
          历史仅供回看，不作引用证据。本阶段不改写指代。
        </p>
      </aside>

      <div style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--sr-muted)',
              }}
            >
              StrictRAG · 问答
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 600 }}>知识库提问</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--sr-muted)', maxWidth: 480 }}>
              答案须有证据支撑；无法核验时会拒答。可多会话隔离；每轮仍独立检索验证。
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--sr-muted)' }}>
            <div>{me.email ?? me.userId.slice(0, 8)}</div>
            <button type="button" onClick={onLogout} style={linkBtnStyle}>
              退出
            </button>
          </div>
        </header>

        {history.length > 0 ? (
          <section
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 'var(--sr-radius)',
              border: '1px dashed var(--sr-border)',
              background: '#fff',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 12, color: 'var(--sr-muted)', fontWeight: 600 }}>
              本会话回放（非证据）
            </h2>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: 13 }}>
              {history.map((m, i) => (
                <li
                  key={`${m.requestId ?? i}-${m.role}-${i}`}
                  style={{
                    marginBottom: 8,
                    color: m.role === 'user' ? 'var(--sr-foreground)' : 'var(--sr-muted)',
                  }}
                >
                  <strong style={{ fontSize: 11 }}>{m.role === 'user' ? '问' : '答'}</strong>{' '}
                  {m.content.slice(0, 280)}
                  {m.content.length > 280 ? '…' : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form
          onSubmit={onSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            border: '1px solid var(--sr-border)',
            borderRadius: 'var(--sr-radius)',
            background: '#fff',
          }}
        >
          <label style={{ fontSize: 13 }}>
            知识库 ID
            <input
              value={kbId}
              onChange={(ev) => setKbId(ev.target.value)}
              placeholder="uuid"
              required
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            问题
            <textarea
              value={question}
              onChange={(ev) => setQuestion(ev.target.value)}
              rows={3}
              required
              maxLength={8000}
              placeholder="输入要检索的问题…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={view.type === 'loading'}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--sr-foreground)',
                color: '#fff',
                fontSize: 14,
                cursor: view.type === 'loading' ? 'wait' : 'pointer',
                opacity: view.type === 'loading' ? 0.6 : 1,
              }}
            >
              {view.type === 'loading' ? `处理中（${view.phase ?? '…'}）` : '提问'}
            </button>
            {view.type === 'error' || view.type === 'abstained' ? (
              <button type="button" onClick={onRetry} style={linkBtnStyle}>
                重试
              </button>
            ) : null}
            {activeSessionId ? (
              <span style={{ fontSize: 11, color: 'var(--sr-muted)' }}>
                会话 {activeSessionId.slice(0, 8)}…
              </span>
            ) : null}
          </div>
        </form>

        <div style={{ marginTop: 20 }}>
          {view.type === 'loading' ? (
            <p style={{ color: 'var(--sr-muted)', fontSize: 14 }}>正在检索与校验…</p>
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

function AnsweredCard({ data }: { data: AskResponse }) {
  const isChitchat = data.answerKind === 'chitchat' || data.reason === 'chitchat';
  return (
    <section style={cardStyle('#ecfdf5', '#059669')}>
      <div style={badgeStyle('#059669')}>已回答 · {data.reason}</div>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {data.answer || data.userMessage || '（空答案）'}
      </p>
      {!isChitchat && data.citations && data.citations.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ margin: 0, fontSize: 13, color: 'var(--sr-muted)', fontWeight: 600 }}>
            引用（服务端返回 · 非会话历史）
          </h2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {data.citations.map((c) => (
              <li key={c.chunkId} style={{ marginBottom: 6 }}>
                <strong>{c.title ?? c.docId.slice(0, 8)}</strong>
                {c.sectionPath ? ` · ${c.sectionPath}` : null}
                {c.preview ? (
                  <div style={{ color: 'var(--sr-muted)', marginTop: 2 }}>{c.preview}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {isChitchat ? (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--sr-muted)' }}>
          闲聊路径，无知识库引用。
        </p>
      ) : null}
      {data.latencyMs != null ? (
        <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--sr-muted)' }}>
          {data.latencyMs} ms · {data.requestId}
        </p>
      ) : null}
    </section>
  );
}

function AbstainedCard({ data }: { data: AskResponse }) {
  return (
    <section style={cardStyle('#f5f3ff', 'var(--sr-abstain)')}>
      <div style={badgeStyle('var(--sr-abstain)')}>拒答 · {data.reason}</div>
      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6 }}>
        {data.userMessage || data.answer || '当前无法给出有证据支撑的答案。'}
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--sr-muted)' }}>
        这是业务结果，不是系统崩溃。可调整问题表述或补充入库后重试。
      </p>
      {data.suggestedActions && data.suggestedActions.length > 0 ? (
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {data.suggestedActions.map((a) => (
            <li key={`${a.type}-${a.label}`}>{a.label}</li>
          ))}
        </ul>
      ) : null}
    </section>
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
    <section style={cardStyle('#fef2f2', '#b91c1c')}>
      <div style={badgeStyle('#b91c1c')}>
        系统错误 · {code}
        {httpStatus != null ? ` · HTTP ${httpStatus}` : ''}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 15, fontWeight: 600 }}>{title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--sr-muted)' }}>{message}</p>
    </section>
  );
}

function sessionBtnStyle(active: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    marginBottom: 4,
    borderRadius: 8,
    border: active ? '1px solid var(--sr-primary)' : '1px solid transparent',
    background: active ? '#eff6ff' : 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--sr-foreground)',
  };
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--sr-border)',
  fontSize: 14,
  fontFamily: 'inherit',
};

const linkBtnStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--sr-primary)',
  cursor: 'pointer',
  fontSize: 12,
  marginTop: 6,
  padding: 0,
};

function cardStyle(bg: string, border: string): CSSProperties {
  return {
    padding: 16,
    borderRadius: 'var(--sr-radius)',
    border: `1px solid ${border}`,
    background: bg,
  };
}

function badgeStyle(color: string): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    color,
    letterSpacing: '0.02em',
  };
}
