'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface SideInfo {
  id: string;
  name: string;
  imageUrl?: string;
  printArea: { x: number; y: number; width: number; height: number };
  layers?: Array<{ id: string; imageUrl: string; zIndex: number }>;
  zoomScale?: number;
}

interface DesignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  designTitle: string | null;
  sides: SideInfo[];
  canvasState: Record<string, string> | null;
  productColor?: string;
  fallbackImageUrl?: string;
}

const RENDER_SIZE = 500;

export default function DesignPreviewModal({
  isOpen,
  onClose,
  productTitle,
  designTitle,
  sides,
  canvasState,
  productColor,
  fallbackImageUrl,
}: DesignPreviewModalProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isRendering, setIsRendering] = useState(false);
  const [activeSideIndex, setActiveSideIndex] = useState(0);
  const fabricRef = useRef<typeof import('fabric') | null>(null);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const sidesWithDesign = sides.filter(
    (s) => canvasState && canvasState[s.id]
  );
  const displaySides = sidesWithDesign.length > 0 ? sidesWithDesign : sides;

  const renderSidePreviews = useCallback(async () => {
    if (!canvasState || displaySides.length === 0) return;
    setIsRendering(true);

    try {
      if (!fabricRef.current) {
        fabricRef.current = await import('fabric');
      }
      const fabric = fabricRef.current;

      // Also register CurvedText class for deserialization
      try {
        await import('@/lib/curvedText');
      } catch {
        // CurvedText not critical, continue
      }

      const newPreviews: Record<string, string> = {};

      for (const side of displaySides) {
        const stateJson = canvasState[side.id];
        if (!stateJson) continue;

        try {
          const parsed =
            typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson;
          const objects = parsed?.objects || [];
          if (objects.length === 0) continue;

          const canvasEl = document.createElement('canvas');
          canvasEl.width = RENDER_SIZE;
          canvasEl.height = RENDER_SIZE;
          const canvas = new fabric.StaticCanvas(canvasEl, {
            width: RENDER_SIZE,
            height: RENDER_SIZE,
            backgroundColor: '#EBEBEB',
          });

          // Load mockup image (first layer or side.imageUrl)
          const mockupUrl =
            side.layers && side.layers.length > 0
              ? [...side.layers].sort((a, b) => a.zIndex - b.zIndex)[0]
                  ?.imageUrl
              : side.imageUrl;

          if (mockupUrl) {
            try {
              const bgImg = await fabric.FabricImage.fromURL(mockupUrl, {
                crossOrigin: 'anonymous',
              });
              const imgW = bgImg.width || 1;
              const imgH = bgImg.height || 1;
              const zoomScale = side.zoomScale || 1.0;
              const baseScale = Math.min(
                RENDER_SIZE / imgW,
                RENDER_SIZE / imgH
              );
              const scale = baseScale * zoomScale;

              bgImg.set({
                scaleX: scale,
                scaleY: scale,
                originX: 'center',
                originY: 'center',
                left: RENDER_SIZE / 2,
                top: RENDER_SIZE / 2,
                selectable: false,
                evented: false,
              });

              if (productColor) {
                bgImg.filters = [
                  new fabric.filters.BlendColor({
                    color: productColor,
                    mode: 'multiply',
                    alpha: 1,
                  }),
                ];
                bgImg.applyFilters();
              }

              canvas.add(bgImg);

              // Load additional layers
              if (side.layers && side.layers.length > 1) {
                const sortedLayers = [...side.layers].sort(
                  (a, b) => a.zIndex - b.zIndex
                );
                for (let i = 1; i < sortedLayers.length; i++) {
                  try {
                    const layerImg = await fabric.FabricImage.fromURL(
                      sortedLayers[i].imageUrl,
                      { crossOrigin: 'anonymous' }
                    );
                    layerImg.set({
                      scaleX: scale,
                      scaleY: scale,
                      originX: 'center',
                      originY: 'center',
                      left: RENDER_SIZE / 2,
                      top: RENDER_SIZE / 2,
                      selectable: false,
                      evented: false,
                    });
                    canvas.add(layerImg);
                  } catch {
                    // Skip failed layer
                  }
                }
              }

              const enlivenedObjects = await fabric.util.enlivenObjects(objects);
              for (const obj of enlivenedObjects) {
                const fObj = obj as InstanceType<typeof fabric.FabricObject>;
                fObj.set({ selectable: false, evented: false });
                canvas.add(fObj);
              }
            } catch {
              const enlivenedObjects = await fabric.util.enlivenObjects(objects);
              for (const obj of enlivenedObjects) {
                const fObj = obj as InstanceType<typeof fabric.FabricObject>;
                fObj.set({ selectable: false, evented: false });
                canvas.add(fObj);
              }
            }
          } else {
            const enlivenedObjects = await fabric.util.enlivenObjects(objects);
            for (const obj of enlivenedObjects) {
              const fObj = obj as InstanceType<typeof fabric.FabricObject>;
              fObj.set({ selectable: false, evented: false });
              canvas.add(fObj);
            }
          }

          canvas.renderAll();
          const dataUrl = canvas.toDataURL({
            format: 'png',
            quality: 0.9,
            multiplier: 1,
          });
          newPreviews[side.id] = dataUrl;
          canvas.dispose();
        } catch (err) {
          console.error(`Failed to render side ${side.id}:`, err);
        }
      }

      setPreviews(newPreviews);
    } catch (err) {
      console.error('Failed to load fabric.js:', err);
    } finally {
      setIsRendering(false);
    }
  }, [canvasState, displaySides, productColor]);

  useEffect(() => {
    if (isOpen && Object.keys(previews).length === 0) {
      renderSidePreviews();
    }
  }, [isOpen, renderSidePreviews, previews]);

  useEffect(() => {
    if (!isOpen) {
      setPreviews({});
      setActiveSideIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')
        setActiveSideIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight')
        setActiveSideIndex((i) => Math.min(displaySides.length - 1, i + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, displaySides.length]);

  if (!isOpen) return null;

  const activeSide = displaySides[activeSideIndex] ?? null;
  const hasRenderedPreviews = Object.keys(previews).length > 0;
  const useFallback = !hasRenderedPreviews && !isRendering && !!fallbackImageUrl;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-[90vw] max-h-[90vh] w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {productTitle}
            </h3>
            {designTitle && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {designTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="relative bg-gray-100">
          {isRendering ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm text-gray-500">
                디자인을 불러오는 중...
              </p>
            </div>
          ) : activeSide && previews[activeSide.id] ? (
            <div
              className="relative"
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
              }}
              onTouchEnd={(e) => {
                if (!touchStartRef.current || displaySides.length <= 1) return;
                const touch = e.changedTouches[0];
                const dx = touch.clientX - touchStartRef.current.x;
                const dy = touch.clientY - touchStartRef.current.y;
                touchStartRef.current = null;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                  if (dx < 0) setActiveSideIndex((i) => Math.min(displaySides.length - 1, i + 1));
                  else setActiveSideIndex((i) => Math.max(0, i - 1));
                }
              }}
            >
              <img
                src={previews[activeSide.id]}
                alt={activeSide.name}
                className="w-full aspect-square object-contain"
              />
              {displaySides.length > 1 && (
                <>
                  {activeSideIndex > 0 && (
                    <button
                      onClick={() =>
                        setActiveSideIndex((i) => Math.max(0, i - 1))
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 shadow-md hover:bg-white transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700" />
                    </button>
                  )}
                  {activeSideIndex < displaySides.length - 1 && (
                    <button
                      onClick={() =>
                        setActiveSideIndex((i) =>
                          Math.min(displaySides.length - 1, i + 1)
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 shadow-md hover:bg-white transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-700" />
                    </button>
                  )}
                </>
              )}
            </div>
          ) : useFallback ? (
            <div className="p-4">
              <img
                src={fallbackImageUrl}
                alt={productTitle}
                className="w-full aspect-square object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">
                미리보기를 불러올 수 없습니다
              </p>
            </div>
          )}
        </div>

        {/* Side tabs */}
        {hasRenderedPreviews && displaySides.length > 1 && (
          <div className="flex border-t">
            {displaySides.map((side, idx) => (
              <button
                key={side.id}
                onClick={() => setActiveSideIndex(idx)}
                className={`flex-1 py-3 text-xs font-medium transition-colors ${
                  idx === activeSideIndex
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {side.name}
              </button>
            ))}
          </div>
        )}

        {/* Single side name */}
        {hasRenderedPreviews && displaySides.length === 1 && activeSide && (
          <div className="text-center py-2.5 border-t">
            <span className="text-xs font-medium text-gray-500">
              {activeSide.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
