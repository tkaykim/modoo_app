/**
 * 과잠 빌더 — 브라우저 캔버스 미리보기 (클라이언트 전용).
 *
 * 레이어 PNG(몸통·팔·단추·쉬보리)를 선택 색으로 물들이고(에디터의 multiply 필터와 같은 원리)
 * 그 위에 슬롯 텍스트·이미지를 그린다. 좌표계는 에디터 캔버스(400×500)와 동일하며,
 * 서버(varsity-order)가 canvas_state를 만들 때와 같은 computeSideScale 수학을 쓴다.
 */

import { EDITOR_CANVAS_H, EDITOR_CANVAS_W, computeSideScale, type SideGeometry } from './placement';
import type { PartLayerSide } from './catalogTypes';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
    img.src = url;
  });
  imageCache.set(url, p);
  p.catch(() => imageCache.delete(url));
  return p;
}

export interface PreviewTextSlot {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  curveIntensity: number;
  charSpacing: number;
}

export interface PreviewImageSlot {
  kind: 'image';
  x: number;
  y: number;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  targetWidth: number;
}

export type PreviewSlot = PreviewTextSlot | PreviewImageSlot;

export function buildFont(fontFamily: string, fontSize: number, bold = true): string {
  return `${bold ? 'bold ' : ''}${fontSize}px "${fontFamily}", "Pretendard", sans-serif`;
}

/** curvedText.ts와 같은 수식으로 글자를 호를 따라 배치한다. */
function drawCurvedText(ctx: CanvasRenderingContext2D, s: PreviewTextSlot) {
  const chars = s.text.split('');
  const widths = chars.map((c) => ctx.measureText(c).width);
  const spacing = (s.charSpacing / 1000) * s.fontSize;
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  const intensity = s.curveIntensity / 100;
  const arcAngle = 2 * Math.PI * Math.abs(intensity);
  if (total <= 0 || arcAngle < 0.01) return drawStraightText(ctx, s);
  const radius = total / arcAngle;
  const startAngle = intensity < 0 ? -Math.PI / 2 - arcAngle / 2 : Math.PI / 2 - arcAngle / 2;
  const sagitta = radius * (1 - Math.cos(arcAngle / 2));
  const offsetY = intensity < 0 ? radius - sagitta / 2 : -radius + sagitta / 2;
  let pos = 0;
  chars.forEach((ch, i) => {
    const w = widths[i];
    const t = (pos + w / 2) / total;
    const angle = startAngle + arcAngle * t;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius + offsetY;
    const rot = intensity < 0 ? angle + Math.PI / 2 : angle - Math.PI / 2;
    ctx.save();
    ctx.translate(s.x + x, s.y + y);
    ctx.rotate(rot);
    if (s.stroke && s.strokeWidth > 0) {
      ctx.lineWidth = s.strokeWidth * 2;
      ctx.strokeStyle = s.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillStyle = s.fill;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    pos += w + spacing;
  });
}

function drawStraightText(ctx: CanvasRenderingContext2D, s: PreviewTextSlot) {
  if (s.stroke && s.strokeWidth > 0) {
    ctx.lineWidth = s.strokeWidth * 2;
    ctx.strokeStyle = s.stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(s.text, s.x, s.y);
  }
  ctx.fillStyle = s.fill;
  ctx.fillText(s.text, s.x, s.y);
}

export interface RenderArgs {
  side: PartLayerSide;
  geometry: SideGeometry | null;
  colors: Record<string, string>;
  slots: PreviewSlot[];
  dpr?: number;
}

/** 한 면을 캔버스에 그린다. 실패한 레이어·이미지는 건너뛴다(플로우를 죽이지 않음). */
export async function renderVarsitySide(canvas: HTMLCanvasElement, args: RenderArgs): Promise<void> {
  const dpr = args.dpr ?? Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const W = EDITOR_CANVAS_W;
  const H = EDITOR_CANVAS_H;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(0, 0, W, H);

  const geo: SideGeometry =
    args.geometry ??
    { sideId: args.side.sideId, imgW: args.side.imgW || W, imgH: args.side.imgH || H, zoomScale: 1, printArea: { x: 0, y: 0, width: W, height: H }, nativeMmPerPx: 0 };
  const s = computeSideScale(geo);
  const drawW = geo.imgW * s.scale;
  const drawH = geo.imgH * s.scale;

  const layers = [...args.side.layers].filter((l) => !!l.imageUrl).sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of layers) {
    let img: HTMLImageElement;
    try {
      img = await loadImage(layer.imageUrl as string);
    } catch {
      continue;
    }
    const hex = args.colors[layer.id] || layer.colorOptions[0]?.hex || '#ffffff';
    const off = document.createElement('canvas');
    off.width = W * dpr;
    off.height = H * dpr;
    const octx = off.getContext('2d');
    if (!octx) continue;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.drawImage(img, s.imageLeft, s.imageTop, drawW, drawH);
    if (hex.toLowerCase() !== '#ffffff') {
      octx.globalCompositeOperation = 'multiply';
      octx.fillStyle = hex;
      octx.fillRect(0, 0, W, H);
      octx.globalCompositeOperation = 'destination-in';
      octx.drawImage(img, s.imageLeft, s.imageTop, drawW, drawH);
    }
    ctx.drawImage(off, 0, 0, W, H);
  }

  for (const slot of args.slots) {
    if (slot.kind === 'image') {
      try {
        const img = await loadImage(slot.url);
        const ratio = slot.naturalHeight > 0 && slot.naturalWidth > 0 ? slot.naturalHeight / slot.naturalWidth : 1;
        const w = slot.targetWidth;
        const h = w * ratio;
        ctx.drawImage(img, slot.x - w / 2, slot.y - h / 2, w, h);
      } catch {
        /* 이미지 실패는 무시 */
      }
      continue;
    }
    if (!slot.text.trim()) continue;
    ctx.save();
    ctx.font = buildFont(slot.fontFamily, slot.fontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (slot.curveIntensity !== 0) drawCurvedText(ctx, slot);
    else drawStraightText(ctx, slot);
    ctx.restore();
  }
}

/** 슬롯 상대좌표(fx, fy) → 캔버스 좌표. 서버 canvas_state 빌드와 같은 식. */
export function slotToCanvas(geometry: SideGeometry | null, fx: number, fy: number): { x: number; y: number; scale: number } {
  const geo: SideGeometry =
    geometry ?? { sideId: 'front', imgW: EDITOR_CANVAS_W, imgH: EDITOR_CANVAS_H, zoomScale: 1, printArea: { x: 0, y: 0, width: EDITOR_CANVAS_W, height: EDITOR_CANVAS_H }, nativeMmPerPx: 0 };
  const s = computeSideScale(geo);
  return { x: s.imageLeft + fx * geo.imgW * s.scale, y: s.imageTop + fy * geo.imgH * s.scale, scale: s.scale };
}
