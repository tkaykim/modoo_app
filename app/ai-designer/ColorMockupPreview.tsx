'use client';

/**
 * 색상 단계 미리보기 — 고른 원단 색을 목업에 입혀 보여준다(에디터와 같은 multiply 합성).
 * 면 전환 탭(앞면/뒷면 등) 포함. 색상별 실사 목업(side_mockups)이 있으면 그 이미지를 그대로 쓴다.
 */

import React, { useEffect, useRef, useState } from 'react';
import { computeSideScale, type SideGeometry } from '@/lib/aiDesigner/placement';
import { loadImage } from '@/lib/aiDesigner/varsityPreview';
import { tintImage } from '@/lib/aiDesigner/mockupTint';

export interface PreviewSide {
  sideId: string;
  name: string;
  mockupUrl: string;
  geometry: SideGeometry;
}

export interface PreviewColor {
  id: string;
  name: string;
  hex: string;
  side_mockups: Record<string, string> | null;
}

export default function ColorMockupPreview({
  sides,
  color,
  height = 280,
}: {
  sides: PreviewSide[];
  color: PreviewColor | null;
  height?: number;
}) {
  const [activeId, setActiveId] = useState<string | undefined>(
    () => sides.find((s) => s.sideId === 'front')?.sideId ?? sides[0]?.sideId
  );
  const side = sides.find((s) => s.sideId === activeId) ?? sides[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!side) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let cancelled = false;
    const W = 400, H = 500, dpr = 2;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const override = color?.side_mockups?.[side.sideId] || null;
    const src = override || side.mockupUrl;
    loadImage(src)
      .then((img) => {
        if (cancelled) return;
        ctx.clearRect(0, 0, W, H);
        const geo = side.geometry;
        const s = computeSideScale(geo);
        // 실사 색상 목업이면 그대로, 아니면 흰 목업에 색을 입힌다(에디터 BlendColor multiply와 동일)
        const source = override || !color ? img : tintImage(img, color.hex);
        ctx.drawImage(
          source,
          (W - geo.imgW * s.scale) / 2, (H - geo.imgH * s.scale) / 2,
          geo.imgW * s.scale, geo.imgH * s.scale
        );
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [side, color]);

  if (!side) return null;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-3"
      data-testid="color-mockup-preview"
      data-color={color?.hex ?? ''}
      data-side={side.sideId}
      data-status={status}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl bg-gray-50"
          style={{ height, objectFit: 'contain' }}
          aria-label={`${side.name} 미리보기${color ? ` · ${color.name}` : ''}`}
        />
        {!color && (
          <p className="absolute inset-x-0 bottom-2 text-center text-[11px] text-gray-400">색상을 고르면 바로 입혀집니다</p>
        )}
        {status === 'error' && (
          <p className="absolute inset-x-0 bottom-2 text-center text-[11px] text-red-400">목업 이미지를 불러오지 못했습니다</p>
        )}
      </div>
      {sides.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {sides.map((s) => (
            <button
              key={s.sideId}
              type="button"
              onClick={() => setActiveId(s.sideId)}
              aria-pressed={s.sideId === side.sideId}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                s.sideId === side.sideId ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {color && (
        <p className="mt-2 text-center text-xs text-gray-600">
          <span className="inline-block w-3 h-3 rounded-full border border-gray-300 align-middle mr-1" style={{ backgroundColor: color.hex }} />
          {color.name}
        </p>
      )}
    </div>
  );
}
