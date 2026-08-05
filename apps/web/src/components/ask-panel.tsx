'use client';

/**
 * 最小问答：KB id + 问题 → SSE final。
 * 三态：answered / abstained / 系统错误（HTTP 4xx/5xx）。
 * 不把会话历史当 citation；不推连续追问卖点。
 */

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { AskResponse } from '@strict-rag/contracts';
import { useRouter } from 'next/navigation';

import { webLogoutLocal } from '@/auth/api';
import { useWebAuth } from '@/components/auth-guard';
import { askKnowledgeBase, type AskSseStatus } from '@/lib/ask-sse';

type ViewState =
  | { type: 'idle' }
  | { type: 'loading'; phase?: string }
  | { type: 'answered'; data: AskResponse }
  | { type: 'abstained'; data: AskResponse }
  | { type: 'error'; code: string; message: string; httpStatus?: number };

const KB_STORAGE = 'strict-rag:web:last-kb-id';

export function AskPanel() {
  const { me } = useWebAuth();
  const router = useRouter();
  const [kbId, setKbId] = useState('');
  const [question, setQuestion] = useState('');
  const [view, setView] = useState<ViewState>({ type: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // ponytail: 客户端再读 localStorage，避免 SSR hydration 不一致
  useEffect(() => {
    setKbId(window.localStorage.getItem(KB_STORAGE) ?? '');
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    const id = kbId.trim();
    if (!q || !id) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    window.localStorage.setItem(KB_STORAGE, id);
    setView({ type: 'loading', phase: 'running' });

    try {
      const result = await askKnowledgeBase(
        id,
        { question: q },
        {
          signal: ac.signal,
          onStatus: (s: AskSseStatus) => {
            setView({ type: 'loading', phase: s.phase });
          },
        },
      );

      if (result.kind === 'http_error') {
        setView({
          type: 'error',
          code: result.code,
          message: result.message,
          httpStatus: result.status,
        });
        return;
      }

      const data = result.response;
      if (data.status === 'answered') {
        setView({ type: 'answered', data });
      } else {
        setView({ type: 'abstained', data });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setView({
        type: 'error',
        code: 'INTERNAL',
        message: err instanceof Error ? err.message : '请求失败',
      });
    }
  }

  function onRetry() {
    void onSubmit({ preventDefault() {} } as FormEvent);
  }

  function onLogout() {
    webLogoutLocal();
    router.replace('/login');
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '32px 20px 64px',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--sr-foreground)',
      }}
    >
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
            答案须有证据支撑；无法核验时会拒答并说明原因。单轮提问，不依赖未校验的流式草稿。
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--sr-muted)' }}>
          <div>{me.email ?? me.userId.slice(0, 8)}</div>
          <button
            type="button"
            onClick={onLogout}
            style={{
              marginTop: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--sr-primary)',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            退出
          </button>
        </div>
      </header>

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        </div>
      </form>

      <div style={{ marginTop: 20 }}>
        {view.type === 'loading' ? (
          <p style={{ color: 'var(--sr-muted)', fontSize: 14 }}>正在检索与校验…</p>
        ) : null}
        {view.type === 'answered' ? <AnsweredCard data={view.data} /> : null}
        {view.type === 'abstained' ? <AbstainedCard data={view.data} /> : null}
        {view.type === 'error' ? (
          <ErrorCard code={view.code} message={view.message} httpStatus={view.httpStatus} />
        ) : null}
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
            引用（服务端返回）
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
      {data.requestId ? (
        <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--sr-muted)' }}>
          {data.requestId}
        </p>
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
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--sr-muted)' }}>
        与「拒答」不同：这是鉴权/网络/服务端异常，不是「证据不足故不答」。
      </p>
    </section>
  );
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
  fontSize: 13,
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
