'use client';

import type { DesignTemplate, TemplateGroup, Product, PlacementMap } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { createFabricFromSlot } from './templateComposition';

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
 * Used for templates that aren't bound to a group (template_group_id = null)
 * and still carry their own canvas_state JSON.
 */
export async function applyTemplateToStore(template: DesignTemplate): Promise<void> {
  const { restoreAllCanvasState, incrementCanvasVersion } = useCanvasStore.getState();
  await restoreAllCanvasState(template.canvas_state);
  applyLayerColors(template);
  incrementCanvasVersion();
}

/**
 * Group template path:
 * Reads composition slots from `group.design_composition` and instantiates
 * Fabric objects on each side's canvas at positions defined by
 * `template.placement_map`. Slots without a placement entry are skipped
 * (admin hasn't placed them yet for this product).
 */
export async function applyGroupTemplateToStore(
  template: DesignTemplate,
  group: TemplateGroup,
  product: Product,
): Promise<void> {
  const { canvasMap, incrementCanvasVersion } = useCanvasStore.getState();
  const placementMap = (template.placement_map ?? {}) as PlacementMap;
  const slots = group.design_composition?.slots ?? [];

  for (const slot of slots) {
    const placement = placementMap[slot.slot_id];
    if (!placement) continue; // unplaced — skip
    const side = product.configuration.find((s) => s.id === placement.side_id);
    if (!side) continue;
    const canvas = canvasMap[side.id];
    if (!canvas) continue;

    const obj = await createFabricFromSlot(slot, side, placement);
    if (!obj) continue;
    canvas.add(obj);
  }

  // Force render of all sides we touched
  for (const side of product.configuration) {
    canvasMap[side.id]?.requestRenderAll();
  }
  applyLayerColors(template);
  incrementCanvasVersion();
}
