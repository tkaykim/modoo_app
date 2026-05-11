'use client';

import type { DesignTemplate, TemplateGroup, Product } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { loadGroupArtworkOnCanvas } from './templateGroupComposer';

/**
 * Apply layer colors from a template (always done, both legacy and group paths).
 */
function applyLayerColors(template: DesignTemplate) {
  const { setLayerColor } = useCanvasStore.getState();
  if (template.layer_colors && Object.keys(template.layer_colors).length > 0) {
    for (const [sideId, layerMap] of Object.entries(template.layer_colors)) {
      if (layerMap && typeof layerMap === 'object') {
        for (const [layerId, hexColor] of Object.entries(layerMap)) {
          setLayerColor(sideId, layerId, hexColor as string);
        }
      }
    }
  }
}

/**
 * Legacy / single template path:
 * Restores serialized Fabric canvas state from template.canvas_state.
 * Used for templates that aren't bound to a group.
 */
export async function applyTemplateToStore(template: DesignTemplate): Promise<void> {
  const { restoreAllCanvasState, incrementCanvasVersion } = useCanvasStore.getState();
  await restoreAllCanvasState(template.canvas_state);
  applyLayerColors(template);
  incrementCanvasVersion();
}

/**
 * Group template path (NEW model):
 * Loads the group's artwork (Fabric JSON) as a single Fabric.Group, applies the
 * template's saved transform, and adds it to the appropriate product side canvas.
 */
export async function applyGroupTemplateToStore(
  template: DesignTemplate,
  group: TemplateGroup,
  product: Product,
): Promise<void> {
  const { canvasMap, incrementCanvasVersion } = useCanvasStore.getState();
  const sideId = template.side_id;
  if (!sideId) {
    console.warn('[applyGroupTemplateToStore] template has no side_id — group not placed yet');
    applyLayerColors(template);
    incrementCanvasVersion();
    return;
  }
  const side = product.configuration.find((s) => s.id === sideId);
  if (!side) {
    console.warn('[applyGroupTemplateToStore] side not found on product:', sideId);
    applyLayerColors(template);
    incrementCanvasVersion();
    return;
  }
  const canvas = canvasMap[side.id];
  if (!canvas) {
    console.warn('[applyGroupTemplateToStore] canvas not ready for side:', side.id);
    applyLayerColors(template);
    incrementCanvasVersion();
    return;
  }
  await loadGroupArtworkOnCanvas(canvas, group, side, template.transform);
  applyLayerColors(template);
  incrementCanvasVersion();
}
