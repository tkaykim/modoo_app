'use client';

import { useState, useRef, useEffect, useMemo, useCallback, useId } from 'react';
import dynamic from 'next/dynamic';
import { ProductConfig } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useFontStore } from '@/store/useFontStore';
import { preloadSystemFonts } from '@/lib/ensureFonts';
import { FontMetadata } from '@/lib/fontUtils';

const SingleSideCanvas = dynamic(() => import('@/app/components/canvas/SingleSideCanvas'), {
  ssr: false,
  loading: () => <div className="w-[400px] h-[500px] bg-neutral-600 animate-pulse rounded-lg" />,
});

// Match admin EditorCanvas dimensions
const CANVAS_W = 400;
const CANVAS_H = 500;
const GAP = 24;
const LABEL_H = 24;
const FIT_PADDING = 60;

interface DesignEditorViewerProps {
  config: ProductConfig;
  canvasState: Record<string, string>;
  productColor: string;
  /** 디자인이 사용하는 커스텀 업로드 폰트. 복원 전에 등록·로드해 폰트깨짐을 방지한다. */
  customFonts?: FontMetadata[];
  /** When true, fills the parent container (absolute inset-0). Otherwise uses fixed height. */
  fullscreen?: boolean;
  /** 'grid'(기본, 줌/팬 그리드) | 'carousel'(면별 탭+스와이프, 모바일 친화) */
  layout?: 'grid' | 'carousel';
}

/**
 * Read-only editor viewer that mirrors the admin EditorCanvas layout.
 * Shows all product sides in a grid with full zoom/pan controls:
 * - Scroll wheel zoom toward cursor
 * - Space+drag panning
 * - Middle-click panning
 * - Touch pinch-to-zoom and two-finger pan
 */
export default function DesignEditorViewer({
  config,
  canvasState,
  productColor,
  customFonts,
  fullscreen = false,
  layout = 'grid',
}: DesignEditorViewerProps) {
  const {
    activeSideId,
    setActiveSide,
    setEditMode,
    setProductColor,
    canvasMap,
    imageLoadedMap,
    restoreAllCanvasState,
    incrementCanvasVersion,
  } = useCanvasStore();

  const [hasRestored, setHasRestored] = useState(false);
  // 한 페이지에 디자인이 여러 개면(시안 2건+) 각 뷰어가 같은 side.id(front/back…)로
  // 전역 캔버스 스토어에 등록돼 키가 충돌한다 — 마지막 등록 디자인만 살아남고 나머지는
  // 디자인이 안 그려진 '빈 티셔츠'로 남는다. 인스턴스별 고유 접두사로 side.id를
  // 네임스페이스해 충돌을 제거한다. (registerCanvas/imageLoadedMap/restore 모두 이 id를 사용)
  const instanceNs = useId();
  const originalSides = config.sides || [];
  const sides = useMemo(
    () => originalSides.map((s) => ({ ...s, id: `${instanceNs}__${s.id}` })),
    [originalSides, instanceNs]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const middlePanRef = useRef(false);

  // Touch gesture state
  const touchesRef = useRef<{ id: number; x: number; y: number }[]>([]);
  const lastPinchDist = useRef<number>(0);

  // Grid dimensions
  const cols = sides.length > 1 ? 2 : 1;
  const rows = Math.ceil(sides.length / cols);
  const gridW = cols * CANVAS_W + (cols - 1) * GAP;
  const gridH = rows * (CANVAS_H + LABEL_H) + (rows - 1) * GAP;

  const parsedCanvasState = useMemo(() => {
    if (!canvasState) return null;
    if (typeof canvasState === 'string') {
      try { return JSON.parse(canvasState) as Record<string, string>; } catch { return null; }
    }
    return canvasState;
  }, [canvasState]);

  // canvasState 는 원본 side.id(front/back…) 키 → 네임스페이스된 side.id 로 재매핑해
  // 등록된 캔버스(네임스페이스 키)와 복원 대상이 일치하게 한다.
  const nsCanvasState = useMemo(() => {
    if (!parsedCanvasState) return null;
    const src = parsedCanvasState as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const s of originalSides) {
      const v = src[s.id];
      if (v !== undefined) out[`${instanceNs}__${s.id}`] = v;
    }
    return out as Record<string, string>;
  }, [parsedCanvasState, originalSides, instanceNs]);

  // ── Store initialization ──
  useEffect(() => {
    setEditMode(false);
    setProductColor(productColor || '#FFFFFF');
    if (sides.length > 0) setActiveSide(sides[0].id);
  }, [config.productId, productColor, setEditMode, setProductColor, setActiveSide, sides]);

  // 복원 데드라인: 모든 면 준비를 무한정 기다리지 않는다. 일정 시간 내에
  // 게이트가 안 풀려도(목업 한 장이 느리거나 죽어도) 등록된 캔버스로 복원을 강행해
  // '빈 티셔츠'(디자인이 영영 안 뜨는) 상태를 막는다.
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  useEffect(() => {
    setDeadlinePassed(false);
    const t = setTimeout(() => setDeadlinePassed(true), 6000);
    return () => clearTimeout(t);
  }, [nsCanvasState, config.productId]);

  useEffect(() => { setHasRestored(false); }, [nsCanvasState, config.productId]);

  useEffect(() => {
    if (hasRestored || !nsCanvasState || !sides.length) return;
    // Wait for all canvases to be registered AND their product images to be loaded
    // so that clip paths and print area positions are correctly calculated.
    // 단, 데드라인이 지나면 최소한 캔버스가 등록된 면만이라도 복원을 진행한다.
    const allReady = sides.every(s => canvasMap[s.id] && imageLoadedMap[s.id]);
    const anyCanvas = sides.some(s => canvasMap[s.id]);
    if (!allReady && !(deadlinePassed && anyCanvas)) {
      console.log('[DesignEditorViewer] Waiting for canvases/images...', {
        sides: sides.map(s => s.id),
        canvasReady: sides.map(s => !!canvasMap[s.id]),
        imageReady: sides.map(s => !!imageLoadedMap[s.id]),
        deadlinePassed,
      });
      return;
    }
    if (!allReady) {
      console.warn('[DesignEditorViewer] Restoring after deadline without all sides ready', {
        canvasReady: sides.map(s => !!canvasMap[s.id]),
        imageReady: sides.map(s => !!imageLoadedMap[s.id]),
      });
    }

    const restore = async () => {
      try {
        // Log canvas state info for debugging
        const sideEntries = Object.entries(nsCanvasState);
        console.log('[DesignEditorViewer] Restoring design:', {
          sideCount: sideEntries.length,
          sides: sideEntries.map(([id, val]) => {
            const data = typeof val === 'string' ? JSON.parse(val) : val;
            return { id, objectCount: data?.objects?.length ?? 0 };
          }),
        });

        await new Promise(r => setTimeout(r, 150));
        // 폰트깨짐 방지: 디자인이 쓰는 커스텀 업로드 폰트를 먼저 등록·로드한 뒤 복원.
        // (restoreAllCanvasState 내부 ensureFontsLoaded 는 이미 등록된 FontFace 만 보장하므로,
        //  업로드 폰트는 여기서 setCustomFonts+loadAllFonts 로 먼저 등록해야 함.)
        if (customFonts && customFonts.length > 0) {
          useFontStore.getState().setCustomFonts(customFonts);
          await useFontStore.getState().loadAllFonts();
        }
        await preloadSystemFonts();
        await restoreAllCanvasState(nsCanvasState);
        Object.values(canvasMap).forEach(c => c.requestRenderAll());
        incrementCanvasVersion();
        setHasRestored(true);
        console.log('[DesignEditorViewer] Restore complete');
      } catch (e) {
        console.error('Failed to restore design:', e);
      }
    };
    restore();
  }, [canvasMap, imageLoadedMap, sides, hasRestored, nsCanvasState, restoreAllCanvasState, incrementCanvasVersion, customFonts, deadlinePassed]);

  // ── Fit grid centered in container ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el || sides.length === 0) return;

    const rect = el.getBoundingClientRect();
    const sx = (rect.width - FIT_PADDING * 2) / gridW;
    const sy = (rect.height - FIT_PADDING * 2) / gridH;
    const scale = Math.min(sx, sy, 1);

    setView({
      x: (rect.width - gridW * scale) / 2,
      y: (rect.height - gridH * scale) / 2,
      scale,
    });
  }, [sides.length, gridW, gridH]);

  // ── Space key for pan mode ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { setSpaceHeld(false); setIsPanning(false); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Block pointer events on content while panning
  useEffect(() => {
    const el = contentRef.current;
    if (el) el.style.pointerEvents = (spaceHeld || (isPanning && middlePanRef.current)) ? 'none' : 'auto';
  }, [spaceHeld, isPanning]);

  // Prevent default middle-click auto-scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('mousedown', prevent);
    return () => el.removeEventListener('mousedown', prevent);
  }, []);

  // ── Pointer handlers for panning (Space+drag or middle mouse) ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const isMiddle = e.button === 1;
    if (!spaceHeld && !isMiddle) return;
    if (isMiddle) { e.preventDefault(); middlePanRef.current = true; }
    setIsPanning(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [spaceHeld]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, [isPanning]);

  const onPointerUp = useCallback(() => {
    setIsPanning(false);
    middlePanRef.current = false;
  }, []);

  // ── Wheel zoom toward cursor ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      setView(prev => {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        const ns = Math.max(0.1, Math.min(5, prev.scale * factor));
        return {
          x: cx - (cx - prev.x) * (ns / prev.scale),
          y: cy - (cy - prev.y) * (ns / prev.scale),
          scale: ns,
        };
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Touch pinch-to-zoom and two-finger pan ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        touchesRef.current = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && touchesRef.current.length >= 2) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();

        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDist = Math.sqrt(dx * dx + dy * dy);

          if (lastPinchDist.current > 0) {
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
            const scaleFactor = newDist / lastPinchDist.current;

            setView(prev => {
              const ns = Math.max(0.1, Math.min(5, prev.scale * scaleFactor));
              return {
                x: centerX - (centerX - prev.x) * (ns / prev.scale),
                y: centerY - (centerY - prev.y) * (ns / prev.scale),
                scale: ns,
              };
            });
          }
          lastPinchDist.current = newDist;
        }

        const currentTouches = Array.from(e.touches).slice(0, 2).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
        const prevCX = (touchesRef.current[0].x + touchesRef.current[1].x) / 2;
        const prevCY = (touchesRef.current[0].y + touchesRef.current[1].y) / 2;
        const currCX = (currentTouches[0].x + currentTouches[1].x) / 2;
        const currCY = (currentTouches[0].y + currentTouches[1].y) / 2;

        setView(v => ({ ...v, x: v.x + (currCX - prevCX), y: v.y + (currCY - prevCY) }));
        touchesRef.current = currentTouches;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) { touchesRef.current = []; lastPinchDist.current = 0; }
      else { touchesRef.current = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY })); }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Carousel 모드 (모바일 친화): 면별 탭 + 좌우 스와이프 + dot. 캔버스는 400x500 원좌표 유지 후 CSS 스케일.
  // ──────────────────────────────────────────────────────────────
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carIdx, setCarIdx] = useState(0);
  const [cscale, setCscale] = useState(0.7);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback((i: number) => {
    const n = sides.length;
    if (n === 0) return;
    const clamped = Math.max(0, Math.min(n - 1, i));
    setCarIdx(clamped);
    if (sides[clamped]) setActiveSide(sides[clamped].id);
  }, [sides, setActiveSide]);

  useEffect(() => {
    if (layout !== 'carousel') return;
    const measure = () => {
      const el = carouselRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const availW = r.width - 24;        // 좌우 여백
      const availH = r.height - 118;      // 탭+dot+안내 영역
      const s = Math.min(availW / CANVAS_W, availH / CANVAS_H);
      setCscale(Math.max(0.35, Math.min(1.4, s)));
    };
    measure();
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 200); // 모달 애니메이션 후 재측정
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); };
  }, [layout, sides.length, fullscreen]);

  if (layout === 'carousel') {
    return (
      <div
        ref={carouselRef}
        className={`${fullscreen ? 'absolute inset-0' : 'relative w-full'} flex flex-col bg-neutral-100`}
        style={fullscreen ? {} : { height: Math.min(620, Math.round(CANVAS_H * cscale) + 130) }}
      >
        {/* 면 탭 */}
        <div className="flex gap-2 px-3 pt-3 pb-1 overflow-x-auto shrink-0 justify-center flex-wrap">
          {sides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                i === carIdx ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 border border-neutral-300'
              }`}
            >{s.name}</button>
          ))}
        </div>
        {/* 스와이프 트랙 */}
        <div
          className="flex-1 overflow-hidden relative"
          onTouchStart={(e) => { swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            const s = swipeStart.current;
            swipeStart.current = null;
            if (!s) return;
            const dx = e.changedTouches[0].clientX - s.x;
            const dy = e.changedTouches[0].clientY - s.y;
            // 가로 스와이프만 면 전환. 세로 우세하면 무시(페이지 스크롤로 통과).
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
              if (dx > 0) goTo(carIdx - 1); else goTo(carIdx + 1);
            }
          }}
        >
          <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${carIdx * 100}%)` }}>
            {sides.map(side => (
              <div key={side.id} className="w-full shrink-0 h-full flex items-center justify-center">
                <div style={{ width: CANVAS_W * cscale, height: CANVAS_H * cscale }}>
                  <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${cscale})`, transformOrigin: 'top left' }}>
                    <SingleSideCanvas side={side} width={CANVAS_W} height={CANVAS_H} isEdit={false} productColor={productColor} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* 좌우 화살표 (1면 초과일 때) */}
          {sides.length > 1 && (
            <>
              <button onClick={() => goTo(carIdx - 1)} disabled={carIdx === 0}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow text-neutral-700 text-lg disabled:opacity-30 flex items-center justify-center">‹</button>
              <button onClick={() => goTo(carIdx + 1)} disabled={carIdx === sides.length - 1}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow text-neutral-700 text-lg disabled:opacity-30 flex items-center justify-center">›</button>
            </>
          )}
        </div>
        {/* dot 인디케이터 */}
        <div className="flex justify-center items-center gap-1.5 pt-2 shrink-0">
          {sides.map((s, i) => (
            <button key={s.id} onClick={() => goTo(i)} aria-label={s.name}
              className={`h-2 rounded-full transition-all ${i === carIdx ? 'w-5 bg-neutral-900' : 'w-2 bg-neutral-300'}`} />
          ))}
        </div>
        <div className="text-center text-[11px] text-neutral-400 py-2 shrink-0">탭 또는 좌우로 넘겨 각 면을 확인하세요</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${fullscreen ? 'absolute inset-0' : 'relative w-full rounded-lg'} bg-neutral-700 overflow-hidden`}
      style={{
        ...(fullscreen ? {} : { height: Math.min(500, gridH + FIT_PADDING * 2) }),
        cursor: isPanning ? 'grabbing' : spaceHeld ? 'grab' : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${CANVAS_W}px)`,
            gap: `${GAP}px`,
          }}
        >
          {sides.map(side => {
            const isActive = side.id === activeSideId;
            return (
              <div key={side.id} onClick={() => setActiveSide(side.id)} className="cursor-pointer">
                <div className={`text-[11px] font-semibold mb-1 px-1 ${isActive ? 'text-blue-400' : 'text-neutral-400'}`}>
                  {side.name}
                </div>
                <div className={`rounded-lg transition-shadow ${
                  isActive
                    ? 'ring-2 ring-brand ring-offset-2 ring-offset-neutral-700'
                    : 'ring-1 ring-neutral-600'
                }`}>
                  <SingleSideCanvas
                    side={side}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    isEdit={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
