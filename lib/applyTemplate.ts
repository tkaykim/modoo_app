'use client';

import type { DesignTemplate } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';

/**
 * Apply a design template to the canvas store: restore canvas state, then apply
 * layer colors. Bumps canvasVersion so pricing recalculates.
 *
 * Caller is responsible for ensuring canvases are mounted before invoking
 * (use waitForCanvases() from slotReplacement when applying right after route load).
 */
export async function applyTemplateToStore(template: DesignTemplate): Promise<void> {
  const { restoreAllCanvasState, setLayerColor, incrementCanvasVersion } =
    useCanvasStore.getState();

  await restoreAllCanvasState(template.canvas_state);

  if (template.layer_colors && Object.keys(template.layer_colors).length > 0) {
    for (const [sideId, layerMap] of Object.entries(template.layer_colors)) {
      if (layerMap && typeof layerMap === 'object') {
        for (const [layerId, hexColor] of Object.entries(layerMap)) {
          setLayerColor(sideId, layerId, hexColor as string);
        }
      }
    }
  }

  incrementCanvasVersion();
}
