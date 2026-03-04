'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ProductConfig } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';

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
  /** When true, fills the parent container (absolute inset-0). Otherwise uses fixed height. */
  fullscreen?: boolean;
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
  fullscreen = false,
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
  const sides = config.sides || [];

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

  // ── Store initialization ──
  useEffect(() => {
    setEditMode(false);
    setProductColor(productColor || '#FFFFFF');
    if (sides.length > 0) setActiveSide(sides[0].id);
  }, [config.productId, productColor, setEditMode, setProductColor, setActiveSide, sides]);

  useEffect(() => { setHasRestored(false); }, [parsedCanvasState, config.productId]);

  useEffect(() => {
    if (hasRestored || !parsedCanvasState || !sides.length) return;
    // Wait for all canvases to be registered AND their product images to be loaded
    // so that clip paths and print area positions are correctly calculated
    const ready = sides.every(s => canvasMap[s.id] && imageLoadedMap[s.id]);
    if (!ready) {
      console.log('[DesignEditorViewer] Waiting for canvases/images...', {
        sides: sides.map(s => s.id),
        canvasReady: sides.map(s => !!canvasMap[s.id]),
        imageReady: sides.map(s => !!imageLoadedMap[s.id]),
      });
      return;
    }

    const restore = async () => {
      try {
        // Log canvas state info for debugging
        const sideEntries = Object.entries(parsedCanvasState);
        console.log('[DesignEditorViewer] Restoring design:', {
          sideCount: sideEntries.length,
          sides: sideEntries.map(([id, val]) => {
            const data = typeof val === 'string' ? JSON.parse(val) : val;
            return { id, objectCount: data?.objects?.length ?? 0 };
          }),
        });

        await new Promise(r => setTimeout(r, 150));
        await restoreAllCanvasState(parsedCanvasState);
        Object.values(canvasMap).forEach(c => c.requestRenderAll());
        incrementCanvasVersion();
        setHasRestored(true);
        console.log('[DesignEditorViewer] Restore complete');
      } catch (e) {
        console.error('Failed to restore design:', e);
      }
    };
    restore();
  }, [canvasMap, imageLoadedMap, sides, hasRestored, parsedCanvasState, restoreAllCanvasState, incrementCanvasVersion]);

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
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-700'
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
