'use client';

import * as fabric from 'fabric';
import type {
  TemplateGroup,
  GroupTransform,
  ArtworkCanvasSize,
} from '@/types/types';

/**
 * Helpers for placing a TemplateGroup's artwork (saved as Fabric JSON) onto a
 * product canvas as a single transformable Fabric.Group, and for capturing the
 * group's current transform back to a normalized GroupTransform.
 *
 * Coordinate convention (GroupTransform):
 *   x, y, width, height are normalized 0-1 relative to the side's printArea
 *   (NOT the whole canvas), so the same group can map cleanly across products.
 */

export const TEMPLATE_GROUP_DATA_FLAG = '__template_group__';

interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProductSideLike {
  id: string;
  printArea: PrintArea;
}

type FabricGroupWithData = fabric.Group & {
  data?: { template_group_id?: string; [k: string]: unknown };
};

function getCanvasSize(group: TemplateGroup): ArtworkCanvasSize {
  return {
    width: group.artwork_canvas_size?.width ?? 800,
    height: group.artwork_canvas_size?.height ?? 800,
  };
}

function defaultTransform(_group: TemplateGroup, _side: ProductSideLike): GroupTransform {
  return {
    x: 0.5,
    y: 0.5,
    width: 0.5,
    height: 0.5,
    angle: 0,
    origin_x: 'center',
    origin_y: 'center',
  };
}

function denormalizeTransform(t: GroupTransform, side: ProductSideLike) {
  const pa = side.printArea;
  return {
    left: pa.x + t.x * pa.width,
    top: pa.y + t.y * pa.height,
    width: t.width * pa.width,
    height: t.height * pa.height,
    angle: t.angle ?? 0,
    originX: (t.origin_x ?? 'center') as 'left' | 'center' | 'right',
    originY: (t.origin_y ?? 'center') as 'top' | 'center' | 'bottom',
  };
}

/**
 * Instantiate the group's artwork as a single Fabric.Group on the canvas.
 * Returns the group object (or null on failure).
 */
export async function loadGroupArtworkOnCanvas(
  canvas: fabric.Canvas,
  group: TemplateGroup,
  side: ProductSideLike,
  transform?: GroupTransform | null,
): Promise<fabric.Group | null> {
  const artwork = group.artwork_state as { objects?: unknown[] } | undefined;
  if (!artwork || !Array.isArray(artwork.objects) || artwork.objects.length === 0) {
    return null;
  }

  let revivedObjects: fabric.FabricObject[];
  try {
    revivedObjects = (await fabric.util.enlivenObjects(
      artwork.objects as Record<string, unknown>[],
    )) as fabric.FabricObject[];
  } catch (err) {
    console.error('enlivenObjects failed:', err);
    return null;
  }

  const t = transform ?? defaultTransform(group, side);
  const dn = denormalizeTransform(t, side);
  const size = getCanvasSize(group);

  // The group's natural bounding box = artwork canvas size. Fabric.Group computes
  // its own bbox from children, but we normalize by setting scale so the rendered
  // visual width/height matches `dn.width/height`.
  const fGroup = new fabric.Group(revivedObjects, {
    left: dn.left,
    top: dn.top,
    angle: dn.angle,
    originX: dn.originX,
    originY: dn.originY,
    subTargetCheck: true,
  });

  // Scale to match desired width × height (using the group's actual bbox, not
  // the artwork canvas size — children may not fill the canvas perfectly).
  const naturalW = fGroup.width || size.width;
  const naturalH = fGroup.height || size.height;
  fGroup.set({
    scaleX: dn.width / naturalW,
    scaleY: dn.height / naturalH,
  });

  (fGroup as FabricGroupWithData).data = {
    template_group_id: group.id,
    [TEMPLATE_GROUP_DATA_FLAG]: true,
  };

  canvas.add(fGroup);
  canvas.requestRenderAll();
  return fGroup;
}

/**
 * Capture the current Fabric.Group's transform into normalized GroupTransform.
 */
export function captureGroupTransform(
  fGroup: fabric.Group,
  side: ProductSideLike,
): GroupTransform {
  const pa = side.printArea;
  const naturalW = fGroup.width || 800;
  const naturalH = fGroup.height || 800;
  const w = naturalW * (fGroup.scaleX ?? 1);
  const h = naturalH * (fGroup.scaleY ?? 1);
  return {
    x: ((fGroup.left ?? 0) - pa.x) / pa.width,
    y: ((fGroup.top ?? 0) - pa.y) / pa.height,
    width: w / pa.width,
    height: h / pa.height,
    angle: fGroup.angle ?? 0,
    origin_x: (fGroup.originX as 'left' | 'center' | 'right') ?? 'center',
    origin_y: (fGroup.originY as 'top' | 'center' | 'bottom') ?? 'center',
  };
}

/** Find the template group object on the given canvas (if loaded). */
export function findTemplateGroup(canvas: fabric.Canvas | null | undefined): fabric.Group | null {
  if (!canvas) return null;
  for (const o of canvas.getObjects()) {
    if ((o as FabricGroupWithData).data?.[TEMPLATE_GROUP_DATA_FLAG]) {
      return o as fabric.Group;
    }
  }
  return null;
}

/**
 * Find a child object inside the loaded template group by its `data.object_id`
 * (set by the group artwork editor). Used to swap text/image content for a slot.
 */
export function findSlotObjectInGroup(
  fGroup: fabric.Group,
  objectId: string,
): fabric.FabricObject | null {
  const children = (fGroup as fabric.Group & { _objects?: fabric.FabricObject[] })._objects ?? [];
  for (const child of children) {
    const data = (child as fabric.FabricObject & { data?: { object_id?: string } }).data;
    if (data?.object_id === objectId) return child;
  }
  return null;
}

/** Replace text content of a text slot inside the group. Style preserved. */
export function replaceGroupTextSlot(
  fGroup: fabric.Group,
  objectId: string,
  newText: string,
): boolean {
  const target = findSlotObjectInGroup(fGroup, objectId);
  if (!target) return false;
  if (
    target.type === 'i-text' ||
    target.type === 'text' ||
    target.type === 'textbox'
  ) {
    (target as fabric.IText).set('text', newText);
    fGroup.dirty = true;
    fGroup.canvas?.requestRenderAll();
    return true;
  }
  return false;
}

/**
 * Replace the image src of an image slot inside the group, preserving its local
 * position/scale so the swap stays in the same spot.
 */
export async function replaceGroupImageSlot(
  fGroup: fabric.Group,
  objectId: string,
  newImageUrl: string,
): Promise<boolean> {
  const target = findSlotObjectInGroup(fGroup, objectId);
  if (!target) return false;

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
    data: { ...((target as fabric.FabricObject & { data?: Record<string, unknown> }).data ?? {}) },
    width: target.width,
    height: target.height,
  };

  let img: fabric.FabricImage;
  try {
    img = await fabric.FabricImage.fromURL(newImageUrl, { crossOrigin: 'anonymous' });
  } catch (err) {
    console.error('replaceGroupImageSlot load failed:', err);
    return false;
  }

  const naturalW = img.width ?? 1;
  const naturalH = img.height ?? 1;
  const desiredW = (captured.width ?? naturalW) * (captured.scaleX ?? 1);
  const desiredH = (captured.height ?? naturalH) * (captured.scaleY ?? 1);
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
    scaleX: desiredW / naturalW,
    scaleY: desiredH / naturalH,
  });
  if (captured.clipPath) img.clipPath = captured.clipPath;
  (img as fabric.FabricObject & { data?: Record<string, unknown> }).data = captured.data;

  // Replace child in group's internal _objects array.
  const children = (fGroup as fabric.Group & { _objects?: fabric.FabricObject[] })._objects;
  if (children) {
    const idx = children.indexOf(target);
    if (idx >= 0) children[idx] = img;
  }
  fGroup.dirty = true;
  fGroup.canvas?.requestRenderAll();
  return true;
}
