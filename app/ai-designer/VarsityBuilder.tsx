'use client';

/**
 * AI 디자이너 — 과잠(바시티 자켓) 전용 빌더 (2단계).
 *
 * 색상(부위별) → 디자인(정석 슬롯에 글자·이미지) → 명단·수량 → 확인·장바구니.
 * 미리보기는 lib/aiDesigner/varsityPreview(레이어 틴팅 + 슬롯 렌더)이고, 주문은
 * /api/ai-designer/varsity-order 가 같은 슬롯 정의로 에디터 호환 canvas_state 를 만든다.
 * 견적은 lib/aiDesigner/varsityPricing(슬롯형 패키지가)을 클라·서버가 공유한다.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Minus, Plus, ShoppingCart, Sparkles, Trash2, Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { ensureFontsLoaded } from '@/lib/ensureFonts';
import { trackAddToCart } from '@/lib/gtm-events';
import type { PartLayerSide } from '@/lib/aiDesigner/catalogTypes';
import type { SideGeometry } from '@/lib/aiDesigner/placement';
import { renderVarsitySide, slotToCanvas, type PreviewSlot } from '@/lib/aiDesigner/varsityPreview';
import { quoteVarsity, type VarsityPricingRule } from '@/lib/aiDesigner/varsityPricing';
import {
  VARSITY_COLOR_PRESETS,
  VARSITY_FONTS,
  VARSITY_SLOTS,
  VARSITY_THREAD_COLORS,
  aggregateSizes,
  chenilleCountOf,
  effectiveFont,
  enabledSlots,
  normalizeBuilderState,
  parseRoster,
  slotText,
  surchargeKeysOf,
  totalQuantity,
  usesIndividualNumbers,
  type RosterRow,
  type VarsityBuilderState,
  type VarsitySlotId,
  type VarsitySlotState,
} from '@/lib/aiDesigner/varsitySlots';

const STEPS = ['색상', '디자인', '명단·수량', '확인'] as const;
const SIZE_SCALES = [
  { label: '작게', value: 0.8 },
  { label: '보통', value: 1 },
  { label: '크게', value: 1.25 },
];

interface SideView {
  sideId: string;
  name: string;
  geometry: SideGeometry;
}

function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 200;
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function signed(n: number): string {
  return n > 0 ? `+${n.toLocaleString('ko-KR')}` : n.toLocaleString('ko-KR');
}

export default function VarsityBuilder({
  product,
  partLayers,
  presetLayerColors,
  sides,
  sizeOptions,
  pricing,
  sessionId,
  initialState,
  onSaveState,
  onBack,
  onFallbackIntake,
}: {
  product: { id: string; title: string; base_price: number };
  partLayers: PartLayerSide[];
  presetLayerColors: Record<string, Record<string, string>> | null;
  sides: SideView[];
  sizeOptions: string[];
  pricing: VarsityPricingRule;
  sessionId: string | null;
  initialState: unknown;
  onSaveState: (state: VarsityBuilderState) => void;
  onBack: () => void;
  onFallbackIntake: () => void;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [state, setState] = useState<VarsityBuilderState>(() =>
    normalizeBuilderState(initialState, partLayers, presetLayerColors)
  );
  const [step, setStep] = useState(0);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [fontsReady, setFontsReady] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<VarsitySlotId | null>(null);
  const [rosterText, setRosterText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const firstSave = useRef(true);

  const primarySide = useMemo(
    () => [...partLayers].sort((a, b) => b.layers.length - a.layers.length)[0],
    [partLayers]
  );
  const sideOf = useCallback(
    (sideId: string) => partLayers.find((p) => p.sideId === sideId) ?? null,
    [partLayers]
  );
  const geometryOf = useCallback(
    (sideId: string) => sides.find((s) => s.sideId === sideId)?.geometry ?? null,
    [sides]
  );

  /* --- 폰트 준비 --- */
  useEffect(() => {
    let alive = true;
    ensureFontsLoaded(VARSITY_FONTS.map((f) => f.family))
      .catch(() => {})
      .finally(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  /* --- 세션 저장(디바운스) --- */
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    const t = setTimeout(() => onSaveState(state), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const update = useCallback((patch: Partial<VarsityBuilderState>) => setState((s) => ({ ...s, ...patch })), []);
  const updateSlot = useCallback(
    (id: VarsitySlotId, patch: Partial<VarsitySlotState>) =>
      setState((s) => ({ ...s, slots: { ...s.slots, [id]: { ...s.slots[id], ...patch } } })),
    []
  );

  /* --- 미리보기 슬롯 계산 (학번 자리는 slotText가 공통/대표 학번을 채운다) --- */
  const previewSlotsFor = useCallback(
    (sideId: string): PreviewSlot[] => {
      const geo = geometryOf(sideId);
      const out: PreviewSlot[] = [];
      for (const def of VARSITY_SLOTS.filter((d) => d.sideId === sideId)) {
        const slot = state.slots[def.id];
        if (!slot?.enabled) continue;
        const p = slotToCanvas(geo, def.fx, def.fy);
        if (slot.mode === 'image') {
          if (!slot.image) continue;
          out.push({
            kind: 'image', x: p.x, y: p.y, url: slot.image.url,
            naturalWidth: slot.image.width, naturalHeight: slot.image.height,
            targetWidth: def.maxWidthFrac * slot.scale * (geo?.imgW ?? 400) * p.scale,
          });
          continue;
        }
        const text = slotText(def, slot, state);
        const fontSize = def.defaultFontSize * slot.scale * p.scale;
        if (text) {
          out.push({
            kind: 'text', x: p.x, y: p.y, text,
            fontFamily: effectiveFont(slot.fontFamily, text), fontSize,
            fill: slot.fill, stroke: slot.stroke, strokeWidth: slot.stroke ? 2 : 0,
            curveIntensity: def.curveIntensity ?? 0, charSpacing: def.curveIntensity ? 50 : 0,
          });
        }
        if (def.fy2 !== undefined && slot.text2.trim()) {
          const p2 = slotToCanvas(geo, def.fx, def.fy2);
          out.push({
            kind: 'text', x: p2.x, y: p2.y, text: slot.text2.trim(),
            fontFamily: effectiveFont(slot.fontFamily, slot.text2), fontSize: fontSize * 0.68,
            fill: slot.fill, stroke: slot.stroke, strokeWidth: slot.stroke ? 2 : 0, curveIntensity: 0, charSpacing: 0,
          });
        }
      }
      return out;
    },
    [state, geometryOf]
  );

  useEffect(() => {
    if (!fontsReady) return;
    let cancelled = false;
    const run = async () => {
      for (const [sideId, ref] of [['front', frontRef], ['back', backRef]] as const) {
        const side = sideOf(sideId);
        const canvas = ref.current;
        if (!side || !canvas || cancelled) continue;
        await renderVarsitySide(canvas, { side, geometry: geometryOf(sideId), colors: state.partColors, slots: previewSlotsFor(sideId) });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [fontsReady, state.partColors, previewSlotsFor, sideOf, geometryOf, step, activeSide]);

  /* --- 견적 --- */
  const quantity = totalQuantity(state);
  const sizeSummary = useMemo(
    () => (state.roster.length > 0 ? aggregateSizes(state.roster) : state.sizeQuantities),
    [state.roster, state.sizeQuantities]
  );
  const quote = useMemo(
    () =>
      quoteVarsity(pricing, {
        quantity,
        surchargeKeys: surchargeKeysOf(state),
        chenilleCount: chenilleCountOf(state),
        individualNumbers: usesIndividualNumbers(state),
      }),
    [pricing, state, quantity]
  );

  /* --- 이미지 업로드 (엠블럼) --- */
  const uploadSlotImage = async (id: VarsitySlotId, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError('이미지는 20MB 이하로 올려주세요.'); return; }
    setUploadingSlot(id); setError(null);
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const el = new window.Image();
        el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight });
        el.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
        el.src = URL.createObjectURL(file);
      });
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `ai-designer/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const supabase = createClient();
      const { data, error: upErr } = await supabase.storage.from('user-designs').upload(path, file, { contentType: file.type || 'image/png' });
      if (upErr || !data) throw new Error('업로드에 실패했습니다. 다시 시도해 주세요.');
      const { data: pub } = supabase.storage.from('user-designs').getPublicUrl(data.path);
      updateSlot(id, { mode: 'image', image: { url: pub.publicUrl, path: data.path, name: file.name, width: dims.w, height: dims.h } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploadingSlot(null);
    }
  };

  /* --- 명단 --- */
  const importRoster = () => {
    const rows = parseRoster(rosterText, sizeOptions);
    if (rows.length === 0) return;
    update({ roster: [...state.roster, ...rows].slice(0, 500) });
    setRosterText('');
  };
  const setRow = (i: number, patch: Partial<RosterRow>) =>
    update({ roster: state.roster.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const removeRow = (i: number) => update({ roster: state.roster.filter((_, j) => j !== i) });
  const setSizeQty = (size: string, qty: number) =>
    update({ sizeQuantities: { ...state.sizeQuantities, [size]: Math.max(0, Math.min(10000, qty)) } });

  /* --- 단계 검증 --- */
  const stepError = (): string | null => {
    if (step === 1 && enabledSlots(state).length === 0) return '글자나 이미지를 하나 이상 넣어 주세요.';
    if (step === 2) {
      if (quantity < 1) return '수량을 입력해 주세요.';
      if (quantity < pricing.moq) return `과잠은 최소 ${pricing.moq}장부터 주문할 수 있어요.`;
      if (state.roster.some((r) => !r.size)) return '명단에 사이즈가 빠진 사람이 있어요.';
      if (state.numberMode === 'common' && !state.commonNumber.trim()) return '공통 학번을 입력해 주세요.';
    }
    return null;
  };
  const next = () => {
    const e = stepError();
    if (e) { setError(e); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0 });
  };
  const prev = () => {
    setError(null);
    if (step === 0) onBack();
    else { setStep((s) => s - 1); window.scrollTo({ top: 0 }); }
  };

  /* --- 장바구니 --- */
  const submit = async () => {
    if (!sessionId) return;
    const e = stepError();
    if (e) { setError(e); return; }
    if (!isAuthenticated) {
      onSaveState(state);
      router.push(`/login?redirect=${encodeURIComponent(`/ai-designer?session=${sessionId}`)}`);
      return;
    }
    setSubmitting(true); setError(null);
    try {
      let previewDataUrl: string | null = null;
      try { previewDataUrl = frontRef.current?.toDataURL('image/png') ?? null; } catch { /* tainted */ }
      const res = await fetch('/api/ai-designer/varsity-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, productId: product.id, state, previewDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '장바구니 담기에 실패했습니다.');
      trackAddToCart({
        value: data.total,
        items: [{ item_id: product.id, item_name: product.title, price: data.pricePerItem, quantity: data.quantity }],
        design_id: data.savedDesignId,
      });
      router.push('/cart');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : '장바구니 담기에 실패했습니다.');
      setSubmitting(false);
    }
  };

  const layersForColor = primarySide ? [...primarySide.layers].sort((a, b) => a.zIndex - b.zIndex) : [];
  const applyPreset = (id: string) => {
    const preset = VARSITY_COLOR_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const nextColors = { ...state.partColors };
    for (const l of partLayers.flatMap((p) => p.layers)) {
      const hex = preset.colors[l.id];
      if (hex && l.colorOptions.some((c) => c.hex.toLowerCase() === hex.toLowerCase())) nextColors[l.id] = hex;
    }
    update({ presetId: id, partColors: nextColors });
  };

  // 컴포넌트가 아니라 렌더 함수 — 캔버스 ref가 리마운트되지 않도록 한다.
  const previewBlock = () => (
    <div className="w-full">
      <div className="flex gap-1.5 mb-2">
        {(['front', 'back'] as const).filter((s) => sideOf(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setActiveSide(s)}
            className={`px-3 h-7 rounded-full text-[11px] font-semibold border ${activeSide === s ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {s === 'front' ? '앞면' : '뒷면'}
          </button>
        ))}
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-[#f4f4f5]" style={{ aspectRatio: '4 / 5' }}>
        <canvas ref={frontRef} className={`absolute inset-0 w-full h-full ${activeSide === 'front' ? '' : 'invisible'}`} data-side="front" />
        <canvas ref={backRef} className={`absolute inset-0 w-full h-full ${activeSide === 'back' ? '' : 'invisible'}`} data-side="back" />
        {!fontsReady && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs"><Loader2 className="w-4 h-4 animate-spin mr-1" /> 미리보기 준비 중</div>
        )}
      </div>
    </div>
  );

  return (
    <section data-testid="varsity-builder" className="pb-6">
      {/* 진행 표시 */}
      <div className="flex items-center gap-1.5 mb-3">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={`px-2.5 h-7 rounded-full text-[11px] font-semibold border transition ${
              i === step ? 'bg-brand text-white border-brand' : i < step ? 'bg-brand-softer text-brand border-brand-soft' : 'bg-white text-gray-400 border-gray-200'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* STEP 0 — 부위별 색상 */}
      {step === 0 && (
        <div>
          <h1 className="text-xl font-black text-gray-900">부위별 색상을 고르세요</h1>
          <p className="text-sm text-gray-500 mt-1">인기 조합에서 고르고, 몸통·팔·쉬보리를 따로 바꿀 수도 있어요.</p>
          <div className="mt-4 grid grid-cols-[140px_1fr] gap-3 items-start">
            {previewBlock()}
            <div>
              <div className="grid grid-cols-3 gap-1.5">
                {VARSITY_COLOR_PRESETS.map((p) => {
                  const active = state.presetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg border text-[10px] font-semibold leading-tight text-center [word-break:keep-all] ${active ? 'border-brand bg-brand-softer text-brand' : 'border-gray-200 bg-white text-gray-700'}`}
                    >
                      <span className="flex -space-x-1">
                        <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: p.colors.body }} />
                        <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: p.colors.arms }} />
                      </span>
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 space-y-2">
                {layersForColor.map((l) => (
                  <div key={l.id}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">{l.name}</span>
                      <span className="text-[11px] text-gray-500">
                        {l.colorOptions.find((c) => c.hex.toLowerCase() === (state.partColors[l.id] ?? '').toLowerCase())?.name ?? ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {l.colorOptions.map((c) => {
                        const active = (state.partColors[l.id] ?? '').toLowerCase() === c.hex.toLowerCase();
                        return (
                          <button
                            key={`${l.id}-${c.hex}`}
                            type="button"
                            aria-label={`${l.name} ${c.name}`}
                            aria-pressed={active}
                            onClick={() => update({ presetId: null, partColors: { ...state.partColors, [l.id]: c.hex } })}
                            className={`w-7 h-7 rounded-full border-2 transition ${active ? 'border-brand scale-110' : isLightHex(c.hex) ? 'border-gray-300' : 'border-transparent'}`}
                            style={{ backgroundColor: c.hex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1 — 디자인 슬롯 */}
      {step === 1 && (
        <div>
          <h1 className="text-xl font-black text-gray-900">어디에 무엇을 넣을까요?</h1>
          <p className="text-sm text-gray-500 mt-1">과잠 정석 위치입니다. 켜고 글자나 이미지를 넣으면 미리보기에 바로 나타나요.</p>
          <div className="mt-4">
            {previewBlock()}
          </div>
          {(['front', 'back'] as const).filter((s) => sideOf(s)).map((sideId) => (
            <div key={sideId} className="mt-5">
              <h2 className="text-sm font-bold text-gray-900">{sideId === 'front' ? '앞면' : '뒷면'}</h2>
              <div className="mt-2 space-y-2">
                {VARSITY_SLOTS.filter((d) => d.sideId === sideId).map((def) => {
                  const slot = state.slots[def.id];
                  const surcharge = def.surchargeKey ? pricing.slotSurcharges[def.surchargeKey] : 0;
                  return (
                    <div key={def.id} className={`rounded-xl border bg-white px-3 py-2.5 ${slot.enabled ? 'border-brand/40' : 'border-gray-200'}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) => { updateSlot(def.id, { enabled: e.target.checked }); setActiveSide(sideId); }}
                          aria-label={def.label}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-bold text-gray-900">{def.label}</span>
                          <span className="block text-[11px] text-gray-500">{def.hint}{surcharge > 0 && ` · 장당 +${surcharge.toLocaleString('ko-KR')}원`}</span>
                        </span>
                        {surcharge === 0 && <span className="text-[10px] font-semibold text-brand">기본 포함</span>}
                      </label>
                      {slot.enabled && (
                        <div className="mt-2.5 space-y-2" onFocus={() => setActiveSide(sideId)}>
                          {def.allow.length > 1 && (
                            <div className="flex gap-1.5">
                              {def.allow.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => updateSlot(def.id, { mode: m })}
                                  aria-pressed={slot.mode === m}
                                  className={`px-3 h-7 rounded-full text-[11px] font-semibold border ${slot.mode === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
                                >
                                  {m === 'text' ? '글자' : '이미지'}
                                </button>
                              ))}
                            </div>
                          )}
                          {slot.mode === 'image' ? (
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-dashed border-gray-300 text-[12px] font-semibold text-gray-700 cursor-pointer">
                                {uploadingSlot === def.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                                {slot.image ? '다른 이미지' : '이미지 올리기'}
                                <input type="file" accept="image/*" hidden disabled={uploadingSlot !== null}
                                  onChange={(e) => { void uploadSlotImage(def.id, e.target.files); e.currentTarget.value = ''; }} />
                              </label>
                              {slot.image && (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={slot.image.url} alt={slot.image.name} className="w-9 h-9 rounded object-contain bg-gray-50 border border-gray-100" />
                                  <button type="button" onClick={() => updateSlot(def.id, { image: null })} aria-label="이미지 삭제" className="text-gray-400"><Trash2 className="w-4 h-4" /></button>
                                </>
                              )}
                              <span className="text-[11px] text-gray-500">엠블럼은 아플리케·자수로 제작돼요</span>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={slot.text}
                                onChange={(e) => updateSlot(def.id, { text: e.target.value.slice(0, 30) })}
                                placeholder={def.role === 'number' && state.numberMode !== 'none' ? (state.numberMode === 'common' ? '비우면 공통 학번이 들어가요' : '비우면 명단의 학번이 각자 들어가요') : def.placeholder}
                                aria-label={`${def.label} 글자`}
                                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
                              />
                              {def.fy2 !== undefined && (
                                <input
                                  type="text"
                                  value={slot.text2}
                                  onChange={(e) => updateSlot(def.id, { text2: e.target.value.slice(0, 30) })}
                                  placeholder={def.placeholder2}
                                  aria-label={`${def.label} 둘째 줄`}
                                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
                                />
                              )}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <select
                                  value={slot.fontFamily}
                                  onChange={(e) => updateSlot(def.id, { fontFamily: e.target.value })}
                                  aria-label="서체"
                                  className="h-8 px-2 rounded-lg border border-gray-200 text-[12px] bg-white"
                                >
                                  {VARSITY_FONTS.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}
                                </select>
                                <div className="flex gap-1 items-center">
                                  {VARSITY_THREAD_COLORS.map((c) => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      aria-label={`실 색 ${c.name}`}
                                      aria-pressed={slot.fill.toLowerCase() === c.hex}
                                      onClick={() => updateSlot(def.id, { fill: c.hex })}
                                      className={`w-6 h-6 rounded-full border-2 ${slot.fill.toLowerCase() === c.hex ? 'border-brand scale-110' : isLightHex(c.hex) ? 'border-gray-300' : 'border-transparent'}`}
                                      style={{ backgroundColor: c.hex }}
                                    />
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateSlot(def.id, { stroke: slot.stroke ? '' : (isLightHex(slot.fill) ? '#19375e' : '#ffffff') })}
                                  aria-pressed={!!slot.stroke}
                                  className={`px-2.5 h-7 rounded-full text-[11px] font-semibold border ${slot.stroke ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
                                >
                                  외곽선
                                </button>
                                <div className="flex gap-1">
                                  {SIZE_SCALES.map((sz) => (
                                    <button
                                      key={sz.value}
                                      type="button"
                                      onClick={() => updateSlot(def.id, { scale: sz.value })}
                                      aria-pressed={slot.scale === sz.value}
                                      className={`px-2 h-7 rounded-full text-[11px] font-semibold border ${slot.scale === sz.value ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'}`}
                                    >
                                      {sz.label}
                                    </button>
                                  ))}
                                </div>
                                <label className="flex items-center gap-1 text-[11px] text-gray-700 ml-auto">
                                  <input type="checkbox" checked={slot.chenille} onChange={(e) => updateSlot(def.id, { chenille: e.target.checked })} />
                                  보풀(쉐닐) 자수 +{pricing.chenilleSurcharge.toLocaleString('ko-KR')}원
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP 2 — 명단·수량 */}
      {step === 2 && (
        <div>
          <h1 className="text-xl font-black text-gray-900">명단과 수량을 넣어 주세요</h1>
          <p className="text-sm text-gray-500 mt-1">명단을 붙여넣으면 사이즈별 수량이 자동으로 집계돼요. 최소 {pricing.moq}장부터 주문할 수 있어요.</p>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white px-3 py-3">
            <p className="text-[13px] font-bold text-gray-900">학번은 어떻게 넣을까요?</p>
            <div className="mt-2 space-y-1.5">
              {([
                { v: 'none', label: '학번 없음' },
                { v: 'common', label: '공통 학번 1종 (무료)' },
                { v: 'individual', label: `개인별 학번 (장당 +${pricing.individualNumberSurcharge.toLocaleString('ko-KR')}원, 자수만 가능)` },
              ] as const).map((o) => (
                <label key={o.v} className="flex items-center gap-2 text-[13px] text-gray-800">
                  <input
                    type="radio"
                    name="numberMode"
                    checked={state.numberMode === o.v}
                    onChange={() => {
                      // 학번을 쓰기로 했는데 학번 자리가 하나도 켜져 있지 않으면 오른쪽 가슴을 자동으로 켠다
                      const numberSlotOn = state.slots['front-right-chest'].enabled || state.slots['front-right-sleeve'].enabled;
                      const slots = o.v !== 'none' && !numberSlotOn
                        ? { ...state.slots, 'front-right-chest': { ...state.slots['front-right-chest'], enabled: true, mode: 'text' as const } }
                        : state.slots;
                      update({ numberMode: o.v, slots });
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {state.numberMode === 'common' && (
              <input
                type="text"
                value={state.commonNumber}
                onChange={(e) => update({ commonNumber: e.target.value.slice(0, 12) })}
                placeholder="예) 26"
                aria-label="공통 학번"
                className="mt-2 w-32 h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand"
              />
            )}
            {state.numberMode !== 'none' && !VARSITY_SLOTS.some((d) => d.role !== 'logo' && (d.role === 'number' || d.id === 'front-right-sleeve') && state.slots[d.id].enabled) && (
              <p className="mt-2 text-[11px] text-amber-700">학번이 들어갈 위치(오른쪽 가슴 또는 오른쪽 소매)가 꺼져 있어요. 디자인 단계에서 켜 주세요.</p>
            )}
          </div>

          <div className="mt-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Users className="w-4 h-4 text-brand" /> 명단 붙여넣기</h2>
            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              placeholder={'한 줄에 한 명씩: 이름 학번 사이즈\n홍길동 24 M\n김민지 25 L'}
              rows={4}
              aria-label="명단 붙여넣기"
              className="mt-2 w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
            />
            <button type="button" onClick={importRoster} disabled={!rosterText.trim()} className="mt-2 h-9 px-4 rounded-lg bg-gray-900 text-white text-[12px] font-bold disabled:opacity-40">
              명단 불러오기
            </button>
          </div>

          {state.roster.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">이름</th>
                    {state.numberMode === 'individual' && <th className="text-left px-2 py-1.5 font-semibold">학번</th>}
                    <th className="text-left px-2 py-1.5 font-semibold">사이즈</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {state.roster.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1">
                        <input value={r.name} onChange={(e) => setRow(i, { name: e.target.value.slice(0, 30) })} aria-label={`${i + 1}번 이름`} className="w-full h-8 px-2 rounded border border-gray-200" />
                      </td>
                      {state.numberMode === 'individual' && (
                        <td className="px-2 py-1">
                          <input value={r.number} onChange={(e) => setRow(i, { number: e.target.value.slice(0, 12) })} aria-label={`${i + 1}번 학번`} className="w-16 h-8 px-2 rounded border border-gray-200" />
                        </td>
                      )}
                      <td className="px-2 py-1">
                        <select value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} aria-label={`${i + 1}번 사이즈`} className={`h-8 px-1 rounded border bg-white ${r.size ? 'border-gray-200' : 'border-red-300'}`}>
                          <option value="">선택</option>
                          {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button type="button" onClick={() => removeRow(i)} aria-label={`${i + 1}번 삭제`} className="text-gray-400"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => update({ roster: [...state.roster, { name: '', number: '', size: '' }] })} className="w-full py-2 text-[12px] font-semibold text-brand border-t border-gray-100">
                + 한 명 추가
              </button>
            </div>
          )}

          {state.roster.length === 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-bold text-gray-900">명단 없이 사이즈별 수량만 넣기</h2>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {sizeOptions.map((s) => (
                  <div key={s} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-2 h-10">
                    <span className="text-[12px] font-semibold text-gray-800">{s}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setSizeQty(s, (state.sizeQuantities[s] || 0) - 1)} aria-label={`${s} 빼기`} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center text-[12px] font-bold tabular-nums">{state.sizeQuantities[s] || 0}</span>
                      <button type="button" onClick={() => setSizeQty(s, (state.sizeQuantities[s] || 0) + 1)} aria-label={`${s} 더하기`} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl bg-brand-softer border border-brand-soft px-4 py-3 text-[13px]">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-gray-900">총 {quantity}장</span>
              <span className="text-gray-600 text-[12px]">
                {Object.entries(sizeSummary).filter(([, q]) => q > 0).map(([s, q]) => `${s} ${q}`).join(' · ') || '사이즈 미정'}
              </span>
            </div>
            {quote.belowMoq && <p className="mt-1 text-[12px] text-red-600">최소 {pricing.moq}장부터 주문할 수 있어요.</p>}
            {usesIndividualNumbers(state) && <p className="mt-1 text-[12px] text-gray-600">개인별 학번 {new Set(state.roster.map((r) => r.number.trim()).filter(Boolean)).size}종 · 장당 +{pricing.individualNumberSurcharge.toLocaleString('ko-KR')}원</p>}
          </div>
        </div>
      )}

      {/* STEP 3 — 확인·견적 */}
      {step === 3 && (
        <div>
          <h1 className="text-xl font-black text-gray-900">이대로 장바구니에 담을까요?</h1>
          <p className="text-sm text-gray-500 mt-1">예상가입니다. 디자이너가 시안을 확인한 뒤 확정하고, 사양이 바뀌면 차액만 추가 결제해요.</p>
          <div className="mt-4">
            {previewBlock()}
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-4" data-testid="varsity-quote">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-gray-900">장당 예상가</span>
              <span className="text-2xl font-black text-gray-900 tabular-nums">{won(quote.unitPrice)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-gray-600">
              {quote.lines.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span>{l.label}</span>
                  <span className="tabular-nums">{l.kind === 'base' ? l.amount.toLocaleString('ko-KR') : signed(l.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-baseline justify-between">
              <span className="text-[13px] text-gray-700">{quantity}장 총액</span>
              <span className="text-lg font-black text-brand tabular-nums">{won(quote.total)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pricing.tiers.filter((t) => t.min >= pricing.moq).map((t) => (
                <span key={t.label} className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${t.label === quote.tier.label ? 'bg-brand text-white border-brand' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {t.label} {t.delta === 0 ? '기본' : signed(t.delta)}
                </span>
              ))}
            </div>
            {quote.nextTier && (
              <p className="mt-2 text-[11px] text-gray-500">
                {quote.nextTier.quantity}장부터는 장당 {won(quote.nextTier.unitPrice)}이에요.
              </p>
            )}
            <p className="mt-2 text-[11px] text-gray-500">{pricing.includedNote}. 제작은 시안 확정 후 약 {quote.leadTimeWeeks}주 걸려요.</p>
          </div>

          <textarea
            value={state.note}
            onChange={(e) => update({ note: e.target.value.slice(0, 2000) })}
            placeholder="디자이너에게 남길 요청 (선택) 예) 엠블럼은 자수로, 등판 글자는 조금 더 크게"
            rows={3}
            aria-label="디자이너 요청"
            className="mt-3 w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
          />

          <button type="button" onClick={onFallbackIntake} className="mt-3 w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold">
            직접 만들기 어렵다면 디자이너에게 맡기기
          </button>
        </div>
      )}

      {/* 하단 바 */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <button type="button" onClick={prev} className="h-12 px-4 rounded-xl bg-gray-100 text-gray-800 font-semibold flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> {step === 0 ? '다른 옷' : '이전'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="flex-1 h-12 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2">
              다음 <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting || quote.belowMoq || quantity < 1} className="flex-1 h-12 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {isAuthenticated ? `장바구니 담기 · ${won(quote.total)}` : '로그인하고 장바구니 담기'}
            </button>
          )}
        </div>
      </div>
      <div className="h-6" />
      <span className="sr-only"><Sparkles /><Check /></span>
    </section>
  );
}
