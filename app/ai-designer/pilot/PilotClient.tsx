'use client';

/**
 * 품질 파일럿 화면 — 프롬프트 30건 × 제공자 × 후보 n장을 만들고 디자이너가 3등급으로 평가한다.
 * 지표: 사용 가능률(그대로+보정), 폐기율, 자수 기준 플래그율, 평균 보정 시간, 추정 비용.
 * 통과 기준: 사용 가능 ≥ 70%, 폐기 ≤ 10%, 보정 시간 ≤ 10분/건 (평가 20장 이상일 때 판정).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';

type Grade = 'keep' | 'fix' | 'reject';
interface Verdict { grade: 'ok' | 'review'; labels: string[] }
interface Candidate { index: number; url: string; svgUrl?: string | null; quality?: { dtf: Verdict; embroidery: Verdict; metrics?: { colorCount?: number; minStrokeMm?: number | null } } | null }
interface Rating { index: number; grade: Grade | null; minutes?: number | null; note?: string | null }
interface Row {
  id: string; pilot_run: string; pilot_prompt_id: string; purpose: string; provider: string; model: string;
  request_text: string; candidate_count: number; candidates: Candidate[]; cost_usd: number; status: string;
  ratings: Rating[] | null; created_at: string;
}
interface PromptSpec { id: string; purpose: string; request: string; text?: string; colorCount: number }
interface ProviderInfo { id: string; model: string }

const GRADE_LABELS: Record<Grade, string> = { keep: '그대로', fix: '보정', reject: '폐기' };
const PURPOSE_LABELS: Record<string, string> = { emblem: '엠블럼', mascot: '마스코트', wordmark: '워드마크' };
const PASS = { usable: 0.7, reject: 0.1, minutes: 10, minRated: 20 };

function todayRun() {
  const d = new Date();
  return `pilot-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default function PilotClient({ tokenRequired }: { tokenRequired: boolean }) {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const [run, setRun] = useState(todayRun());
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [prompts, setPrompts] = useState<PromptSpec[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Array<{ run: string; rows: number; providers: string[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<{ done: number; total: number; current: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purposeFilter, setPurposeFilter] = useState<string>('all');

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', ...(token ? { 'x-pilot-token': token } : {}) }), [token]);

  const load = useCallback(async (runName: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ai-designer/pilot?run=${encodeURIComponent(runName)}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '불러오기 실패');
      setProviders(data.providers ?? []);
      setPrompts(data.prompts ?? []);
      setRuns(data.runs ?? []);
      setRows(data.rows ?? []);
      setSelected((prev) => (prev.length ? prev : (data.providers ?? []).map((p: ProviderInfo) => p.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // 첫 로드는 마운트 시 1회(런 입력값 변경으로 재로드하지 않는다 — "불러오기" 버튼으로만)
  const [initialRun] = useState(todayRun);
  useEffect(() => {
    const id = window.setTimeout(() => { void load(initialRun); }, 0);
    return () => window.clearTimeout(id);
  }, [load, initialRun]);

  const rowFor = (promptId: string, provider: string) => rows.find((r) => r.pilot_prompt_id === promptId && r.provider === provider);

  const generateOne = async (promptId: string, provider: string) => {
    const res = await fetch('/api/ai-designer/pilot', { method: 'POST', headers, body: JSON.stringify({ run, promptId, provider }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '생성 실패');
    setRows((prev) => [...prev.filter((r) => !(r.pilot_prompt_id === promptId && r.provider === provider)), data.row]);
  };

  const runAll = async () => {
    const todo: Array<[string, string]> = [];
    for (const p of prompts) {
      if (purposeFilter !== 'all' && p.purpose !== purposeFilter) continue;
      for (const prov of selected) if (!rowFor(p.id, prov)) todo.push([p.id, prov]);
    }
    if (todo.length === 0) return;
    setRunning({ done: 0, total: todo.length, current: '' });
    setError(null);
    for (let i = 0; i < todo.length; i++) {
      const [pid, prov] = todo[i];
      setRunning({ done: i, total: todo.length, current: `${pid} × ${prov}` });
      try { await generateOne(pid, prov); } catch (e) { setError(e instanceof Error ? e.message : '생성 실패'); }
    }
    setRunning(null);
  };

  const rate = async (row: Row, index: number, patch: Partial<Rating>) => {
    const current = row.ratings ?? [];
    const existing = current.find((r) => r.index === index) ?? { index, grade: null };
    const next = [...current.filter((r) => r.index !== index), { ...existing, ...patch }];
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ratings: next } : r)));
    await fetch('/api/ai-designer/pilot', { method: 'PATCH', headers, body: JSON.stringify({ id: row.id, ratings: next }) }).catch(() => {});
  };

  const summary = useMemo(() => {
    return selected.map((prov) => {
      const rs = rows.filter((r) => r.provider === prov);
      let candidates = 0, rated = 0, keep = 0, fix = 0, reject = 0, flagged = 0, minutesSum = 0, minutesN = 0, cost = 0;
      for (const r of rs) {
        cost += Number(r.cost_usd) || 0;
        for (const c of r.candidates ?? []) {
          candidates++;
          if (c.quality?.embroidery?.grade === 'review') flagged++;
          const rt = (r.ratings ?? []).find((x) => x.index === c.index);
          if (rt?.grade) {
            rated++;
            if (rt.grade === 'keep') keep++; else if (rt.grade === 'fix') fix++; else reject++;
          }
          if (rt?.minutes != null && rt.minutes > 0) { minutesSum += rt.minutes; minutesN++; }
        }
      }
      const usable = rated ? (keep + fix) / rated : 0;
      const rejectRate = rated ? reject / rated : 0;
      const avgMinutes = minutesN ? minutesSum / minutesN : null;
      const verdict = rated < PASS.minRated ? '평가 부족' : usable >= PASS.usable && rejectRate <= PASS.reject && (avgMinutes === null || avgMinutes <= PASS.minutes) ? '통과' : '미달';
      return { prov, rows: rs.length, candidates, rated, keep, fix, reject, usable, rejectRate, flagged: candidates ? flagged / candidates : 0, avgMinutes, cost, verdict };
    });
  }, [rows, selected]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ run, summary, rows }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${run}.json`;
    a.click();
  };

  const visiblePrompts = prompts.filter((p) => purposeFilter === 'all' || p.purpose === purposeFilter);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <h1 className="text-xl font-black">AI 디자이너 품질 파일럿</h1>
        <p className="text-sm text-gray-500 mt-1">
          프롬프트 30건 × 제공자 × 후보를 만들고, 디자이너가 후보마다 그대로/보정/폐기를 고릅니다. 통과 기준: 사용 가능 70% 이상 · 폐기 10% 이하 · 보정 10분/건 이하.
          {tokenRequired && !token && <span className="text-red-500"> URL에 ?token= 이 필요합니다.</span>}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl p-3">
          <label className="text-xs font-semibold text-gray-600">런</label>
          <input value={run} onChange={(e) => setRun(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm w-44" />
          <button type="button" onClick={() => load(run)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold">불러오기</button>
          {runs.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) { setRun(e.target.value); void load(e.target.value); } }} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm">
              <option value="">이전 런…</option>
              {runs.map((r) => <option key={r.run} value={r.run}>{r.run} ({r.rows}행 · {r.providers.join(',')})</option>)}
            </select>
          )}
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-xs font-semibold text-gray-600">제공자</span>
          {providers.length === 0 && <span className="text-xs text-gray-400">사용 가능한 제공자 없음 (키 또는 mock 설정 필요)</span>}
          {providers.map((p) => (
            <label key={p.id} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} />
              {p.id} <span className="text-gray-400 text-xs">({p.model})</span>
            </label>
          ))}
          <span className="mx-2 text-gray-300">|</span>
          <select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm">
            <option value="all">전체 용도</option>
            <option value="emblem">엠블럼</option>
            <option value="mascot">마스코트</option>
            <option value="wordmark">워드마크</option>
          </select>
          <button type="button" onClick={runAll} disabled={!!running || selected.length === 0} className="ml-auto px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40" data-testid="pilot-run-all">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? `${running.done}/${running.total} ${running.current}` : '빠진 항목 전체 생성'}
          </button>
          <button type="button" onClick={exportJson} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold">JSON 내보내기</button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        {/* 요약 */}
        <div className="mt-4 overflow-x-auto bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['제공자', '행', '후보', '평가', '그대로', '보정', '폐기', '사용 가능', '폐기율', '자수 플래그', '평균 보정(분)', '비용(USD)', '판정'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.prov} className="border-t border-gray-100" data-testid="pilot-summary-row">
                  <td className="px-3 py-2 font-semibold">{s.prov}</td>
                  <td className="px-3 py-2">{s.rows}</td>
                  <td className="px-3 py-2">{s.candidates}</td>
                  <td className="px-3 py-2">{s.rated}</td>
                  <td className="px-3 py-2">{s.keep}</td>
                  <td className="px-3 py-2">{s.fix}</td>
                  <td className="px-3 py-2">{s.reject}</td>
                  <td className="px-3 py-2">{Math.round(s.usable * 100)}%</td>
                  <td className="px-3 py-2">{Math.round(s.rejectRate * 100)}%</td>
                  <td className="px-3 py-2">{Math.round(s.flagged * 100)}%</td>
                  <td className="px-3 py-2">{s.avgMinutes === null ? '-' : s.avgMinutes.toFixed(1)}</td>
                  <td className="px-3 py-2">${s.cost.toFixed(2)}</td>
                  <td className={`px-3 py-2 font-semibold ${s.verdict === '통과' ? 'text-emerald-600' : s.verdict === '미달' ? 'text-red-500' : 'text-gray-400'}`}>{s.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 프롬프트 × 제공자 */}
        <div className="mt-4 overflow-x-auto bg-white border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-64">프롬프트</th>
                {selected.map((p) => <th key={p} className="px-3 py-2 text-left font-medium">{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td className="px-3 py-6 text-gray-400" colSpan={1 + selected.length}>불러오는 중…</td></tr>}
              {!loading && visiblePrompts.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 align-top" data-testid="pilot-prompt-row">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{p.id} <span className="text-xs text-gray-400">{PURPOSE_LABELS[p.purpose] ?? p.purpose} · {p.colorCount}색</span></div>
                    {p.text && <div className="text-xs text-brand font-semibold">“{p.text}”</div>}
                    <div className="text-xs text-gray-600">{p.request}</div>
                  </td>
                  {selected.map((prov) => {
                    const row = rowFor(p.id, prov);
                    return (
                      <td key={prov} className="px-3 py-2">
                        {!row ? (
                          <button type="button" disabled={!!running} onClick={() => generateOne(p.id, prov).catch((e) => setError(e.message))} className="px-2 py-1 rounded border border-gray-300 text-xs font-semibold disabled:opacity-40">생성</button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(row.candidates ?? []).map((c) => {
                              const rt = (row.ratings ?? []).find((x) => x.index === c.index);
                              const emb = c.quality?.embroidery;
                              return (
                                <div key={c.index} className="w-28" data-testid="pilot-candidate">
                                  <a href={c.svgUrl ?? c.url} target="_blank" rel="noreferrer" className="block relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={c.url} alt="" className="w-28 h-28 object-contain bg-white border border-gray-200 rounded" />
                                    {emb && (
                                      <span className={`absolute top-1 left-1 text-[9px] px-1 rounded text-white ${emb.grade === 'ok' ? 'bg-emerald-600' : 'bg-amber-500'}`} title={emb.labels.join(' / ')}>
                                        {emb.grade === 'ok' ? '자수 OK' : '보정'}
                                      </span>
                                    )}
                                  </a>
                                  <div className="flex gap-0.5 mt-1">
                                    {(['keep', 'fix', 'reject'] as Grade[]).map((g) => (
                                      <button
                                        key={g}
                                        type="button"
                                        onClick={() => rate(row, c.index, { grade: g })}
                                        className={`flex-1 text-[10px] py-0.5 rounded border ${rt?.grade === g ? (g === 'reject' ? 'bg-red-500 text-white border-red-500' : g === 'fix' ? 'bg-amber-500 text-white border-amber-500' : 'bg-emerald-600 text-white border-emerald-600') : 'border-gray-200 text-gray-600'}`}
                                        data-testid={`pilot-rate-${g}`}
                                      >
                                        {GRADE_LABELS[g]}
                                      </button>
                                    ))}
                                  </div>
                                  {rt?.grade === 'fix' && (
                                    <input
                                      type="number" min={0} max={120} placeholder="보정 분"
                                      defaultValue={rt.minutes ?? ''}
                                      onBlur={(e) => rate(row, c.index, { minutes: Number(e.target.value) || null })}
                                      className="mt-1 w-full px-1 py-0.5 border border-gray-200 rounded text-[11px]"
                                    />
                                  )}
                                </div>
                              );
                            })}
                            {row.status === 'failed' && <span className="text-xs text-red-500">생성 실패</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
