'use client';

import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';

type CanvasObjectWithData = fabric.FabricObject & {
  data?: { slot_id?: string; [k: string]: unknown };
};

export function findObjectBySlotId(
  canvas: fabric.Canvas | null | undefined,
  slotId: string,
): CanvasObjectWithData | null {
  if (!canvas) return null;
  return (
    (canvas.getObjects() as CanvasObjectWithData[]).find(
      (o) => o.data?.slot_id === slotId,
    ) ?? null
  );
}

/**
 * Replace the image source of a slot-tagged Fabric image while preserving
 * its position, scale, rotation, clipPath, origin and stacking order.
 * Triggers a canvas re-render and bumps canvasVersion so pricing recalculates.
 */
export async function replaceImageSlot(
  sideId: string,
  slotId: string,
  newImageUrl: string,
): Promise<boolean> {
  const { canvasMap, incrementCanvasVersion } = useCanvasStore.getState();
  const canvas = canvasMap[sideId];
  if (!canvas) return false;

  const target = findObjectBySlotId(canvas, slotId);
  if (!target) return false;

  // Capture transform + metadata before swap.
  const captured = {
    left: target.left,
    top: target.top,
    scaleX: target.scaleX,
    scaleY: target.scaleY,
    angle: target.angle,
    originX: target.originX,
    originY: target.originY,
    flipX: target.flipX,
    flipY: target.flipY,
    skewX: target.skewX,
    skewY: target.skewY,
    clipPath: target.clipPath,
    visible: target.visible,
    opacity: target.opacity,
    selectable: target.selectable,
    evented: target.evented,
    data: { ...(target.data ?? {}), slot_id: slotId },
  };
  const oldIndex = canvas.getObjects().indexOf(target);

  let img: fabric.FabricImage;
  try {
    img = await fabric.FabricImage.fromURL(newImageUrl, { crossOrigin: 'anonymous' });
  } catch (err) {
    console.error('[slotReplacement] failed to load image:', err);
    return false;
  }

  // The new image's natural width/height may differ from the original. Preserve the
  // visible footprint by computing scale that yields the same width as the captured
  // object (width = naturalWidth * scaleX before transforms).
  if (target.width && img.width) {
    const desiredWidth = target.width * (captured.scaleX ?? 1);
    const desiredHeight = target.height ? target.height * (captured.scaleY ?? 1) : undefined;
    const scaleXNew = desiredWidth / img.width;
    const scaleYNew = desiredHeight && img.height ? desiredHeight / img.height : scaleXNew;
    img.set({ scaleX: scaleXNew, scaleY: scaleYNew });
  } else {
    img.set({ scaleX: captured.scaleX, scaleY: captured.scaleY });
  }

  img.set({
    left: captured.left,
    top: captured.top,
    angle: captured.angle,
    originX: captured.originX,
    originY: captured.originY,
    flipX: captured.flipX,
    flipY: captured.flipY,
    skewX: captured.skewX,
    skewY: captured.skewY,
    visible: captured.visible,
    opacity: captured.opacity,
    selectable: captured.selectable,
    evented: captured.evented,
  });
  if (captured.clipPath) img.clipPath = captured.clipPath;
  (img as CanvasObjectWithData).data = captured.data;

  canvas.remove(target);
  canvas.insertAt(oldIndex >= 0 ? oldIndex : canvas.getObjects().length, img);
  canvas.requestRenderAll();
  incrementCanvasVersion();
  return true;
}

/**
 * Replace text content of a slot-tagged Fabric text object, keeping all style.
 */
export function replaceTextSlot(
  sideId: string,
  slotId: string,
  newText: string,
): boolean {
  const { canvasMap, incrementCanvasVersion } = useCanvasStore.getState();
  const canvas = canvasMap[sideId];
  if (!canvas) return false;

  const target = findObjectBySlotId(canvas, slotId);
  if (!target) return false;

  if (
    target.type === 'i-text' ||
    target.type === 'text' ||
    target.type === 'textbox'
  ) {
    (target as fabric.IText).set('text', newText);
    canvas.requestRenderAll();
    incrementCanvasVersion();
    return true;
  }
  return false;
}

/**
 * Wait until all canvas instances for the given side ids exist in the store.
 * Resolves immediately when canvases are ready, or rejects after the timeout.
 */
export function waitForCanvases(sideIds: string[], timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const { canvasMap } = useCanvasStore.getState();
      const allReady = sideIds.every((id) => !!canvasMap[id]);
      if (allReady) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('waitForCanvases timed out'));
      }
      setTimeout(tick, 80);
    };
    tick();
  });
}
