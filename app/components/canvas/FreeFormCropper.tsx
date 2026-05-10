'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

const OUTPUT_LONG_EDGE = 1600;
const PREVIEW_MAX = 360;
const HANDLE = 12;
const MIN_BOX = 32;

interface Props {
  file: File;
  isOpen: boolean;
  title?: string;
  onConfirm: (cropped: File) => void;
  onSkip: () => void;
  onCancel: () => void;
}

type DragMode =
  | { kind: 'none' }
  | { kind: 'move'; startX: number; startY: number; box: Box }
  | { kind: 'resize'; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; box: Box };

type Box = { x: number; y: number; w: number; h: number };

const FreeFormCropper: React.FC<Props> = ({ file, isOpen, title, onConfirm, onSkip, onCancel }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<DragMode>({ kind: 'none' });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const im = new Image();
    im.onload = () => {
      setImgDims({ w: im.naturalWidth, h: im.naturalHeight });
      const scale = Math.min(PREVIEW_MAX / im.naturalWidth, PREVIEW_MAX / im.naturalHeight, 1);
      const pw = Math.round(im.naturalWidth * scale);
      const ph = Math.round(im.naturalHeight * scale);
      setPreviewDims({ w: pw, h: ph });
      setBox({ x: 0, y: 0, w: pw, h: ph });
    };
    im.onerror = () => setError('이미지를 불러오지 못했습니다.');
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewToImage = useMemo(() => {
    if (!previewDims || !imgDims) return 1;
    return imgDims.w / previewDims.w;
  }, [previewDims, imgDims]);

  const onPointerDownBox = (e: React.PointerEvent) => {
    if (!box) return;
    e.stopPropagation();
    dragRef.current = { kind: 'move', startX: e.clientX, startY: e.clientY, box: { ...box } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerDownHandle = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    if (!box) return;
    e.stopPropagation();
    dragRef.current = { kind: 'resize', corner, startX: e.clientX, startY: e.clientY, box: { ...box } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const m = dragRef.current;
    if (m.kind === 'none' || !box || !previewDims) return;
    const dx = e.clientX - m.startX;
    const dy = e.clientY - m.startY;
    if (m.kind === 'move') {
      let nx = m.box.x + dx;
      let ny = m.box.y + dy;
      nx = Math.max(0, Math.min(previewDims.w - m.box.w, nx));
      ny = Math.max(0, Math.min(previewDims.h - m.box.h, ny));
      setBox({ x: nx, y: ny, w: m.box.w, h: m.box.h });
      return;
    }
    if (m.kind === 'resize') {
      let { x, y, w, h } = m.box;
      const right = m.box.x + m.box.w;
      const bottom = m.box.y + m.box.h;
      if (m.corner === 'nw') {
        x = Math.max(0, Math.min(right - MIN_BOX, m.box.x + dx));
        y = Math.max(0, Math.min(bottom - MIN_BOX, m.box.y + dy));
        w = right - x;
        h = bottom - y;
      } else if (m.corner === 'ne') {
        y = Math.max(0, Math.min(bottom - MIN_BOX, m.box.y + dy));
        h = bottom - y;
        w = Math.max(MIN_BOX, Math.min(previewDims.w - x, m.box.w + dx));
      } else if (m.corner === 'sw') {
        x = Math.max(0, Math.min(right - MIN_BOX, m.box.x + dx));
        w = right - x;
        h = Math.max(MIN_BOX, Math.min(previewDims.h - y, m.box.h + dy));
      } else {
        w = Math.max(MIN_BOX, Math.min(previewDims.w - x, m.box.w + dx));
        h = Math.max(MIN_BOX, Math.min(previewDims.h - y, m.box.h + dy));
      }
      setBox({ x, y, w, h });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = { kind: 'none' };
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const renderCropped = async (): Promise<File | null> => {
    if (!imgUrl || !imgDims || !box || !previewDims) return null;
    const sx = Math.round(box.x * previewToImage);
    const sy = Math.round(box.y * previewToImage);
    const sw = Math.round(box.w * previewToImage);
    const sh = Math.round(box.h * previewToImage);
    const longEdge = Math.max(sw, sh);
    const scale = longEdge > OUTPUT_LONG_EDGE ? OUTPUT_LONG_EDGE / longEdge : 1;
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const im = new Image();
    await new Promise<void>((resolve, reject) => {
      im.onload = () => resolve();
      im.onerror = reject;
      im.src = imgUrl;
    });
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, outW, outH);
    return await new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        resolve(new File([blob], `${baseName}-crop.png`, { type: 'image/png' }));
      }, 'image/png', 0.95);
    });
  };

  const handleConfirm = async () => {
    setError(null);
    const cropped = await renderCropped();
    if (!cropped) {
      setError('이미지 처리에 실패했습니다.');
      return;
    }
    onConfirm(cropped);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 py-3.5 flex items-center justify-between border-b border-gray-200">
          <h3 className="text-base font-semibold">{title ?? '영역 선택'}</h3>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100" aria-label="닫기">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-xs text-gray-500">
            드래그로 사용할 영역을 지정하세요. 모서리를 끌어 크기를 조절할 수 있어요.
          </p>
          {imgUrl && previewDims && box && (
            <div className="flex flex-col items-center gap-4">
              <div
                ref={containerRef}
                className="relative bg-gray-100 select-none touch-none"
                style={{ width: previewDims.w, height: previewDims.h }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt="crop preview"
                  draggable={false}
                  style={{ width: previewDims.w, height: previewDims.h, display: 'block', pointerEvents: 'none' }}
                />
                {/* dim outside */}
                <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `0 0 0 9999px rgba(0,0,0,0.35)`, clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.x}px ${box.y}px, ${box.x}px ${box.y + box.h}px, ${box.x + box.w}px ${box.y + box.h}px, ${box.x + box.w}px ${box.y}px, ${box.x}px ${box.y}px)` }} />
                {/* crop box */}
                <div
                  className="absolute border-2 border-white"
                  style={{ left: box.x, top: box.y, width: box.w, height: box.h, cursor: 'move' }}
                  onPointerDown={onPointerDownBox}
                >
                  {(['nw','ne','sw','se'] as const).map((c) => (
                    <div
                      key={c}
                      onPointerDown={onPointerDownHandle(c)}
                      className="absolute bg-white border border-gray-700"
                      style={{
                        width: HANDLE,
                        height: HANDLE,
                        left: c.includes('w') ? -HANDLE / 2 : box.w - HANDLE / 2,
                        top: c.startsWith('n') ? -HANDLE / 2 : box.h - HANDLE / 2,
                        cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-500 self-start">{error}</p>}

              <div className="flex gap-2 w-full">
                <button
                  onClick={onSkip}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                >
                  원본 그대로
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreeFormCropper;
