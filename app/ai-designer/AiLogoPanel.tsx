'use client';

/**
 * AI 디자이너 — "AI로 도안 만들기" 패널 (후보 4장 → 선택 → 변형/확정 → 정제·검사 → 이미지 목록에 추가).
 *
 * 품질 원칙(2026-09-04 기획):
 *  - 글자는 AI가 그리지 않는다. 영문 레터링만 따옴표 문구로, 한글은 디자이너가 서체로.
 *  - 후보 여러 장 중 고르고, 고른 것을 기준으로 변형 1회.
 *  - 확정 시 서버가 배경 제거·벡터화·인쇄 적합성 검사를 수행하고 "AI 초안" 라벨로 목록에 들어간다.
 *  - 결과는 항상 디자이너 확정 시안을 거친 뒤 제작된다(주문 retouch 플래그).
 */

import React, { useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import {
  PURPOSE_HINTS,
  PURPOSE_LABELS,
  WORDMARK_TEXT_MAX,
  hasKorean,
  textAdvisory,
  validatePromptInput,
  type ArtworkPurpose,
  type ColorCount,
} from '@/lib/aiDesigner/prompt';

export interface AiPublicStatus {
  aiEnabled: boolean;
  aiWordmarkEnabled: boolean;
  aiDraftEnabled: boolean;
  aiIsMock: boolean;
  aiCandidates: number;
  aiMaxRounds: number;
  aiVectorize: boolean;
}

export const DEFAULT_AI_STATUS: AiPublicStatus = {
  aiEnabled: false, aiWordmarkEnabled: false, aiDraftEnabled: false, aiIsMock: false,
  aiCandidates: 4, aiMaxRounds: 3, aiVectorize: false,
};

/** 세션 API 응답에서 상태 필드만 안전하게 읽는다. */
export function readAiStatus(d: Record<string, unknown> | null | undefined): AiPublicStatus {
  if (!d) return DEFAULT_AI_STATUS;
  return {
    aiEnabled: !!d.aiEnabled,
    aiWordmarkEnabled: !!d.aiWordmarkEnabled,
    aiDraftEnabled: !!d.aiDraftEnabled,
    aiIsMock: !!d.aiIsMock,
    aiCandidates: typeof d.aiCandidates === 'number' ? d.aiCandidates : 4,
    aiMaxRounds: typeof d.aiMaxRounds === 'number' ? d.aiMaxRounds : 3,
    aiVectorize: !!d.aiVectorize,
  };
}

export interface CandidateQuality {
  metrics?: { colorCount?: number; minStrokeMm?: number | null; transparent?: boolean };
  dtf: { grade: 'ok' | 'review'; labels: string[]; flags?: string[] };
  screen?: { grade: 'ok' | 'review'; labels: string[]; flags?: string[] };
  embroidery: { grade: 'ok' | 'review'; labels: string[]; flags?: string[] };
}

export interface AiReadyImage {
  url: string;
  path: string;
  name: string;
  prompt: string;
  width: number;
  height: number;
  generationId: string | null;
  quality: CandidateQuality | null;
  svgUrl: string | null;
  bgRemoved: boolean;
}

interface Candidate {
  index: number;
  url: string;
  path: string;
  width: number;
  height: number;
  svgUrl: string | null;
  quality: CandidateQuality | null;
}

const PURPOSES: ArtworkPurpose[] = ['emblem', 'mascot', 'wordmark'];
const COLOR_COUNTS: ColorCount[] = [2, 3, 4];

function QualityBadge({ q }: { q: CandidateQuality | null }) {
  if (!q) return null;
  const ok = q.dtf.grade === 'ok';
  return (
    <span
      className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ok ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}
      title={ok ? '인쇄 적합' : q.dtf.labels.join(' / ')}
    >
      {ok ? '인쇄 적합' : '보정 필요'}
    </span>
  );
}

export default function AiLogoPanel({
  sessionId,
  status,
  onImageReady,
}: {
  sessionId: string | null;
  status: AiPublicStatus;
  onImageReady: (img: AiReadyImage) => void;
}) {
  const [purpose, setPurpose] = useState<ArtworkPurpose>('emblem');
  const [colorCount, setColorCount] = useState<ColorCount>(3);
  const [request, setRequest] = useState('');
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [roundsUsed, setRoundsUsed] = useState(0);
  const [maxRounds, setMaxRounds] = useState(status.aiMaxRounds);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [done, setDone] = useState<{ quality: CandidateQuality | null; vectorized: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = status.aiEnabled;
  const wordmarkAllowed = status.aiWordmarkEnabled;
  const roundsLeft = Math.max(0, (maxRounds || status.aiMaxRounds) - roundsUsed);
  const advisory = useMemo(() => textAdvisory({ request, purpose, colorCount, text }), [request, purpose, colorCount, text]);
  const validation = useMemo(() => validatePromptInput({ request, purpose, colorCount, text }), [request, purpose, colorCount, text]);
  const koreanText = purpose === 'wordmark' && hasKorean(text);

  const generate = async (variation: boolean) => {
    if (!sessionId || !enabled) return;
    if (!validation.ok) { setError(validation.error); return; }
    setGenerating(true); setError(null); setDone(null);
    try {
      const res = await fetch('/api/ai-designer/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, request, purpose, colorCount, text: purpose === 'wordmark' ? text : undefined,
          variationOf: variation && generationId !== null && selected !== null ? { generationId, index: selected } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.roundsUsed === 'number') setRoundsUsed(data.roundsUsed);
        throw new Error(data.error || '이미지 생성에 실패했습니다.');
      }
      setCandidates(data.candidates ?? []);
      setGenerationId(data.generationId ?? null);
      setSelected(null);
      if (typeof data.roundsUsed === 'number') setRoundsUsed(data.roundsUsed);
      if (typeof data.maxRounds === 'number') setMaxRounds(data.maxRounds);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const finalize = async () => {
    if (!sessionId || generationId === null || selected === null) return;
    const cand = candidates.find((c) => c.index === selected);
    if (!cand) return;
    setError(null);
    setFinalizing('배경을 정리하는 중…');
    const timer = window.setTimeout(() => setFinalizing(status.aiVectorize ? '벡터로 변환하는 중…' : '인쇄 적합성을 검사하는 중…'), 1200);
    try {
      const res = await fetch('/api/ai-designer/finalize-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, generationId, index: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '도안 정리에 실패했습니다.');
      const label = purpose === 'wordmark' ? text.trim() : request.trim();
      onImageReady({
        url: data.url, path: data.path,
        name: `AI 초안: ${label.slice(0, 30)}`,
        prompt: purpose === 'wordmark' ? `${PURPOSE_LABELS.wordmark} "${text.trim()}" ${request.trim()}`.trim() : request.trim(),
        width: data.width, height: data.height,
        generationId, quality: data.quality ?? null, svgUrl: data.svgUrl ?? null,
        bgRemoved: !!data.removedBackground,
      });
      setDone({ quality: data.quality ?? null, vectorized: data.vectorized ?? null });
      setCandidates([]); setGenerationId(null); setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '도안 정리에 실패했습니다.');
    } finally {
      window.clearTimeout(timer);
      setFinalizing(null);
    }
  };

  const selectedCand = selected !== null ? candidates.find((c) => c.index === selected) ?? null : null;

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4" data-testid="ai-logo-panel">
      <div className="flex items-center gap-1.5">
        <Wand2 className="w-4 h-4 text-brand" />
        <span className="text-sm font-bold text-gray-900">AI로 도안 만들기</span>
        {!enabled && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">준비 중</span>
        )}
        {enabled && status.aiIsMock && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="API 키 없이 동작하는 모의 생성기입니다. 실제 AI 그림이 아닙니다.">테스트 모드</span>
        )}
        {enabled && !status.aiIsMock && (
          <span className="ml-auto text-[10px] text-gray-400">생성 {roundsUsed}/{maxRounds}회</span>
        )}
      </div>

      {!enabled ? (
        <p className="text-[11px] text-gray-400 mt-2">AI 도안 생성은 곧 열립니다. 지금은 업로드·촬영을 이용해 주세요.</p>
      ) : (
        <>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {PURPOSES.map((p) => {
              const disabled = p === 'wordmark' && !wordmarkAllowed;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => { if (!disabled) { setPurpose(p); setError(null); } }}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${purpose === p ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'} disabled:opacity-40`}
                >
                  {PURPOSE_LABELS[p]}
                </button>
              );
            })}
            <div className="ml-auto flex gap-1">
              {COLOR_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setColorCount(n)}
                  className={`w-9 h-8 rounded-lg text-xs font-semibold border ${colorCount === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}
                  title={`${n}색 이하로 만들기`}
                >
                  {n}색
                </button>
              ))}
            </div>
          </div>

          {purpose === 'wordmark' && (
            <div className="mt-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={WORDMARK_TEXT_MAX}
                placeholder="넣을 문구 (영문·숫자, 예: HANYANG 24)"
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-brand ${koreanText ? 'border-red-300' : 'border-gray-200'}`}
                data-testid="ai-wordmark-text"
              />
              <p className={`text-[11px] mt-1 ${koreanText ? 'text-red-500' : 'text-gray-400'}`}>
                {koreanText
                  ? '한글 문구는 AI가 그리지 않습니다. 주문 요청사항에 적어 주시면 디자이너가 서체로 넣어 드립니다.'
                  : '글자는 AI가 그리면 틀리기 쉬워 영문 문구만 받습니다. 한글·이름·학번은 디자이너가 서체로 정확히 넣어 드립니다.'}
              </p>
            </div>
          )}

          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={PURPOSE_HINTS[purpose]}
            rows={2}
            maxLength={400}
            className="mt-3 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand"
            data-testid="ai-request"
          />
          {advisory && <p className="text-[11px] text-amber-600 mt-1">{advisory}</p>}

          <button
            type="button"
            onClick={() => generate(false)}
            disabled={!sessionId || generating || !!finalizing || !validation.ok || roundsLeft === 0}
            className="mt-3 w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            data-testid="ai-generate"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? `후보 ${status.aiCandidates}장을 그리는 중…` : roundsLeft === 0 ? '생성 횟수를 모두 사용했습니다' : `후보 ${status.aiCandidates}장 만들기`}
          </button>
          {error && <p className="text-xs text-red-500 mt-2" data-testid="ai-error">{error}</p>}

          {candidates.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-700">마음에 드는 후보를 골라 주세요</p>
              <div className="grid grid-cols-2 gap-2 mt-2" data-testid="ai-candidates">
                {candidates.map((c) => {
                  const isSel = selected === c.index;
                  return (
                    <button
                      key={c.index}
                      type="button"
                      onClick={() => setSelected(c.index)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 bg-white transition ${isSel ? 'border-brand ring-2 ring-brand/30' : 'border-gray-200'}`}
                      data-testid="ai-candidate"
                      data-index={c.index}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.url} alt={`후보 ${c.index + 1}`} className="w-full h-full object-contain" />
                      <QualityBadge q={c.quality} />
                      {isSel && (
                        <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedCand?.quality && selectedCand.quality.dtf.labels.length > 0 && (
                <p className="text-[11px] text-amber-600 mt-2">{selectedCand.quality.dtf.labels.join(' · ')} — 주문 후 디자이너가 정리합니다.</p>
              )}
              {selectedCand?.quality && selectedCand.quality.dtf.labels.length === 0 && selectedCand.quality.embroidery.labels.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-2">자수로 만들 때는 보정이 필요할 수 있어요: {selectedCand.quality.embroidery.labels.join(' · ')}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={finalize}
                  disabled={selected === null || !!finalizing || generating}
                  className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                  data-testid="ai-finalize"
                >
                  {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {finalizing ?? '이 도안으로 진행'}
                </button>
                <button
                  type="button"
                  onClick={() => generate(true)}
                  disabled={selected === null || !!finalizing || generating || roundsLeft === 0}
                  className="px-3 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                  title={roundsLeft === 0 ? '생성 횟수를 모두 사용했습니다' : '고른 후보를 기준으로 다시 그립니다'}
                  data-testid="ai-variation"
                >
                  <RefreshCw className="w-4 h-4" /> 이 느낌으로 다시
                </button>
              </div>
            </div>
          )}

          {done && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-brand-softer border border-brand-soft text-xs text-gray-700" data-testid="ai-done">
              <p className="font-semibold text-gray-900">
                AI 초안이 이미지 목록에 추가되었습니다
                {done.quality && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${done.quality.dtf.grade === 'ok' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                    {done.quality.dtf.grade === 'ok' ? '인쇄 적합' : '디자이너 보정 필요'}
                  </span>
                )}
              </p>
              {done.quality && done.quality.dtf.labels.length > 0 && (
                <p className="mt-1 text-amber-700">{done.quality.dtf.labels.join(' · ')}</p>
              )}
              <p className="mt-1 text-gray-500">
                AI 초안은 디자이너가 확정 시안을 확인한 뒤 제작합니다.
                {done.vectorized ? ' 벡터(SVG) 파일도 함께 보관됩니다.' : ''}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
