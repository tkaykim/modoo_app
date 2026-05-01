import { create } from 'zustand';
import * as fabric from 'fabric';
import { extractAllColors } from '@/lib/colorExtractor';
import {
  extractTextObjectsToSVG,
  extractAndUploadTextSVG,
  extractAndUploadAllTextSVG,
  type SVGExportResult
} from '@/lib/canvas-svg-export';
import { createClient } from '@/lib/supabase-client';
import { calculateTotalBoundingBoxMm } from '@/lib/canvasUtils';


interface CanvasState {
  // Aplication State
  activeSideId: string;
  setActiveSide: (id: string) => void;

  // Edit mode state
  isEditMode: boolean;
  setEditMode: (isEdit: boolean) => void;

  // Product color state
  productColor: string;
  setProductColor: (color: string) => void;

  // Layer color state - maps sideId -> layerId -> hex color
  // For single-layered sides, use sideId as the layerId
  layerColors: Record<string, Record<string, string>>;
  setLayerColor: (sideId: string, layerId: string, color: string) => void;
  getLayerColor: (sideId: string, layerId: string) => string | null;
  initializeLayerColors: (sideId: string, layers: { id: string; colorOptions: { hex: string; colorCode: string }[] }[]) => void;
  initializeSideColor: (sideId: string, colorOptions: { hex: string; colorCode: string }[]) => void;

  // Zoom state - maps sideId -> zoom level
  zoomLevels: Record<string, number>;
  getZoomLevel: (sideId?: string) => number;
  setZoom: (zoom: number, sideId?: string) => void;
  zoomIn: (sideId?: string) => void;
  zoomOut: (sideId?: string) => void;
  resetZoom: (sideId?: string) => void;

  canvasMap: Record<string, fabric.Canvas>;
  registerCanvas: (id: string, cavas: fabric.Canvas) => void;
  unregisterCanvas: (id: string) => void;

  getActiveCanvas: () => fabric.Canvas | null;

  // Canvas change tracking
  canvasVersion: number;
  incrementCanvasVersion: () => void;

  // Image loading tracking
  imageLoadedMap: Record<string, boolean>;
  markImageLoaded: (id: string) => void;
  isImageLoaded: (id: string) => boolean;

  // Serialization methods
  saveAllCanvasState: () => Record<string, string>;
  restoreAllCanvasState: (savedState: Record<string, string>) => Promise<void>;
  saveCanvasState: (id: string) => string | null;
  restoreCanvasState: (id: string, json: string) => Promise<void>;

  // Save with curved text converted to SVG paths (for production export)
  saveAllCanvasStateWithPaths: () => Promise<Record<string, string>>;
  saveCanvasStateWithPaths: (id: string) => Promise<string | null>;

  // Color extraction methods
  getCanvasColors: (sensitivity?: number) => Promise<{ colors: string[]; count: number }>;

  // Print option methods
  setObjectPrintMethod: (objectId: string, method: 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique') => void;
  getObjectPrintMethod: (object: fabric.FabricObject) => 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique' | null;

  // SVG export methods
  exportTextToSVG: (sideId?: string) => SVGExportResult | null;
  exportAndUploadTextToSVG: (sideId?: string) => Promise<SVGExportResult | null>;
  exportAllTextToSVG: () => Record<string, SVGExportResult>;
  exportAndUploadAllTextToSVG: () => Promise<Record<string, SVGExportResult>>;

  // Reset all canvas state
  resetCanvasState: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  activeSideId: 'front',
  canvasMap: {},
  imageLoadedMap: {},
  isEditMode: false,
  productColor: '#FFFFFF', // Default mix gray color
  canvasVersion: 0,
  layerColors: {},
  zoomLevels: {},
  setActiveSide: (id) => set({ activeSideId: id}),
  setEditMode: (isEdit) => set({ isEditMode: isEdit }),
  setProductColor: (color) => set({ productColor: color }),
  incrementCanvasVersion: () => set((state) => ({ canvasVersion: state.canvasVersion + 1 })),

  // Zoom methods
  getZoomLevel: (sideId) => {
    const { zoomLevels, activeSideId } = get();
    const targetSideId = sideId || activeSideId;
    return zoomLevels[targetSideId] || 1.0;
  },

  setZoom: (zoom, sideId) => {
    const { canvasMap, activeSideId } = get();
    const targetSideId = sideId || activeSideId;
    const canvas = canvasMap[targetSideId];

    if (!canvas) return;

    // Clamp zoom between 0.1 and 5
    const clampedZoom = Math.max(0.1, Math.min(5, zoom));

    // Get canvas center point
    const center = new fabric.Point(canvas.width / 2, canvas.height / 2);

    // Apply zoom centered on the canvas center
    canvas.zoomToPoint(center, clampedZoom);

    // Update zoom levels state
    set((state) => ({
      zoomLevels: {
        ...state.zoomLevels,
        [targetSideId]: clampedZoom
      }
    }));

    canvas.requestRenderAll();
  },

  zoomIn: (sideId) => {
    const { zoomLevels, activeSideId, setZoom } = get();
    const targetSideId = sideId || activeSideId;
    const currentZoom = zoomLevels[targetSideId] || 1.0;
    setZoom(currentZoom + 0.1, targetSideId);
  },

  zoomOut: (sideId) => {
    const { zoomLevels, activeSideId, setZoom } = get();
    const targetSideId = sideId || activeSideId;
    const currentZoom = zoomLevels[targetSideId] || 1.0;
    setZoom(currentZoom - 0.1, targetSideId);
  },

  resetZoom: (sideId) => {
    const { setZoom } = get();
    setZoom(1.0, sideId);
  },

  // Layer color management
  setLayerColor: (sideId, layerId, color) => {
    set((state) => {
      // Update the color for this layer across ALL sides that have the same layerId
      const updatedLayerColors = { ...state.layerColors };

      // Iterate through all sides and update matching layer IDs
      Object.keys(updatedLayerColors).forEach((currentSideId) => {
        if (updatedLayerColors[currentSideId][layerId] !== undefined) {
          updatedLayerColors[currentSideId] = {
            ...updatedLayerColors[currentSideId],
            [layerId]: color
          };
        }
      });

      // Also ensure the current side has the color set even if it wasn't in the state yet
      if (!updatedLayerColors[sideId]) {
        updatedLayerColors[sideId] = {};
      }
      updatedLayerColors[sideId] = {
        ...updatedLayerColors[sideId],
        [layerId]: color
      };

      return { layerColors: updatedLayerColors };
    });
  },

  getLayerColor: (sideId, layerId) => {
    const { layerColors } = get();
    return layerColors[sideId]?.[layerId] || null;
  },

  initializeLayerColors: (sideId, layers) => {
    set((state) => {
      const sideColors = { ...state.layerColors[sideId] };
      layers.forEach(layer => {
        // Only initialize if not already set for this side
        if (!sideColors[layer.id] && layer.colorOptions.length > 0) {
          // Check if this layer ID already has a color set on ANY other side
          let existingColor: string | null = null;
          Object.keys(state.layerColors).forEach((otherSideId) => {
            if (otherSideId !== sideId && state.layerColors[otherSideId][layer.id]) {
              existingColor = state.layerColors[otherSideId][layer.id];
            }
          });

          // Use existing color if found, otherwise use the hex from the first color option
          sideColors[layer.id] = existingColor || layer.colorOptions[0]?.hex || '#FFFFFF';
        }
      });
      return {
        layerColors: {
          ...state.layerColors,
          [sideId]: sideColors
        }
      };
    });
  },

  initializeSideColor: (sideId, colorOptions) => {
    set((state) => {
      const sideColors = { ...state.layerColors[sideId] };

      // For single-layered sides, use the sideId itself as the layerId
      if (!sideColors[sideId] && colorOptions.length > 0) {
        // Use the hex from the first color option
        sideColors[sideId] = colorOptions[0]?.hex || '#FFFFFF';
      }

      return {
        layerColors: {
          ...state.layerColors,
          [sideId]: sideColors
        }
      };
    });
  },

  markImageLoaded: (id) => {
    set((state) => ({
      imageLoadedMap: { ...state.imageLoadedMap, [id]: true }
    }));
  },

  isImageLoaded: (id) => {
    const { imageLoadedMap } = get();
    return imageLoadedMap[id] || false;
  },

  registerCanvas: (id, canvas) => {
    set((state) => {
      const newMap = { ...state.canvasMap };
      newMap[id] = canvas;
      return { canvasMap: newMap };
    });
  },

  unregisterCanvas: (id) => {
    set((state) => {
      const newMap = { ...state.canvasMap };
      const newImageLoadedMap = { ...state.imageLoadedMap };
      delete newMap[id];
      delete newImageLoadedMap[id];
      return { canvasMap: newMap, imageLoadedMap: newImageLoadedMap };
    })
  },

  getActiveCanvas: () => {
    const {canvasMap, activeSideId} = get();
    return canvasMap[activeSideId] || null;
  },

  // Save state of all canvases as JSON strings
  saveAllCanvasState: () => {
    const { canvasMap, layerColors } = get();
    const savedState: Record<string, string> = {};

    Object.entries(canvasMap).forEach(([id, canvas]) => {
      // Save user-added objects (exclude background product image, guides, and snap lines)
      // User-added images should be saved
      const userObjects = canvas.getObjects().filter(obj => {
        // Exclude guide boxes and snap lines
        if (obj.excludeFromExport) return false;

        // Exclude the background product image by checking its ID
        // @ts-expect-error - Checking custom data property
        if (obj.data?.id === 'background-product-image') return false;

        return true;
      });

      // Calculate total bounding box for all user objects
      // @ts-expect-error - Custom property
      const scaledImageWidth = canvas.scaledImageWidth;
      // @ts-expect-error - Custom property
      const realWorldProductWidth = canvas.realWorldProductWidth || 500;
      // @ts-expect-error - Custom property — set by SingleSideCanvas calibration effect (native = mm per ORIGINAL mockup px)
      const calibrationNativeMmPerPx = (canvas.calibrationNativeMmPerPx as number | undefined) ?? 0;
      // @ts-expect-error - Custom property
      const originalImageWidth = canvas.originalImageWidth as number | undefined;
      const calibrationCanvasMmPerPx =
        calibrationNativeMmPerPx > 0 && scaledImageWidth && originalImageWidth
          ? calibrationNativeMmPerPx / (scaledImageWidth / originalImageWidth)
          : null;
      const totalBoundingBox = scaledImageWidth
        ? calculateTotalBoundingBoxMm(canvas, scaledImageWidth, realWorldProductWidth, calibrationCanvasMmPerPx)
        : null;

      // Create a minimal JSON with only user objects and layer colors
      const canvasData = {
        version: canvas.toJSON().version,
        objects: userObjects.map(obj => {
          // Use toObject to include custom properties
          const json = obj.toObject(['data']);
          // For image objects, ensure we preserve the src
          if (obj.type === 'image') {
            const imgObj = obj as fabric.FabricImage;
            json.src = imgObj.getSrc();
          }
          return json;
        }),
        // Save layer colors for this side
        layerColors: layerColors[id] || {},
        // Save total bounding box dimensions in mm
        totalBoundingBoxMm: totalBoundingBox,
        // Native mm per ORIGINAL mockup pixel from product_calibrations at save time.
        // Restored canvases use this to render mm labels accurately even if calibration
        // is later updated. Absent → legacy productWidthMm fallback.
        __mmPerPxCalibrationNative: calibrationNativeMmPerPx > 0 ? calibrationNativeMmPerPx : null,
      };

      savedState[id] = JSON.stringify(canvasData);
    });

    return savedState;
  },

  // Restore all canvases from saved state
  restoreAllCanvasState: async (savedState: Record<string, string>) => {
    const { canvasMap, isEditMode } = get();

    const restorePromises = Object.entries(savedState).map(([id, json]) => {
      const canvas = canvasMap[id];
      if (!canvas) return Promise.resolve();

      return new Promise<void>((resolve) => {
        // First, remove only user-added objects (keep background product image and guides)
        const objectsToRemove = canvas.getObjects().filter(obj => {
          // Keep guide boxes and snap lines
          if (obj.excludeFromExport) return false;

          // Keep the background product image by checking its ID
          // @ts-expect-error - Checking custom data property
          if (obj.data?.id === 'background-product-image') return false;

          // Remove all other user-added objects
          return true;
        });
        objectsToRemove.forEach(obj => canvas.remove(obj));

        // Then load the saved user objects and layer colors
        const canvasData = typeof json === 'string' ? JSON.parse(json) : json;

        // Restore calibration mmPerPx (additive — absent in legacy designs).
        // SingleSideCanvas may also fetch fresh from product_calibrations on mount;
        // the saved snapshot wins for historical accuracy unless a fresh fetch
        // overwrites it. Either path leaves px coords visually identical.
        if (canvasData.__mmPerPxCalibrationNative && canvasData.__mmPerPxCalibrationNative > 0) {
          // @ts-expect-error - Custom property
          canvas.calibrationNativeMmPerPx = canvasData.__mmPerPxCalibrationNative;
        }

        // Restore layer colors if present
        if (canvasData.layerColors) {
          console.log(`[useCanvasStore] Restoring layer colors for side ${id}:`, canvasData.layerColors);
          set((state) => ({
            layerColors: {
              ...state.layerColors,
              [id]: canvasData.layerColors
            }
          }));
        }

        if (canvasData.objects && canvasData.objects.length > 0) {
          fabric.util.enlivenObjects(canvasData.objects).then(async (objects) => {
            objects.forEach((obj) => {
              if (obj && typeof obj === 'object' && 'type' in obj) {
                const fabricObj = obj as fabric.FabricObject;

                canvas.add(fabricObj);

                // Set interactivity AFTER adding to canvas
                // This ensures the properties are applied after canvas event handlers
                fabricObj.set({
                  selectable: isEditMode,
                  evented: isEditMode
                });

                // Set default printMethod for legacy objects that don't have one
                // @ts-expect-error - Accessing custom data property
                if (fabricObj.data?.id !== 'background-product-image') {
                  // @ts-expect-error - Accessing custom data property
                  if (!fabricObj.data) fabricObj.data = {};
                  // @ts-expect-error - Accessing custom data property
                  if (!fabricObj.data.printMethod) fabricObj.data.printMethod = 'dtf';
                }
              }
            });
            // Re-attach amber "!" badges for any designer-pending objects.
            // Lazy import keeps fabric overlay code out of non-editor bundles.
            try {
              const { restoreDesignerPendingBadges } = await import(
                '@/app/components/canvas/designerPendingBadge'
              );
              restoreDesignerPendingBadges(canvas);
            } catch (err) {
              console.error('[useCanvasStore] Failed to restore designer-pending badges:', err);
            }
            canvas.requestRenderAll();
            resolve();
          }).catch((error) => {
            console.error(`[useCanvasStore] Failed to enliven objects for side ${id}:`, error);
            canvas.requestRenderAll();
            resolve();
          });
        } else {
          canvas.requestRenderAll();
          resolve();
        }
      });
    });

    await Promise.all(restorePromises);
  },

  // Save state of a specific canvas
  saveCanvasState: (id: string) => {
    const { canvasMap, layerColors } = get();
    const canvas = canvasMap[id];

    if (!canvas) return null;

    // Save user-added objects (exclude background product image, guides, and snap lines)
    const userObjects = canvas.getObjects().filter(obj => {
      // Exclude guide boxes and snap lines
      if (obj.excludeFromExport) return false;

      // Exclude the background product image by checking its ID
      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image') return false;

      return true;
    });

    // Calculate total bounding box for all user objects
    // @ts-expect-error - Custom property
    const scaledImageWidth = canvas.scaledImageWidth;
    // @ts-expect-error - Custom property
    const realWorldProductWidth = canvas.realWorldProductWidth || 500;
    // @ts-expect-error - Custom property — set by SingleSideCanvas calibration effect
    const calibrationNativeMmPerPx = (canvas.calibrationNativeMmPerPx as number | undefined) ?? 0;
    // @ts-expect-error - Custom property
    const originalImageWidth = canvas.originalImageWidth as number | undefined;
    const calibrationCanvasMmPerPx =
      calibrationNativeMmPerPx > 0 && scaledImageWidth && originalImageWidth
        ? calibrationNativeMmPerPx / (scaledImageWidth / originalImageWidth)
        : null;
    const totalBoundingBox = scaledImageWidth
      ? calculateTotalBoundingBoxMm(canvas, scaledImageWidth, realWorldProductWidth, calibrationCanvasMmPerPx)
      : null;

    // Create a minimal JSON with only user objects and layer colors
    const canvasData = {
      version: canvas.toJSON().version,
      objects: userObjects.map(obj => {
        // Use toObject to include custom properties
        const json = obj.toObject(['data']);
        // For image objects, ensure we preserve the src
        if (obj.type === 'image') {
          const imgObj = obj as fabric.FabricImage;
          json.src = imgObj.getSrc();
        }
        return json;
      }),
      // Save layer colors for this side
      layerColors: layerColors[id] || {},
      // Save total bounding box dimensions in mm
      totalBoundingBoxMm: totalBoundingBox,
      __mmPerPxCalibrationNative: calibrationNativeMmPerPx > 0 ? calibrationNativeMmPerPx : null,
    };

    return JSON.stringify(canvasData);
  },

  // Restore a specific canvas from JSON
  restoreCanvasState: async (id: string, json: string) => {
    const { canvasMap, isEditMode } = get();
    const canvas = canvasMap[id];

    if (!canvas) return;

    return new Promise<void>((resolve) => {
      // First, remove only user-added objects (keep background product image and guides)
      const objectsToRemove = canvas.getObjects().filter(obj => {
        // Keep guide boxes and snap lines
        if (obj.excludeFromExport) return false;

        // Keep the background product image by checking its ID
        // @ts-expect-error - Checking custom data property
        if (obj.data?.id === 'background-product-image') return false;

        // Remove all other user-added objects
        return true;
      });
      objectsToRemove.forEach(obj => canvas.remove(obj));

      // Then load the saved user objects and layer colors
      const canvasData = JSON.parse(json);

      // Restore calibration mmPerPx if embedded (additive, absent in legacy designs).
      if (canvasData.__mmPerPxCalibrationNative && canvasData.__mmPerPxCalibrationNative > 0) {
        // @ts-expect-error - Custom property
        canvas.calibrationNativeMmPerPx = canvasData.__mmPerPxCalibrationNative;
      }

      // Restore layer colors if present
      if (canvasData.layerColors) {
        console.log(`[useCanvasStore] Restoring layer colors for side ${id}:`, canvasData.layerColors);
        set((state) => ({
          layerColors: {
            ...state.layerColors,
            [id]: canvasData.layerColors
          }
        }));
      }

      if (canvasData.objects && canvasData.objects.length > 0) {
        fabric.util.enlivenObjects(canvasData.objects).then(async (objects) => {
          objects.forEach((obj) => {
            if (obj && typeof obj === 'object' && 'type' in obj) {
              const fabricObj = obj as fabric.FabricObject;

              canvas.add(fabricObj);

              // Set interactivity AFTER adding to canvas
              fabricObj.set({
                selectable: isEditMode,
                evented: isEditMode
              });

              // Set default printMethod for legacy objects that don't have one
              // @ts-expect-error - Accessing custom data property
              if (fabricObj.data?.id !== 'background-product-image') {
                // @ts-expect-error - Accessing custom data property
                if (!fabricObj.data) fabricObj.data = {};
                // @ts-expect-error - Accessing custom data property
                if (!fabricObj.data.printMethod) fabricObj.data.printMethod = 'dtf';
              }
            }
          });
          try {
            const { restoreDesignerPendingBadges } = await import(
              '@/app/components/canvas/designerPendingBadge'
            );
            restoreDesignerPendingBadges(canvas);
          } catch (err) {
            console.error('[useCanvasStore] Failed to restore designer-pending badges:', err);
          }
          canvas.requestRenderAll();
          resolve();
        }).catch((error) => {
          console.error(`[useCanvasStore] Failed to enliven objects for side ${id}:`, error);
          canvas.requestRenderAll();
          resolve();
        });
      } else {
        canvas.requestRenderAll();
        resolve();
      }
    });
  },

  // Save state of all canvases with curved text converted to SVG paths
  // This is useful for production export where fonts may not be available
  saveAllCanvasStateWithPaths: async () => {
    const { canvasMap, layerColors } = get();
    const savedState: Record<string, string> = {};

    for (const [id, canvas] of Object.entries(canvasMap)) {
      // Save user-added objects (exclude background product image, guides, and snap lines)
      const userObjects = canvas.getObjects().filter(obj => {
        if (obj.excludeFromExport) return false;
        // @ts-expect-error - Checking custom data property
        if (obj.data?.id === 'background-product-image') return false;
        return true;
      });

      // Calculate total bounding box for all user objects
      // @ts-expect-error - Custom property
      const scaledImageWidth = canvas.scaledImageWidth;
      // @ts-expect-error - Custom property
      const realWorldProductWidth = canvas.realWorldProductWidth || 500;
      // @ts-expect-error - Custom property — set by SingleSideCanvas calibration effect (native = mm per ORIGINAL mockup px)
      const calibrationNativeMmPerPx = (canvas.calibrationNativeMmPerPx as number | undefined) ?? 0;
      // @ts-expect-error - Custom property
      const originalImageWidth = canvas.originalImageWidth as number | undefined;
      const calibrationCanvasMmPerPx =
        calibrationNativeMmPerPx > 0 && scaledImageWidth && originalImageWidth
          ? calibrationNativeMmPerPx / (scaledImageWidth / originalImageWidth)
          : null;
      const totalBoundingBox = scaledImageWidth
        ? calculateTotalBoundingBoxMm(canvas, scaledImageWidth, realWorldProductWidth, calibrationCanvasMmPerPx)
        : null;

      // Convert objects
      const serializedObjects = userObjects.map((obj) => {
        // Regular object serialization (CurvedText handles its own SVG in toSVG)
        const json = obj.toObject(['data']);
        if (obj.type === 'image') {
          const imgObj = obj as fabric.FabricImage;
          json.src = imgObj.getSrc();
        }
        return json;
      });

      const canvasData = {
        version: canvas.toJSON().version,
        objects: serializedObjects,
        layerColors: layerColors[id] || {},
        totalBoundingBoxMm: totalBoundingBox,
        // Native mm per ORIGINAL mockup pixel from product_calibrations at save time.
        // Restored canvases use this to render mm labels accurately even if calibration
        // is later updated. Absent → legacy productWidthMm fallback.
        __mmPerPxCalibrationNative: calibrationNativeMmPerPx > 0 ? calibrationNativeMmPerPx : null,
      };

      savedState[id] = JSON.stringify(canvasData);
    }

    return savedState;
  },

  // Save state of a specific canvas with curved text converted to SVG paths
  saveCanvasStateWithPaths: async (id: string) => {
    const { canvasMap, layerColors } = get();
    const canvas = canvasMap[id];

    if (!canvas) return null;

    // Save user-added objects (exclude background product image, guides, and snap lines)
    const userObjects = canvas.getObjects().filter(obj => {
      if (obj.excludeFromExport) return false;
      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image') return false;
      return true;
    });

    // Calculate total bounding box for all user objects
    // @ts-expect-error - Custom property
    const scaledImageWidth = canvas.scaledImageWidth;
    // @ts-expect-error - Custom property
    const realWorldProductWidth = canvas.realWorldProductWidth || 500;
    // @ts-expect-error - Custom property — set by SingleSideCanvas calibration effect
    const calibrationNativeMmPerPx = (canvas.calibrationNativeMmPerPx as number | undefined) ?? 0;
    // @ts-expect-error - Custom property
    const originalImageWidth = canvas.originalImageWidth as number | undefined;
    const calibrationCanvasMmPerPx =
      calibrationNativeMmPerPx > 0 && scaledImageWidth && originalImageWidth
        ? calibrationNativeMmPerPx / (scaledImageWidth / originalImageWidth)
        : null;
    const totalBoundingBox = scaledImageWidth
      ? calculateTotalBoundingBoxMm(canvas, scaledImageWidth, realWorldProductWidth, calibrationCanvasMmPerPx)
      : null;

    // Convert objects (CurvedText handles its own SVG in toSVG)
    const serializedObjects = userObjects.map((obj) => {
      const json = obj.toObject(['data']);
      if (obj.type === 'image') {
        const imgObj = obj as fabric.FabricImage;
        json.src = imgObj.getSrc();
      }
      return json;
    });

    const canvasData = {
      version: canvas.toJSON().version,
      objects: serializedObjects,
      layerColors: layerColors[id] || {},
      totalBoundingBoxMm: totalBoundingBox,
      __mmPerPxCalibrationNative: calibrationNativeMmPerPx > 0 ? calibrationNativeMmPerPx : null,
    };

    return JSON.stringify(canvasData);
  },

  // Get all colors used in canvas objects (excluding background images)
  getCanvasColors: async (sensitivity: number = 30) => {
    const { canvasMap } = get();
    return await extractAllColors(canvasMap, sensitivity);
  },

  // Set print method for a specific object
  setObjectPrintMethod: (objectId: string, method: 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique') => {
    const { getActiveCanvas, incrementCanvasVersion } = get();
    const canvas = getActiveCanvas();
    if (!canvas) return;

    // Find the object by ID
    const objects = canvas.getObjects();
    const targetObject = objects.find(obj => {
      // @ts-expect-error - Checking custom data property
      return obj.data?.objectId === objectId;
    });

    if (targetObject) {
      // @ts-expect-error - Setting custom data property
      if (!targetObject.data) targetObject.data = {};
      // @ts-expect-error - Setting custom data property
      targetObject.data.printMethod = method;

      // Trigger canvas version update for pricing recalculation
      incrementCanvasVersion();
      canvas.requestRenderAll();
    }
  },

  // Get print method for a specific object
  getObjectPrintMethod: (object: fabric.FabricObject): 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique' | null => {
    // @ts-expect-error - Checking custom data property
    return object.data?.printMethod || null;
  },

  // Export text objects from a specific canvas to SVG (no upload)
  exportTextToSVG: (sideId?: string) => {
    const { canvasMap, activeSideId } = get();
    const targetSideId = sideId || activeSideId;
    const canvas = canvasMap[targetSideId];

    if (!canvas) {
      console.warn(`Canvas not found for side: ${targetSideId}`);
      return null;
    }

    return extractTextObjectsToSVG(canvas);
  },

  // Export text objects from a specific canvas to SVG and upload to Supabase
  exportAndUploadTextToSVG: async (sideId?: string) => {
    const { canvasMap, activeSideId } = get();
    const targetSideId = sideId || activeSideId;
    const canvas = canvasMap[targetSideId];

    if (!canvas) {
      console.warn(`Canvas not found for side: ${targetSideId}`);
      return null;
    }

    const supabase = createClient();
    return await extractAndUploadTextSVG(supabase, canvas, `text-${targetSideId}`);
  },

  // Export text objects from all canvases to SVG (no upload)
  exportAllTextToSVG: () => {
    const { canvasMap } = get();
    const results: Record<string, SVGExportResult> = {};

    Object.entries(canvasMap).forEach(([sideId, canvas]) => {
      results[sideId] = extractTextObjectsToSVG(canvas);
    });

    return results;
  },

  // Export text objects from all canvases to SVG and upload to Supabase
  exportAndUploadAllTextToSVG: async () => {
    const { canvasMap } = get();
    const supabase = createClient();
    return await extractAndUploadAllTextSVG(supabase, canvasMap);
  },

  // Reset all canvas state to initial values
  resetCanvasState: () => {
    const { canvasMap } = get();

    // Clear all user-added objects from all canvases
    Object.values(canvasMap).forEach((canvas) => {
      const objectsToRemove = canvas.getObjects().filter(obj => {
        // Keep guide boxes and snap lines
        if (obj.excludeFromExport) return false;

        // Keep the background product image by checking its ID
        // @ts-expect-error - Checking custom data property
        if (obj.data?.id === 'background-product-image') return false;

        // Remove all other user-added objects
        return true;
      });
      objectsToRemove.forEach(obj => canvas.remove(obj));
      canvas.requestRenderAll();
    });

    // Reset all state to initial values (including canvasMap to prevent ghost designs)
    set({
      canvasMap: {},
      imageLoadedMap: {},
      activeSideId: 'front',
      isEditMode: false,
      productColor: '#FFFFFF',
      layerColors: {},
      zoomLevels: {},
      canvasVersion: 0,
    });
  },
}));
