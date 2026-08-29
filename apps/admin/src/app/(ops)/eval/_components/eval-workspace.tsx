'use client';

/**
 * 评测底线薄页：维护黄金集、入队跑批、看 2×2。
 * 无 eval.run 码 → 提示；API 仍 403。
 * 不是签字包 / 看板增强 / 反馈回流黄金集。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { EvalRun, GoldQuestion } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId } from '@/lib/kb-context';

import {
  addGoldQuestion,
  loadEvalBoard,
  loadEvalRunDetail,
  removeGoldQuestion,
  startEvalRun,
} from '../services';

const GOLD_TYPES = [
  { value: 'answerable', label: '可答' },
  { value: 'unanswerable', label: '不可答' },
  { value: 'false_premise', label: '假前提' },
] as const;

function coverageLabel(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v * 1000) / 10}%`;
}

export function EvalWorkspace() {
  const { me } = useAdminAuth();
  const canRun = me.permissions.includes('eval.run');

  const [questions, setQuestions] = useState<GoldQuestion[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<EvalRun | null>(null);

  const [caseKey, setCaseKey] = useState('');
  const [question, setQuestion] = useState('');
  const [goldType, setGoldType] = useState<(typeof GOLD_TYPES)[number]['value']>('answerable');
  const [expectedDocIds, setExpectedDocIds] = useState('');

  const load = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setQuestions([]);
      setRuns([]);
      setState('idle');
      setError(null);
      return;
    }
    if (!canRun) {
      setState('error');
      setError('无 eval.run 权限（API 将 403）');
      return;
    }
    setState('loading');
    setError(null);
    const result = await loadEvalBoard(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setQuestions(result.questions);
    setRuns(result.runs);
    setState('ready');
  }, [canRun]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!kbId) return;
    setBusy(true);
    setFlash(null);
    const docs = expectedDocIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const r = await addGoldQuestion(kbId, {
      caseKey: caseKey.trim(),
      question: question.trim(),
      type: goldType,
      expectedDocIds: docs.length > 0 ? docs : undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setFlash(r.message);
      return;
    }
    setCaseKey('');
    setQuestion('');
    setExpectedDocIds('');
    setFlash('已添加题目');
    await load();
  }

  async function onDelete(id: string) {
    if (!kbId) return;
    setBusy(true);
    setFlash(null);
    const r = await removeGoldQuestion(kbId, id);
    setBusy(false);
    if (!r.ok) {
      setFlash(r.message);
      return;
    }
    setFlash('已删除题目');
    await load();
  }

  async function onRun() {
    if (!kbId) return;
    setBusy(true);
    setFlash(null);
    const r = await startEvalRun(kbId);
    setBusy(false);
    if (!r.ok) {
      setFlash(r.message);
      return;
    }
    setFlash(`已入队 ${r.queued.runId.slice(0, 8)}…`);
    await load();
  }

  async function onOpenRun(run: EvalRun) {
    if (!kbId) return;
    const r = await loadEvalRunDetail(kbId, run.runId);
    if (!r.ok) {
      setFlash(r.message);
      return;
    }
    setDetail(r.run);
  }

  if (!canRun) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">评测</h1>
        <p className="mt-2 text-sm text-muted-foreground">403 · 无 eval.run 权限</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="m-0 text-lg font-semibold">评测</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          KB：{kbId || '（顶部填写）'} · 维护黄金集并入队 L1 跑批。不是签字包，mock 数字不能当 PASS。
        </p>
      </header>

      {flash ? <p className="text-sm text-muted-foreground">{flash}</p> : null}
      {state === 'loading' ? <p className="text-sm">加载中…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {state === 'idle' && !kbId ? (
        <p className="text-sm text-muted-foreground">请先在顶部填写知识库。</p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-medium">黄金集</h2>
          <Button type="button" size="sm" disabled={busy || !kbId || questions.length === 0} onClick={() => void onRun()}>
            跑一批
          </Button>
        </div>

        <form className="space-y-3 rounded-md border border-border p-3" onSubmit={(e) => void onAdd(e)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="eval-case-key">题号</Label>
              <Input
                id="eval-case-key"
                value={caseKey}
                onChange={(e) => setCaseKey(e.target.value)}
                required
                maxLength={128}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eval-type">类型</Label>
              <select
                id="eval-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={goldType}
                onChange={(e) =>
                  setGoldType(e.target.value as (typeof GOLD_TYPES)[number]['value'])
                }
              >
                {GOLD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="eval-question">题面</Label>
            <Input
              id="eval-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eval-docs">期望文档 id（逗号分隔，可选）</Label>
            <Input
              id="eval-docs"
              value={expectedDocIds}
              onChange={(e) => setExpectedDocIds(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={busy || !kbId}>
            添加题目
          </Button>
        </form>

        {state === 'ready' && questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无题目。添加后才能入队。</p>
        ) : null}

        <ul className="m-0 list-none space-y-2 p-0">
          {questions.map((q) => (
            <li key={q.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-mono text-xs">{q.caseKey}</strong>
                <span className="text-xs text-muted-foreground">{q.type}</span>
              </div>
              <p className="mt-1 mb-0">{q.question}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={busy}
                onClick={() => void onDelete(q.id)}
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="m-0 text-base font-medium">跑批结果</h2>
        {state === 'ready' && runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有 run。</p>
        ) : null}
        <ul className="m-0 list-none space-y-2 p-0">
          {runs.map((run) => (
            <li key={run.runId} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">{run.runId.slice(0, 8)}…</span>
                <span className="text-xs text-muted-foreground">
                  {run.status} · {run.retrieveMode}
                </span>
              </div>
              <p className="mt-1 mb-0 text-muted-foreground">
                A{run.matrix.A} B{run.matrix.B} C{run.matrix.C} D{run.matrix.D} · 覆盖
                {coverageLabel(run.coverage)} · {run.caseCount} 题
                {run.signoffEligible ? ' · 工程可签字（仍须人签）' : ''}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => void onOpenRun(run)}
              >
                查看
              </Button>
            </li>
          ))}
        </ul>

        {detail ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="m-0 font-medium">明细 {detail.runId.slice(0, 8)}…</p>
            {detail.errorMessage ? (
              <p className="mt-1 text-destructive">{detail.errorMessage}</p>
            ) : null}
            <ul className="mt-2 space-y-1">
              {(detail.cases ?? []).map((row) => (
                <li key={row.id}>
                  <span className="font-mono text-xs">{row.id}</span> · {row.type} · {row.outcome}
                  {row.cell ? ` · ${row.cell}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
