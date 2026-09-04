'use client';

/**
 * AI 디자이너 — 대화형 주문 위저드.
 *
 * 의류 → 원단 색상 → 이미지(업로드/촬영/AI생성) → 배치(면별) → 4면 초안 → 수량 → 장바구니.
 * - 미리보기 합성은 서버 canvas_state 빌드와 동일한 수학(lib/aiDesigner/placement)을 사용.
 * - 원본 이미지는 선택 즉시 user-designs 버킷에 업로드되어 주문까지 그대로 보존된다.
 * - AI 착장 초안은 서버 제공자(AI_DESIGNER_IMAGE_PROVIDER) 활성 시에만 생성,
 *   미설정이어도 로컬 합성 미리보기로 전체 플로우가 동작한다.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Loader2,
  ShoppingCart, Sparkles, Trash2, Wand2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import {
  computePlacement, computeSideScale, type SideGeometry,
} from '@/lib/aiDesigner/placement';
import type { AiCatalogCategory, AiCatalogProduct, PartLayerSide } from '@/lib/aiDesigner/catalogTypes';
import ProductPicker from './ProductPicker';
import ProductGrid from './ProductGrid';
import VarsityIntake from './VarsityIntake';
import VarsityBuilder from './VarsityBuilder';
import { DEFAULT_VARSITY_PRICING, type VarsityPricingRule } from '@/lib/aiDesigner/varsityPricing';
import type { VarsityBuilderState } from '@/lib/aiDesigner/varsitySlots';

/* ---------- 타입 ---------- */

/** 상품 선택 목록 항목 = /v2/mall 카탈로그와 같은 소스(lib/aiDesigner/catalog) */
type ProductLite = AiCatalogProduct;
interface SideInfo {
  sideId: string; name: string; mockupUrl: string; geometry: SideGeometry;
  anchors: Array<{ id: string; label?: string; xMm: number; yMm: number; recommendedWidthMm: number; recommendedHeightMm: number }>;
}
interface ColorInfo {
  id: string; name: string; hex: string; code: string; side_mockups: Record<string, string> | null;
}
interface SourceImage {
  url: string; path: string; name: string; origin: 'upload' | 'camera' | 'ai';
  prompt?: string; width: number; height: number;
}
interface Placement {
  side_id: string; image_index: number; anchor_id?: string; anchor_label?: string;
  fx: number; fy: number; width_mm: number;
}
interface ProductInfoResponse {
  product: { id: string; title: string; base_price: number; size_options: Array<{ label: string; size_code: string }> | null };
  sides: SideInfo[];
  colors: ColorInfo[];
  /** 부위별 색상 상품(바시티 자켓류) = 위저드 대신 디자이너 상담 접수 */
  intakeOnly?: boolean;
  partLayers?: PartLayerSide[];
  presetLayerColors?: Record<string, Record<string, string>> | null;
  /** 과잠 빌더 견적 규칙(슬롯형 패키지가) */
  pricing?: VarsityPricingRule | null;
}

const SIZE_PRESETS = [
  { key: 'sm', label: '작게 (8cm)', widthMm: 80 },
  { key: 'md', label: '보통 (12cm)', widthMm: 120 },
  { key: 'lg', label: '크게 (20cm)', widthMm: 200 },
  { key: 'xl', label: '아주 크게 (26cm)', widthMm: 260 },
];
// 앵커 캘리브레이션이 없는 면용 일반 위치 프리셋 (인쇄영역 상대좌표)
const GENERIC_POSITIONS: Record<string, Array<{ id: string; label: string; fx: number; fy: number }>> = {
  front: [
    { id: 'g-left-chest', label: '왼쪽 가슴', fx: 0.72, fy: 0.18 },
    { id: 'g-center-top', label: '가슴 중앙', fx: 0.5, fy: 0.2 },
    { id: 'g-center', label: '중앙 크게', fx: 0.5, fy: 0.45 },
  ],
  back: [
    { id: 'g-back-top', label: '등판 상단', fx: 0.5, fy: 0.12 },
    { id: 'g-back-center', label: '등판 중앙', fx: 0.5, fy: 0.45 },
  ],
  default: [{ id: 'g-center', label: '중앙', fx: 0.5, fy: 0.42 }],
};

const STEPS = ['상품', '색상', '이미지', '배치', '미리보기', '주문'] as const;

/* ---------- 면 합성 미리보기 캔버스 ---------- */

function SidePreview({
  side, colorMockup, placements, images, height = 240, draftUrl,
}: {
  side: SideInfo; colorMockup?: string | null;
  placements: Placement[]; images: SourceImage[]; height?: number; draftUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (draftUrl) return; // AI 초안이 있으면 <img>로 렌더
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 400, H = 500, dpr = 2;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#f4f4f5';
    ctx.fillRect(0, 0, W, H);

    const mockupSrc = colorMockup || side.mockupUrl;
    const mockup = new window.Image();
    mockup.crossOrigin = 'anonymous';
    mockup.onload = () => {
      // 색상 목업은 크기가 다를 수 있으므로 항상 side geometry 기준으로 fit
      const geo = side.geometry;
      const s = computeSideScale(geo);
      ctx.drawImage(
        mockup,
        (W - geo.imgW * s.scale) / 2, (H - geo.imgH * s.scale) / 2,
        geo.imgW * s.scale, geo.imgH * s.scale
      );
      const sidePlacements = placements.filter((p) => p.side_id === side.sideId);
      sidePlacements.forEach((p) => {
        const img = images[p.image_index];
        if (!img) return;
        const anchor = p.anchor_id ? side.anchors.find((a) => a.id === p.anchor_id) : undefined;
        const c = computePlacement(geo, {
          sideId: side.sideId, fx: p.fx, fy: p.fy, widthMm: p.width_mm,
          anchorXMm: anchor?.xMm, anchorYMm: anchor?.yMm,
          image: { url: img.url, naturalWidth: img.width, naturalHeight: img.height },
        });
        const el = new window.Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => {
          const w = img.width * c.scale, h = img.height * c.scale;
          ctx.drawImage(el, c.left - w / 2, c.top - h / 2, w, h);
        };
        el.src = img.url;
      });
    };
    mockup.src = mockupSrc;
  }, [side, colorMockup, placements, images, draftUrl]);

  if (draftUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={draftUrl} alt={side.name} className="w-full object-contain rounded-xl bg-gray-100" style={{ height }} />;
  }
  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl bg-gray-100"
      style={{ height, objectFit: 'contain' }}
      data-side={side.sideId}
    />
  );
}

/* ---------- 메인 위저드 ---------- */

export default function AiDesignerWizard({
  products,
  categories,
}: {
  products: ProductLite[];
  categories: AiCatalogCategory[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [product, setProduct] = useState<ProductLite | null>(null);
  const [info, setInfo] = useState<ProductInfoResponse | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  /** 과잠(부위별 색상 상품) 모드 — 위저드 스텝 대신 VarsityBuilder(기본) 또는 VarsityIntake(디자이너에게 맡기기) 표시 */
  const [intakeMode, setIntakeMode] = useState(false);
  const [intakeFallback, setIntakeFallback] = useState(false);
  /** 세션에 저장된 과잠 빌더 상태(복원용) */
  const [builderInitial, setBuilderInitial] = useState<unknown>(null);
  const [color, setColor] = useState<ColorInfo | null>(null);
  const [images, setImages] = useState<SourceImage[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');

  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  /* --- 세션 생성/복원 --- */
  useEffect(() => {
    const existing = searchParams?.get('session');
    if (existing) {
      fetch(`/api/ai-designer/session?id=${existing}`)
        .then((r) => r.json())
        .then((d) => {
          setAiEnabled(!!d.aiEnabled);
          if (!d.session) return;
          setSessionId(d.session.id);
          const s = d.session;
          if (s.builder_state) setBuilderInitial(s.builder_state);
          if (s.product_id) {
            const p = products.find((x) => x.id === s.product_id);
            if (p) setProduct(p);
            // 복원 시에도 면 지오메트리·색상·사이즈를 다시 로드해야 이후 스텝이 동작한다
            fetch(`/api/ai-designer/product-info?productId=${s.product_id}`)
              .then((r) => r.json())
              .then((d) => {
                if (!d?.product) return;
                setInfo(d);
                if (d.intakeOnly) { setIntakeMode(true); setStep(0); }
              })
              .catch(() => {});
          }
          if (s.product_color) setColor(s.product_color as ColorInfo);
          if (Array.isArray(s.source_images)) setImages(s.source_images);
          if (Array.isArray(s.placements)) setPlacements(s.placements);
          if (s.draft_images) setDrafts(s.draft_images);
          if (s.size_quantities) setQuantities(s.size_quantities);
          if (s.product_id) {
            // 배치까지 있던 세션이면 주문 단계로, 아니면 이어서
            setStep(Array.isArray(s.placements) && s.placements.length > 0 ? 4 : s.product_color ? 2 : 1);
          }
        })
        .catch(() => {});
    } else {
      fetch('/api/ai-designer/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then((r) => r.json())
        .then((d) => { if (d.id) setSessionId(d.id); setAiEnabled(!!d.aiEnabled); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSession = useCallback(
    (patch: Record<string, unknown>) => {
      if (!sessionId) return;
      fetch('/api/ai-designer/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, ...patch }),
      }).catch(() => {});
    },
    [sessionId]
  );

  /* --- 상품 선택 → 상세 로드 --- */
  const selectProduct = async (p: ProductLite) => {
    setProduct(p); setColor(null); setPlacements([]); setDrafts({});
    setInfoLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ai-designer/product-info?productId=${p.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '상품 정보를 불러오지 못했습니다.');
      setInfo(data);
      saveSession({ product_id: p.id });
      if (data.intakeOnly) {
        // 바시티 자켓류: 부위별 색·엠블럼·학번은 위저드가 아직 못 다루므로 디자이너 상담 접수로 진행
        setIntakeMode(true);
        setStep(0);
        window.scrollTo({ top: 0 });
      } else {
        setStep(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '상품 정보를 불러오지 못했습니다.');
    } finally {
      setInfoLoading(false);
    }
  };

  /* --- 이미지 업로드/촬영 --- */
  const handleFiles = async (files: FileList | null, origin: 'upload' | 'camera') => {
    if (!files || files.length === 0) return;
    setUploading(true); setError(null);
    const supabase = createClient();
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        if (file.size > 20 * 1024 * 1024) throw new Error('이미지는 20MB 이하로 올려주세요.');
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const el = new window.Image();
          el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight });
          el.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
          el.src = URL.createObjectURL(file);
        });
        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const path = `ai-designer/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error: upErr } = await supabase.storage
          .from('user-designs')
          .upload(path, file, { contentType: file.type || 'image/png' });
        if (upErr) throw new Error('업로드에 실패했습니다. 다시 시도해 주세요.');
        const { data: pub } = supabase.storage.from('user-designs').getPublicUrl(data.path);
        setImages((prev) => {
          const next: SourceImage[] = [
            ...prev,
            { url: pub.publicUrl, path: data.path, name: file.name, origin, width: dims.w, height: dims.h },
          ];
          saveSession({ source_images: next });
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const generateAiLogo = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true); setError(null);
    try {
      const res = await fetch('/api/ai-designer/generate-logo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '이미지 생성에 실패했습니다.');
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const el = new window.Image();
        el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight });
        el.onerror = () => resolve({ w: 1024, h: 1024 });
        el.src = data.url;
      });
      setImages((prev) => {
        const next: SourceImage[] = [
          ...prev,
          { url: data.url, path: data.path, name: `AI 생성: ${aiPrompt.slice(0, 30)}`, origin: 'ai', prompt: aiPrompt, width: dims.w, height: dims.h },
        ];
        saveSession({ source_images: next });
        return next;
      });
      setAiPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 생성에 실패했습니다.');
    } finally {
      setAiGenerating(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      saveSession({ source_images: next });
      return next;
    });
    setPlacements((prev) => {
      const next = prev
        .filter((p) => p.image_index !== idx)
        .map((p) => (p.image_index > idx ? { ...p, image_index: p.image_index - 1 } : p));
      saveSession({ placements: next });
      return next;
    });
  };

  /* --- 배치 --- */
  const setSidePlacement = (sideId: string, patch: Partial<Placement> | null) => {
    setPlacements((prev) => {
      let next: Placement[];
      const existing = prev.find((p) => p.side_id === sideId);
      if (patch === null) {
        next = prev.filter((p) => p.side_id !== sideId);
      } else if (existing) {
        next = prev.map((p) => (p.side_id === sideId ? { ...p, ...patch } : p));
      } else {
        next = [
          ...prev,
          { side_id: sideId, image_index: 0, fx: 0.5, fy: 0.35, width_mm: 120, ...patch },
        ];
      }
      saveSession({ placements: next });
      setDrafts({});
      return next;
    });
  };

  const requestAiDrafts = async () => {
    if (!sessionId) return;
    setDraftLoading(true); setError(null);
    try {
      const res = await fetch('/api/ai-designer/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '초안 생성에 실패했습니다.');
      if (data.drafts) setDrafts((prev) => ({ ...prev, ...data.drafts }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '초안 생성에 실패했습니다.');
    } finally {
      setDraftLoading(false);
    }
  };

  /* --- 주문(장바구니) --- */
  const totalQty = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);

  const submitOrder = async () => {
    if (!sessionId || totalQty === 0) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/ai-designer?session=${sessionId}`)}`);
      return;
    }
    setOrdering(true); setError(null);
    try {
      // 카트 썸네일 — 4단계에서 캡처해 둔 앞면 합성 이미지
      const previewDataUrl: string | null = capturedPreview;
      const res = await fetch('/api/ai-designer/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sizeQuantities: quantities, previewDataUrl, customerNote: note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '장바구니 담기에 실패했습니다.');
      router.push('/cart');
    } catch (e) {
      setError(e instanceof Error ? e.message : '장바구니 담기에 실패했습니다.');
      setOrdering(false);
    }
  };

  /* --- 스텝 이동 가능 여부 --- */
  const canNext = (() => {
    switch (step) {
      case 0: return !!product && !!info;
      case 1: return !!color;
      case 2: return images.length > 0;
      case 3: return placements.length > 0;
      case 4: return true;
      default: return false;
    }
  })();

  const placedSides = info?.sides.filter((s) => placements.some((p) => p.side_id === s.sideId)) ?? [];

  /* ---------- 렌더 ---------- */
  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {intakeMode ? (
            <button
              onClick={() => {
                if (intakeFallback) { setIntakeFallback(false); return; }
                setIntakeMode(false); setProduct(null); setInfo(null);
              }}
              aria-label="이전"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          ) : step > 0 ? (
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} aria-label="이전">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          ) : (
            <Link href="/home" aria-label="홈으로"><ArrowLeft className="w-5 h-5 text-gray-700" /></Link>
          )}
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="font-bold text-gray-900">AI 디자이너</span>
          </div>
          {intakeMode ? (
            <span className="ml-auto text-[11px] font-semibold text-brand">{intakeFallback ? '디자이너 상담 접수' : '과잠 빌더'}</span>
          ) : (
            <div className="ml-auto flex gap-1">
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand w-6' : 'bg-gray-200 w-3'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-32">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        {/* 과잠(부위별 색상 상품) — 기본은 전용 빌더, "디자이너에게 맡기기"를 누르면 상담 접수 */}
        {intakeMode && product && info && intakeFallback && (
          <VarsityIntake
            product={{ id: product.id, title: product.title, base_price: product.base_price }}
            partLayers={info.partLayers ?? []}
            presetLayerColors={info.presetLayerColors ?? null}
            sessionId={sessionId}
            onBack={() => setIntakeFallback(false)}
          />
        )}
        {intakeMode && product && info && !intakeFallback && (
          <VarsityBuilder
            product={{ id: product.id, title: product.title, base_price: product.base_price }}
            partLayers={info.partLayers ?? []}
            presetLayerColors={info.presetLayerColors ?? null}
            sides={info.sides.map((s) => ({ sideId: s.sideId, name: s.name, geometry: s.geometry }))}
            sizeOptions={(info.product.size_options ?? []).map((s) => s.label)}
            pricing={info.pricing ?? DEFAULT_VARSITY_PRICING}
            sessionId={sessionId}
            initialState={builderInitial}
            onSaveState={(st: VarsityBuilderState) => { setBuilderInitial(st); saveSession({ builder_state: st, product_id: product.id }); }}
            onBack={() => { setIntakeMode(false); setProduct(null); setInfo(null); }}
            onFallbackIntake={() => { setIntakeFallback(true); window.scrollTo({ top: 0 }); }}
          />
        )}

        {/* STEP 0 — 상품 */}
        {step === 0 && !intakeMode && (
          <section>
            <h1 className="text-xl font-black text-gray-900">어떤 옷을 만들까요?</h1>
            <p className="text-sm text-gray-500 mt-1">
              <span className="md:hidden">사진·리뷰·가격을 한눈에 비교하고 고르면 색상과 디자인 위치를 이어서 정합니다.</span>
              <span className="hidden md:inline">의류를 고르면 색상과 디자인 위치를 이어서 정합니다.</span>
            </p>
            {/* 모바일(md 미만): /v2/mall식 리스트 / PC(md 이상): 개편 전 2열 카드 — 2026-09-03 대표 의견 */}
            <div className="md:hidden">
              <ProductPicker
                products={products}
                categories={categories}
                selectedId={product?.id ?? null}
                loadingId={infoLoading ? product?.id ?? null : null}
                onSelect={selectProduct}
              />
            </div>
            <div className="hidden md:block">
              <ProductGrid
                products={products}
                categories={categories}
                selectedId={product?.id ?? null}
                loadingId={infoLoading ? product?.id ?? null : null}
                onSelect={selectProduct}
              />
            </div>
          </section>
        )}

        {/* STEP 1 — 색상 */}
        {step === 1 && info && (
          <section>
            <h1 className="text-xl font-black text-gray-900">원단 색상을 골라주세요</h1>
            <p className="text-sm text-gray-500 mt-1">{product?.title}</p>
            <div className="grid grid-cols-4 gap-3 mt-5">
              {info.colors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setColor(c);
                    saveSession({ product_color: c });
                    setDrafts({});
                  }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition ${
                      color?.id === c.id ? 'border-brand scale-110' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {color?.id === c.id && (
                      <Check className={`w-5 h-5 ${/^#(f|e)/i.test(c.hex) ? 'text-gray-800' : 'text-white'}`} />
                    )}
                  </span>
                  <span className="text-[11px] text-gray-600 text-center leading-tight">{c.name}</span>
                </button>
              ))}
              {info.colors.length === 0 && (
                <p className="col-span-4 text-sm text-gray-500">
                  등록된 색상이 없는 상품입니다. 기본 색상으로 진행됩니다.
                </p>
              )}
            </div>
            {info.colors.length === 0 && (
              <button
                className="mt-4 text-sm text-brand font-semibold"
                onClick={() => {
                  const fallback: ColorInfo = { id: 'default', name: '기본', hex: '#FFFFFF', code: '', side_mockups: null };
                  setColor(fallback); saveSession({ product_color: fallback }); setStep(2);
                }}
              >
                기본 색상으로 계속하기
              </button>
            )}
          </section>
        )}

        {/* STEP 2 — 이미지 */}
        {step === 2 && (
          <section>
            <h1 className="text-xl font-black text-gray-900">넣을 이미지를 준비해 주세요</h1>
            <p className="text-sm text-gray-500 mt-1">
              로고·그림 파일을 올리거나, 사진을 찍거나, AI에게 만들어 달라고 해보세요.
              <br />올린 원본은 그대로 제작팀에 전달됩니다.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center gap-2 py-6 bg-white rounded-2xl border border-gray-200 hover:border-brand transition"
              >
                <ImagePlus className="w-6 h-6 text-brand" />
                <span className="text-sm font-semibold text-gray-800">이미지 올리기</span>
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center gap-2 py-6 bg-white rounded-2xl border border-gray-200 hover:border-brand transition"
              >
                <Camera className="w-6 h-6 text-brand" />
                <span className="text-sm font-semibold text-gray-800">사진 촬영</span>
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => handleFiles(e.target.files, 'upload')} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleFiles(e.target.files, 'camera')} />

            {/* AI 생성 */}
            <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-brand" />
                <span className="text-sm font-bold text-gray-900">AI로 도안 만들기</span>
                {!aiEnabled && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">준비 중</span>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder='예: "파란 방패 모양의 축구팀 엠블럼"'
                  disabled={!aiEnabled || aiGenerating}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand disabled:bg-gray-50"
                />
                <button
                  onClick={generateAiLogo}
                  disabled={!aiEnabled || aiGenerating || !aiPrompt.trim()}
                  className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-40"
                >
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : '생성'}
                </button>
              </div>
              {!aiEnabled && (
                <p className="text-[11px] text-gray-400 mt-2">AI 도안 생성은 곧 열립니다. 지금은 업로드·촬영을 이용해 주세요.</p>
              )}
            </div>

            {uploading && (
              <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중…
              </div>
            )}

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-5">
                {images.map((img, i) => (
                  <div key={img.path} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="w-full aspect-square object-contain bg-white rounded-xl border border-gray-200" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {img.origin === 'ai' && (
                      <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-brand text-white">AI</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP 3 — 배치 */}
        {step === 3 && info && (
          <section>
            <h1 className="text-xl font-black text-gray-900">어디에 넣을까요?</h1>
            <p className="text-sm text-gray-500 mt-1">면마다 이미지와 위치·크기를 고르면 바로 미리보기가 그려집니다.</p>
            <div className="space-y-5 mt-5">
              {info.sides.map((side) => {
                const placement = placements.find((p) => p.side_id === side.sideId);
                const anchorOptions = side.anchors.length > 0
                  ? side.anchors.map((a) => ({ id: a.id, label: a.label || a.id, anchor: true }))
                  : (GENERIC_POSITIONS[side.sideId] ?? GENERIC_POSITIONS.default).map((g) => ({ id: g.id, label: g.label, anchor: false }));
                return (
                  <div key={side.sideId} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{side.name}</span>
                      <label className="flex items-center gap-1.5 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={!!placement}
                          onChange={(e) => setSidePlacement(side.sideId, e.target.checked ? {} : null)}
                          className="accent-[#0052cc] w-4 h-4"
                        />
                        인쇄
                      </label>
                    </div>
                    {placement && (
                      <div className="mt-3 space-y-3">
                        <div className="flex gap-3">
                          <div className="w-32 shrink-0">
                            <SidePreview
                              side={side}
                              colorMockup={color?.side_mockups?.[side.sideId]}
                              placements={placements}
                              images={images}
                              height={160}
                            />
                          </div>
                          <div className="flex-1 space-y-3 min-w-0">
                            {images.length > 1 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1.5">이미지</p>
                                <div className="flex gap-1.5 overflow-x-auto">
                                  {images.map((img, i) => (
                                    <button
                                      key={img.path}
                                      onClick={() => setSidePlacement(side.sideId, { image_index: i })}
                                      className={`shrink-0 w-10 h-10 rounded-lg border-2 overflow-hidden bg-gray-50 ${
                                        placement.image_index === i ? 'border-brand' : 'border-gray-200'
                                      }`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={img.url} alt="" className="w-full h-full object-contain" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">위치</p>
                              <div className="flex flex-wrap gap-1.5">
                                {anchorOptions.map((opt) => {
                                  const selected = opt.anchor
                                    ? placement.anchor_id === opt.id
                                    : !placement.anchor_id && placement.fx === (GENERIC_POSITIONS[side.sideId] ?? GENERIC_POSITIONS.default).find((g) => g.id === opt.id)?.fx
                                      && placement.fy === (GENERIC_POSITIONS[side.sideId] ?? GENERIC_POSITIONS.default).find((g) => g.id === opt.id)?.fy;
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        if (opt.anchor) {
                                          const a = side.anchors.find((x) => x.id === opt.id);
                                          setSidePlacement(side.sideId, {
                                            anchor_id: opt.id, anchor_label: opt.label,
                                            width_mm: a?.recommendedWidthMm && a.recommendedWidthMm > 0 ? a.recommendedWidthMm : placement.width_mm,
                                          });
                                        } else {
                                          const g = (GENERIC_POSITIONS[side.sideId] ?? GENERIC_POSITIONS.default).find((x) => x.id === opt.id)!;
                                          setSidePlacement(side.sideId, { anchor_id: undefined, anchor_label: g.label, fx: g.fx, fy: g.fy });
                                        }
                                      }}
                                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                        selected ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">크기</p>
                              <div className="flex flex-wrap gap-1.5">
                                {SIZE_PRESETS.map((sp) => (
                                  <button
                                    key={sp.key}
                                    onClick={() => setSidePlacement(side.sideId, { width_mm: sp.widthMm })}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                      placement.width_mm === sp.widthMm ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {sp.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP 4 — 미리보기(초안) */}
        {step === 4 && info && (
          <section>
            <h1 className="text-xl font-black text-gray-900">디자인 초안이 나왔어요</h1>
            <p className="text-sm text-gray-500 mt-1">
              실제 제작 전, 전문 디자이너가 원본 이미지로 시안을 다듬어 다시 확인받습니다.
            </p>
            <div ref={previewWrapRef} className="grid grid-cols-2 gap-3 mt-5">
              {placedSides.map((side) => (
                <div key={side.sideId} className="bg-white rounded-2xl border border-gray-200 p-3">
                  <SidePreview
                    side={side}
                    colorMockup={color?.side_mockups?.[side.sideId]}
                    placements={placements}
                    images={images}
                    height={200}
                    draftUrl={drafts[side.sideId] ?? null}
                  />
                  <p className="text-center text-xs font-semibold text-gray-600 mt-2">{side.name}</p>
                </div>
              ))}
            </div>
            {aiEnabled && (
              <button
                onClick={requestAiDrafts}
                disabled={draftLoading}
                className="mt-4 w-full py-3 rounded-xl border border-brand text-brand font-semibold text-sm flex items-center justify-center gap-2"
              >
                {draftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {draftLoading ? 'AI가 실착 이미지를 그리는 중…' : 'AI 실착 이미지로 보기'}
              </button>
            )}
          </section>
        )}

        {/* STEP 5 — 수량/주문 */}
        {step === 5 && info && (
          <section>
            <h1 className="text-xl font-black text-gray-900">수량을 정해주세요</h1>
            <p className="text-sm text-gray-500 mt-1">{product?.title} · {color?.name}</p>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 mt-5">
              {(info.product.size_options ?? []).map((so) => (
                <div key={so.size_code} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-gray-800">{so.label}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantities((q) => ({ ...q, [so.label]: Math.max(0, (q[so.label] || 0) - 1) }))}
                      className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 font-bold"
                    >−</button>
                    <span className="w-8 text-center text-sm font-bold">{quantities[so.label] || 0}</span>
                    <button
                      onClick={() => setQuantities((q) => ({ ...q, [so.label]: (q[so.label] || 0) + 1 }))}
                      className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 font-bold"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="제작팀에 전달할 요청사항이 있다면 적어주세요 (선택)"
              rows={3}
              className="mt-4 w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-brand bg-white"
            />
            <div className="mt-4 px-4 py-3 rounded-2xl bg-brand-soft text-sm text-brand-ink">
              결제 전에 담당 디자이너가 원본 이미지로 시안을 정리해 확인을 도와드립니다.
              올려주신 원본 파일은 그대로 제작팀에 전달됩니다.
            </div>
          </section>
        )}
      </div>

      {/* 하단 CTA */}
      <div className={`fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)] ${intakeMode ? 'hidden' : ''}`}>
        <div className="max-w-lg mx-auto px-4 py-3">
          {step < 5 ? (
            <button
              onClick={() => {
                if (!canNext) return;
                if (step === 4) {
                  // 5단계로 넘어가면 미리보기 캔버스가 사라지므로 지금 캡처
                  const frontCanvas =
                    previewWrapRef.current?.querySelector<HTMLCanvasElement>('canvas[data-side="front"]') ??
                    previewWrapRef.current?.querySelector<HTMLCanvasElement>('canvas');
                  if (frontCanvas) {
                    try { setCapturedPreview(frontCanvas.toDataURL('image/png')); } catch { /* tainted — 무시 */ }
                  }
                }
                setStep((s) => s + 1);
              }}
              disabled={!canNext}
              className="w-full py-3.5 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2 disabled:opacity-30"
            >
              다음 <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submitOrder}
              disabled={ordering || totalQty === 0}
              className="w-full py-3.5 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2 disabled:opacity-30"
            >
              {ordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {isAuthenticated
                ? `장바구니 담기${totalQty > 0 ? ` (${totalQty}벌)` : ''}`
                : '로그인하고 장바구니 담기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
