
'use client'
import React, {useEffect, useRef, useState} from 'react';
import * as fabric from "fabric";
import { ProductSide, ProductLayer } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import ScaleBox from './ScaleBox';
import { formatMm, calculateObjectDimensionsMm, updateObjectDimensionsData } from '@/lib/canvasUtils';
// Import CurvedText to register the class with fabric.js for deserialization
import '@/lib/curvedText';


interface SingleSideCanvasProps {
  side: ProductSide;
  width?: number; // these are optional because there will be a default value
  height?: number; // ''
  isEdit?: boolean; // whether canvas is in edit mode
  onCanvasReady?: (canvas: fabric.Canvas, sideId: string, canvasScale: number) => void;
  productColor?: string; // override color for standalone use (e.g. logo placement)
  showScaleBox?: boolean;
}

const SingleSideCanvas: React.FC<SingleSideCanvasProps> = ({
  side,
  width = 500,
  height = 500,
  isEdit = false,
  onCanvasReady,
  productColor: productColorProp,
  showScaleBox = true,
}) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const isEditRef = useRef(isEdit);
  const productImageRef = useRef<fabric.FabricImage | null>(null);
  const layerImagesRef = useRef<Map<string, fabric.FabricImage>>(new Map());
  const loadSessionRef = useRef(0);

  const { registerCanvas, unregisterCanvas, productColor: productColorFromStore, markImageLoaded, incrementCanvasVersion, initializeLayerColors, initializeSideColor, layerColors, resetZoom, zoomLevels } = useCanvasStore();
  const productColor = productColorProp ?? productColorFromStore;
  const zoomLevel = zoomLevels[side.id] || 1.0;

  // Pan/drag state (for viewport movement while zoomed)
  const isSpacePressedRef = useRef(false);
  const isPointerOverCanvasRef = useRef(false);
  const isMousePanningRef = useRef(false);
  const isTouchPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchMidpointRef = useRef<{ x: number; y: number } | null>(null);
  const panRestoreStateRef = useRef<{
    selection: boolean;
    skipTargetFind: boolean;
    defaultCursor: string;
  } | null>(null);

  // Loading state to track when all images are loaded
  const [isLoading, setIsLoading] = useState(true);

  // Track when layers are fully loaded and ready for color application
  const [layersReady, setLayersReady] = useState(false);

  // Scale box state
  const [scaleBoxVisible, setScaleBoxVisible] = useState(false);
  const [scaleBoxDimensions, setScaleBoxDimensions] = useState({
    x: '0mm',
    y: '0mm',
    width: '0mm',
    height: '0mm',
  });
  const [scaleBoxPosition, setScaleBoxPosition] = useState({ x: 0, y: 0 });

  // Update isEdit ref when prop changes
  useEffect(() => {
    isEditRef.current = isEdit;
  }, [isEdit]);

  // Reset layersReady when side changes
  useEffect(() => {
    setLayersReady(false);
  }, [side.id]);

  // Keep viewport transform within original canvas bounds whenever zoom changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const vpt = canvas.viewportTransform;
    if (!vpt) return;

    const zoom = canvas.getZoom();
    const w = canvas.getWidth();
    const h = canvas.getHeight();

    if (zoom <= 1) {
      vpt[4] = (w - w * zoom) / 2;
      vpt[5] = (h - h * zoom) / 2;
    } else {
      const minX = w - w * zoom;
      const minY = h - h * zoom;
      vpt[4] = Math.min(0, Math.max(minX, vpt[4]));
      vpt[5] = Math.min(0, Math.max(minY, vpt[5]));
    }

    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();
  }, [zoomLevel]);

  // Initialize canvas once
  useEffect(() => {
    const sessionId = ++loadSessionRef.current;
    let isDisposed = false;
    const isSessionActive = () => !isDisposed && loadSessionRef.current === sessionId;

    setIsLoading(true);
    setLayersReady(false);
    layerImagesRef.current.clear();
    productImageRef.current = null;

    if (!canvasEl.current) {
      return; // if the canvas element is not initialized properly pass this code
    }

    const canvas = new fabric.Canvas(canvasEl.current, {
      width,
      height,
      // backgroundColor: '#f3f3f3', // light gray background for visibility
      backgroundColor: '#EBEBEB',
      preserveObjectStacking: true, // keeps selected objects from jumping to front automatically
      selection: false, // Will be controlled by separate effect based on isEdit
    })

    canvasRef.current = canvas;

    // --- Viewport panning (space + drag on desktop, 2-finger drag on mobile) ---
    const clampViewportToCanvasBounds = () => {
      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      const zoom = canvas.getZoom();
      const w = canvas.getWidth();
      const h = canvas.getHeight();

      if (zoom <= 1) {
        vpt[4] = (w - w * zoom) / 2;
        vpt[5] = (h - h * zoom) / 2;
      } else {
        const minX = w - w * zoom;
        const minY = h - h * zoom;
        vpt[4] = Math.min(0, Math.max(minX, vpt[4]));
        vpt[5] = Math.min(0, Math.max(minY, vpt[5]));
      }

      canvas.setViewportTransform(vpt);
    };

    const startPan = (clientX: number, clientY: number) => {
      if (isMousePanningRef.current || isTouchPanningRef.current) return;
      if (canvas.getZoom() <= 1) return;

      panRestoreStateRef.current = {
        selection: canvas.selection,
        skipTargetFind: canvas.skipTargetFind || false,
        defaultCursor: canvas.defaultCursor || 'default',
      };

      canvas.discardActiveObject();
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.setCursor('grabbing');

      isMousePanningRef.current = true;
      lastPanPointRef.current = { x: clientX, y: clientY };
    };

    const continuePan = (clientX: number, clientY: number) => {
      const last = lastPanPointRef.current;
      if (!last) return;

      const dx = clientX - last.x;
      const dy = clientY - last.y;
      lastPanPointRef.current = { x: clientX, y: clientY };

      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      vpt[4] += dx;
      vpt[5] += dy;
      clampViewportToCanvasBounds();
      canvas.requestRenderAll();
    };

    const endPan = () => {
      if (!isMousePanningRef.current && !isTouchPanningRef.current) return;

      isMousePanningRef.current = false;
      isTouchPanningRef.current = false;
      lastPanPointRef.current = null;
      lastTouchMidpointRef.current = null;

      const restore = panRestoreStateRef.current;
      if (restore) {
        canvas.selection = restore.selection;
        canvas.skipTargetFind = restore.skipTargetFind;
      }

      if (isPointerOverCanvasRef.current && isSpacePressedRef.current && canvas.getZoom() > 1) {
        canvas.setCursor('grab');
      } else {
        canvas.setCursor(restore?.defaultCursor || canvas.defaultCursor || 'default');
      }

      clampViewportToCanvasBounds();
      canvas.requestRenderAll();
    };

    type CanvasPointerEvent = fabric.TPointerEventInfo<fabric.TPointerEvent> & {
      alreadySelected?: boolean;
    };

    const handleMouseDown = (opt: CanvasPointerEvent) => {
      const evt = opt.e;
      if (typeof TouchEvent !== 'undefined' && evt instanceof TouchEvent) return;
      if ((evt as MouseEvent).button !== 0) return;
      if (!isSpacePressedRef.current) return;
      if (canvas.getZoom() <= 1) return;

      evt.preventDefault();
      (evt as MouseEvent).preventDefault();
      startPan((evt as MouseEvent).clientX, (evt as MouseEvent).clientY);
    };

    const handleMouseMove = (opt: CanvasPointerEvent) => {
      if (!isMousePanningRef.current) return;
      const evt = opt.e;
      if (typeof TouchEvent !== 'undefined' && evt instanceof TouchEvent) return;
      (evt as MouseEvent).preventDefault();
      continuePan((evt as MouseEvent).clientX, (evt as MouseEvent).clientY);
    };

    const handleMouseUp = () => {
      if (!isMousePanningRef.current) return;
      endPan();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    const upperEl = canvas.upperCanvasEl;
    const handleUpperMouseEnter = () => {
      isPointerOverCanvasRef.current = true;
      if (isSpacePressedRef.current && canvas.getZoom() > 1) {
        canvas.setCursor('grab');
      }
    };
    const handleUpperMouseLeave = () => {
      isPointerOverCanvasRef.current = false;
      if (isMousePanningRef.current) endPan();
      if (!isMousePanningRef.current && !isTouchPanningRef.current) {
        const restore = panRestoreStateRef.current;
        canvas.setCursor(restore?.defaultCursor || canvas.defaultCursor || 'default');
      }
    };
    upperEl.addEventListener('mouseenter', handleUpperMouseEnter);
    upperEl.addEventListener('mouseleave', handleUpperMouseLeave);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      if (canvas.getZoom() <= 1) return;

      e.preventDefault();
      const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;

      if (isMousePanningRef.current) endPan();
      if (!isTouchPanningRef.current) {
        panRestoreStateRef.current = {
          selection: canvas.selection,
          skipTargetFind: canvas.skipTargetFind || false,
          defaultCursor: canvas.defaultCursor || 'default',
        };
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.setCursor('grabbing');
      }

      isTouchPanningRef.current = true;
      lastTouchMidpointRef.current = { x: midX, y: midY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchPanningRef.current) return;
      if (e.touches.length !== 2) {
        endPan();
        return;
      }

      e.preventDefault();
      const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
      const last = lastTouchMidpointRef.current;
      if (!last) {
        lastTouchMidpointRef.current = { x: midX, y: midY };
        return;
      }

      const dx = midX - last.x;
      const dy = midY - last.y;
      lastTouchMidpointRef.current = { x: midX, y: midY };

      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      vpt[4] += dx;
      vpt[5] += dy;
      clampViewportToCanvasBounds();
      canvas.requestRenderAll();
    };

    const handleTouchEnd = () => {
      if (!isTouchPanningRef.current) return;
      endPan();
    };

    upperEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    upperEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    upperEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    upperEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;

      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      isSpacePressedRef.current = true;

      if (!isTypingTarget && (isPointerOverCanvasRef.current || isMousePanningRef.current || isTouchPanningRef.current)) {
        e.preventDefault();
      }

      if (isPointerOverCanvasRef.current && canvas.getZoom() > 1 && !isMousePanningRef.current && !isTouchPanningRef.current) {
        canvas.setCursor('grab');
      }
    };

    const handleWindowKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      isSpacePressedRef.current = false;

      if (isMousePanningRef.current || isTouchPanningRef.current) return;
      const restore = panRestoreStateRef.current;
      canvas.setCursor(restore?.defaultCursor || canvas.defaultCursor || 'default');
    };

    const handleWindowMouseUp = () => {
      if (isMousePanningRef.current) endPan();
    };

    const handleWindowBlur = () => {
      isSpacePressedRef.current = false;
      if (isMousePanningRef.current || isTouchPanningRef.current) endPan();
    };

    window.addEventListener('keydown', handleWindowKeyDown, { passive: false });
    window.addEventListener('keyup', handleWindowKeyUp);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', handleWindowBlur);

    fabric.InteractiveFabricObject.ownDefaults = {
    ...fabric.InteractiveFabricObject.ownDefaults,
    cornerStyle: 'circle',
    cornerColor: 'lightblue',
    transparentCorners: false,
    borderColor: 'blue',
    borderScaleFactor: 1,
    _controlsVisibility: {
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    }
}

    // Register this canvas to the global store
    registerCanvas(side.id, canvas)


    // -- For calculations
    const printW = side.printArea.width;
    const printH = side.printArea.height;

    // Temporary centered position (will be updated when image loads)
    const tempCenteredLeft = (width - printW) / 2;
    const tempCenteredTop = (height - printH) / 2;
    const tempPrintCenterX = tempCenteredLeft + (printW / 2);

    // Check if side has layers (multi-layer mode) or single imageUrl (legacy mode)
    const hasLayers = side.layers && side.layers.length > 0;

    // Creating the Snap Line (Vertical)
    // For multi-layer mode: use canvas center
    // For single-image mode: use print area center (will be updated when image loads)
    const snapLineCenterX = hasLayers ? width / 2 : tempPrintCenterX;
    const snapLineTop = hasLayers ? 0 : tempCenteredTop;
    const snapLineBottom = hasLayers ? height : tempCenteredTop + printH;

    const verticalSnapLine = new fabric.Line(
      [snapLineCenterX, snapLineTop, snapLineCenterX, snapLineBottom],
      {
        stroke: '#FF0072', // Hot pink
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false, // Hidden by default
        excludeFromExport: true, // Don't save this in the image
        data: {id: 'center-line'}
      }
    )
    canvas.add(verticalSnapLine)


    if (hasLayers) {
      // Multi-layer mode: Initialize layer colors and load all layers
      initializeLayerColors(side.id, side.layers!);

      // Sort layers by zIndex
      const sortedLayers = [...side.layers!].sort((a, b) => a.zIndex - b.zIndex);

      // Helper function to ensure image is fully loaded and decoded
      // This pre-loads the image using native Image() before passing to Fabric.js
      const ensureImageFullyLoaded = async (imageUrl: string, maxRetries = 3): Promise<fabric.FabricImage | null> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (!isSessionActive()) return null;

          try {
            // Step 1: Pre-load using native Image() to ensure it's fully available
            const nativeImg = new Image();
            nativeImg.crossOrigin = 'anonymous';

            // Create a promise that resolves when the image is fully loaded
            const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
              let timeoutId: ReturnType<typeof setTimeout> | null = null;
              nativeImg.onload = () => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(nativeImg);
              };
              nativeImg.onerror = () => {
                if (timeoutId) clearTimeout(timeoutId);
                reject(new Error(`Failed to load image: ${imageUrl}`));
              };
              // Set timeout for image loading
              timeoutId = setTimeout(() => reject(new Error('Image load timeout')), 30000);
            });

            // Start loading the image
            nativeImg.src = imageUrl;

            // Wait for the image to load
            const loadedImg = await imageLoadPromise;
            if (!isSessionActive()) return null;

            // Step 2: Decode the image to ensure it's fully decoded in memory
            if (loadedImg.decode) {
              await loadedImg.decode();
            }
            if (!isSessionActive()) return null;

            // Step 3: Verify dimensions
            const imgWidth = loadedImg.naturalWidth;
            const imgHeight = loadedImg.naturalHeight;

            if (imgWidth === 0 || imgHeight === 0) {
              throw new Error(`Invalid dimensions: ${imgWidth}x${imgHeight}`);
            }

            // Step 4: Now create Fabric.js image from the pre-loaded native image
            // This is much more reliable than fromURL because the image is already loaded
            const fabricImg = new fabric.FabricImage(loadedImg, {
              crossOrigin: 'anonymous'
            });
            if (!isSessionActive()) return null;

            // Final verification
            if (!fabricImg || fabricImg.width === 0 || fabricImg.height === 0) {
              throw new Error(`Fabric image creation failed or has invalid dimensions`);
            }

            return fabricImg;

          } catch {
            if (attempt === maxRetries) {
              return null;
            }

            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        return null;
      };

      // Load all layer images sequentially (one by one) to guarantee all images load
      const loadLayersSequentially = async () => {
        const validResults: Array<{ img: fabric.FabricImage; scale: number; imgWidth: number; imgHeight: number; layer: ProductLayer }> = [];

        for (const layer of sortedLayers) {
          if (!isSessionActive()) break;

          try {
            const img = await ensureImageFullyLoaded(layer.imageUrl);
            if (!isSessionActive()) break;

            if (!img) {
              continue;
            }

            // Scale the image to fit the canvas
            const imgWidth = img.width || 0;
            const imgHeight = img.height || 0;

            // Get zoom scale from side configuration
            const zoomScale = side.zoomScale || 1.0;
            const baseScale = Math.min(width / imgWidth, height / imgHeight);
            const scale = baseScale * zoomScale;

            img.set({
              scaleX: scale,
              scaleY: scale,
              originX: 'center',
              originY: 'center',
              left: width / 2,
              top: height / 2,
              selectable: false,
              evented: false,
              lockMovementX: true,
              lockMovementY: true,
              lockRotation: true,
              lockScalingX: true,
              lockScalingY: true,
              hasControls: false,
              hasBorders: false,
              // Add drop shadow only to the bottom-most layer to avoid stacked shadows
              ...(layer === sortedLayers[0] && {
                shadow: new fabric.Shadow({
                  color: 'rgba(0,0,0,0.25)',
                  blur: 15,
                  offsetX: 0,
                  offsetY: 4,
                }),
              }),
              data: {
                id: 'background-product-image',
                layerId: layer.id
              },
            });

            // Store reference to this layer image (before applying filters)
            layerImagesRef.current.set(layer.id, img);

            validResults.push({ img, scale, imgWidth, imgHeight, layer });
          } catch {
            // Catch individual layer loading errors to prevent one failure from breaking all layers
            // Continue to next layer instead of stopping the entire process
          }
        }

        return validResults;
      };

      // Execute sequential loading
      loadLayersSequentially().then((validResults) => {
        if (!isSessionActive()) return;

        if (validResults.length === 0) {
          setIsLoading(false);
          return;
        }

        // Use the first layer's dimensions for calculations
        const firstResult = validResults[0]!;
        const { scale, imgWidth, imgHeight } = firstResult;

        // Add all layer images to canvas in z-index order (bottom to top)
        // Add layers to canvas FIRST without color filters
        // Color filters will be applied by the effect after all layers are confirmed loaded
        sortedLayers.forEach((layer) => {
          const layerImg = layerImagesRef.current.get(layer.id);
          if (layerImg) {
            canvas.add(layerImg);
          }
        });

        // Send all layers to the back in reverse order to maintain zIndex
        // This ensures layers are at the very bottom, below guide elements
        for (let i = sortedLayers.length - 1; i >= 0; i--) {
          const layer = sortedLayers[i];
          const layerImg = layerImagesRef.current.get(layer.id);
          if (layerImg) {
            canvas.sendObjectToBack(layerImg);
          }
        }

        // Calculate print area position relative to the first layer
        const scaledPrintW = side.printArea.width * scale;
        const scaledPrintH = side.printArea.height * scale;
        const scaledPrintX = side.printArea.x * scale;
        const scaledPrintY = side.printArea.y * scale;

        const imageLeft = (width / 2) - (imgWidth * scale / 2);
        const imageTop = (height / 2) - (imgHeight * scale / 2);

        const printAreaLeft = imageLeft + scaledPrintX;
        const printAreaTop = imageTop + scaledPrintY;
        const printCenterX = printAreaLeft + (scaledPrintW / 2);

        // Update vertical snap line
        // For multi-layer mode, keep it at canvas center spanning full height
        verticalSnapLine.set({
          x1: width / 2,
          y1: 0,
          x2: width / 2,
          y2: height,
        });

        // Store values for use in event handlers
        // @ts-expect-error - Adding custom properties
        canvas.printAreaLeft = printAreaLeft;
        // @ts-expect-error - Custom property
        canvas.printAreaTop = printAreaTop;
        // @ts-expect-error - Custom property
        canvas.printAreaWidth = scaledPrintW;
        // @ts-expect-error - Custom property
        canvas.printAreaHeight = scaledPrintH;
        // @ts-expect-error - Custom property
        canvas.printCenterX = printCenterX;
        // @ts-expect-error - Custom property
        canvas.originalImageWidth = imgWidth;
        // @ts-expect-error - Custom property
        canvas.originalImageHeight = imgHeight;
        // @ts-expect-error - Custom property
        canvas.scaledImageWidth = imgWidth * scale;
        // @ts-expect-error - Custom property
        canvas.scaledImageHeight = imgHeight * scale;
        // @ts-expect-error - Custom property
        canvas.realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;

        // For multi-layer mode, store canvas center as the snap center
        // @ts-expect-error - Custom property
        canvas.printCenterX = width / 2;

        // Force a render to ensure all objects are processed by Fabric.js
        canvas.requestRenderAll();

        // Wait for next animation frame to ensure Fabric.js has completed rendering
        // This guarantees all layer images are properly initialized before showing the canvas
        requestAnimationFrame(() => {
          if (!isSessionActive()) return;

          // Mark image as loaded in store
          markImageLoaded(side.id);

          // All layers loaded, added, and rendered - mark as ready
          // Set layersReady to trigger the color application effect
          setLayersReady(true);
          setIsLoading(false);

          if (onCanvasReady) {
            onCanvasReady(canvas, side.id, scale);
          }
        });
      }).catch(() => {
        if (!isSessionActive()) return;
        setIsLoading(false);
      });
    } else {
      // Legacy single-image mode: use imageUrl
      const imageUrl = side.imageUrl;
      if (!imageUrl) {
        setIsLoading(false);
        return;
      }

      // Helper function to ensure single image is fully loaded and decoded
      const loadSingleImage = async () => {
        try {
          // First, load the image using Fabric.js
          const img = await fabric.FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });

          if (!img) {
            return null;
          }

          // Get the underlying HTMLImageElement
          const imgElement = img.getElement() as HTMLImageElement;

          // Ensure the image is fully loaded
          if (!imgElement.complete) {
            await new Promise<void>((resolve, reject) => {
              imgElement.onload = () => resolve();
              imgElement.onerror = () => reject(new Error('Image failed to load'));
              // Add timeout to prevent infinite waiting
              setTimeout(() => reject(new Error('Image load timeout')), 30000);
            });
          }

          // Use the decode() API to ensure the image is fully decoded
          if (imgElement.decode) {
            await imgElement.decode();
          }

          // Verify dimensions after decode
          const imgWidth = img.width || 0;
          const imgHeight = img.height || 0;

          if (imgWidth === 0 || imgHeight === 0) {
            return null;
          }

          return img;
        } catch {
          return null;
        }
      };

      loadSingleImage().then((img) => {
        if (!isSessionActive()) return;

        if (!img) {
          setIsLoading(false);
          return;
        }

        // Scale the image to fit the canvas (basically contains the image inside the canvas)
        const imgWidth = img.width || 0;
        const imgHeight = img.height || 0;

        // Get zoom scale from side configuration (default to 1.0 if not provided)
        const zoomScale = side.zoomScale || 1.0;

        // for changing the scaling of the image based on the canvas's width and height
        const baseScale = Math.min(width / imgWidth, height / imgHeight);
        const scale = baseScale * zoomScale;

        img.set({
          scaleX: scale,
          scaleY: scale,
          originX: 'center',
          originY: 'center',
          left: width / 2,
          top: height / 2,
          selectable: false, // Users should not be able move the t-shirt itself
          evented: false, // Clicks pass through the objects behind (if any) or canvas
          lockMovementX: true, // Prevent any horizontal movement
          lockMovementY: true, // Prevent any vertical movement
          lockRotation: true, // Prevent rotation
          lockScalingX: true, // Prevent scaling
          lockScalingY: true, // Prevent scaling
          hasControls: false, // Remove all controls
          hasBorders: false, // Remove borders
          shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.25)',
            blur: 15,
            offsetX: 0,
            offsetY: 4,
          }),
          data: { id: 'background-product-image' }, // Custom data to identify this as the background
        });

        // Store reference to the product image
        productImageRef.current = img;

        canvas.add(img);
        canvas.sendObjectToBack(img); // ensure it stays behind design elements

        // Initialize color from configuration if colorOptions are available
        if (side.colorOptions && side.colorOptions.length > 0) {
          initializeSideColor(side.id, side.colorOptions);
        }

        // Apply initial color filter using color from configuration or fallback to productColor
        const currentColor = side.colorOptions && side.colorOptions.length > 0
          ? useCanvasStore.getState().layerColors[side.id]?.[side.id] || side.colorOptions[0]?.hex || '#FFFFFF'
          : (productColorProp ?? useCanvasStore.getState().productColor);
        img.filters = [];
        const initialColorFilter = new fabric.filters.BlendColor({
          color: currentColor,
          mode: 'multiply',
          alpha: 1,
        });
        img.filters.push(initialColorFilter);
        img.applyFilters();

        // Calculate print area position relative to the product image
        // The print area coordinates are in the original image pixel space
        // We need to scale them and position them relative to the scaled image

        // Scale the print area dimensions to match the image scale
        const scaledPrintW = side.printArea.width * scale;
        const scaledPrintH = side.printArea.height * scale;
        const scaledPrintX = side.printArea.x * scale;
        const scaledPrintY = side.printArea.y * scale;

        // Calculate the position of the scaled image on the canvas
        // The image is centered, so we need to account for that
        const imageLeft = (width / 2) - (imgWidth * scale / 2);
        const imageTop = (height / 2) - (imgHeight * scale / 2);

        // Position the print area relative to the image position
        const printAreaLeft = imageLeft + scaledPrintX;
        const printAreaTop = imageTop + scaledPrintY;
        const printCenterX = printAreaLeft + (scaledPrintW / 2);

        // Update vertical snap line
        verticalSnapLine.set({
          x1: printCenterX,
          y1: printAreaTop,
          x2: printCenterX,
          y2: printAreaTop + scaledPrintH,
        });

        // Store these values for use in event handlers and pricing calculations
        // @ts-expect-error - Adding custom properties to fabric.Canvas for print area tracking
        canvas.printAreaLeft = printAreaLeft;
        // @ts-expect-error - Custom property
        canvas.printAreaTop = printAreaTop;
        // @ts-expect-error - Custom property
        canvas.printAreaWidth = scaledPrintW;
        // @ts-expect-error - Custom property
        canvas.printAreaHeight = scaledPrintH;
        // @ts-expect-error - Custom property
        canvas.printCenterX = printCenterX;

        // Store original and scaled image dimensions for accurate pixel-to-mm conversion
        // @ts-expect-error - Custom property
        canvas.originalImageWidth = imgWidth;
        // @ts-expect-error - Custom property
        canvas.originalImageHeight = imgHeight;
        // @ts-expect-error - Custom property
        canvas.scaledImageWidth = imgWidth * scale;
        // @ts-expect-error - Custom property
        canvas.scaledImageHeight = imgHeight * scale;
        // @ts-expect-error - Custom property
        canvas.realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;

        // Force a render to ensure all objects are processed by Fabric.js
        canvas.requestRenderAll();

        // Wait for next animation frame to ensure Fabric.js has completed rendering
        // This guarantees the image is properly initialized before showing the canvas
        requestAnimationFrame(() => {
          if (!isSessionActive()) return;

          // Mark image as loaded in store
          markImageLoaded(side.id);

          // Single image loaded and rendered - mark as ready
          setIsLoading(false);

          if (onCanvasReady) {
            onCanvasReady(canvas, side.id, scale);
          }
        });
      })
      .catch(() => {
        if (!isSessionActive()) return;
        setIsLoading(false);
      });
    }

    // Helper function to update scale box with object dimensions
    const updateScaleBox = (obj: fabric.FabricObject | fabric.ActiveSelection) => {
        // Get the scaled product image width on the canvas
        // @ts-expect-error - Custom property
        const scaledImageWidth = canvas.scaledImageWidth;
        // @ts-expect-error - Custom property
        const scaledPrintLeft = canvas.printAreaLeft || 0;
        // @ts-expect-error - Custom property
        const scaledPrintTop = canvas.printAreaTop || 0;

        // Get real-world product width from product data
        const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;

        // Calculate dimensions using the reusable utility function
        const dimensions = calculateObjectDimensionsMm(obj, {
          scaledImageWidth,
          scaledPrintLeft,
          scaledPrintTop,
          realWorldProductWidth,
        });

        // Get bounding rect for positioning the scale box
        const boundingRect = obj.getBoundingRect();

        setScaleBoxDimensions({
          x: formatMm(dimensions.x),
          y: formatMm(dimensions.y),
          width: formatMm(dimensions.width),
          height: formatMm(dimensions.height),
        });

        // Position at the bottom of the object's bounding box at the horizontal center
        setScaleBoxPosition({
          x: boundingRect.left + boundingRect.width / 2,
          y: boundingRect.top + boundingRect.height + 14,
        });

        setScaleBoxVisible(true);
    };

    // Show when an object is selected
    canvas.on('selection:created', () => {
        // Get the active object (which could be a single object or ActiveSelection for multiple)
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          updateScaleBox(activeObject);
        }
    });

    canvas.on('selection:updated', () => {
        // Get the active object (which could be a single object or ActiveSelection for multiple)
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          updateScaleBox(activeObject);
        }
    });

    // Hide when selection is cleared
    canvas.on('selection:cleared', () => {
        setScaleBoxVisible(false);
    });

    canvas.on('object:added', (e) => {
        const obj = e.target;
        // Skip guide boxes, snap lines, and background product image
        // @ts-expect-error - Checking custom data property
        if (!obj || obj.excludeFromExport || (obj.data?.id === 'background-product-image')) return;

        // Assign a unique ID to each user-added object if it doesn't have one
        // @ts-expect-error - Setting custom data property
        if (!obj.data) obj.data = {};
        // @ts-expect-error - Setting custom data property
        if (!obj.data.objectId) {
          // @ts-expect-error - Setting custom data property
          obj.data.objectId = `${side.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Migrate old print method values or set default
        // @ts-expect-error - Checking custom data property
        const currentPrintMethod = obj.data.printMethod;

        // Migration: Convert old 'printing' value to 'dtf'
        if (currentPrintMethod === 'printing') {
          // @ts-expect-error - Setting custom data property
          obj.data.printMethod = 'dtf';
        }
        // Set default for new objects without print method
        else if (!currentPrintMethod && obj.type !== 'image') {
          // @ts-expect-error - Setting custom data property
          obj.data.printMethod = 'dtf'; // Default to DTF for new objects
        }

        // Update object dimensions in mm
        // @ts-expect-error - Custom property
        const scaledImageWidth = canvas.scaledImageWidth;
        const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
        if (scaledImageWidth) {
          updateObjectDimensionsData(obj, scaledImageWidth, realWorldProductWidth);
        }

        // Make objects selectable based on current edit mode
        obj.selectable = isEditRef.current;
        obj.evented = isEditRef.current;

        // Increment canvas version to trigger updates in components that depend on canvas state
        incrementCanvasVersion();
    })

    const snapThreshold = 10;

    // Update scale box and dimensions during object transformations
    canvas.on('object:scaling', (e) => {
        if (e.target) {
          updateScaleBox(e.target);
          // Update dimensions in mm
          // @ts-expect-error - Custom property
          const scaledImageWidth = canvas.scaledImageWidth;
          const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
          if (scaledImageWidth) {
            updateObjectDimensionsData(e.target, scaledImageWidth, realWorldProductWidth);
          }
        }
    });

    canvas.on('object:rotating', (e) => {
        if (e.target) {
          updateScaleBox(e.target);
          // Update dimensions in mm
          // @ts-expect-error - Custom property
          const scaledImageWidth = canvas.scaledImageWidth;
          const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
          if (scaledImageWidth) {
            updateObjectDimensionsData(e.target, scaledImageWidth, realWorldProductWidth);
          }
        }
    });

    canvas.on('object:modified', (e) => {
        if (e.target) {
          updateScaleBox(e.target);
          // Update dimensions in mm
          // @ts-expect-error - Custom property
          const scaledImageWidth = canvas.scaledImageWidth;
          const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
          if (scaledImageWidth) {
            updateObjectDimensionsData(e.target, scaledImageWidth, realWorldProductWidth);
          }
        }
        // Increment canvas version when object is modified (color, size, etc.)
        incrementCanvasVersion();
    });

    // Increment canvas version when object is removed
    canvas.on('object:removed', (e) => {
        const obj = e.target;
        // Skip guide boxes, snap lines, and background product image
        // @ts-expect-error - Checking custom data property
        if (!obj || obj.excludeFromExport || (obj.data?.id === 'background-product-image')) return;

        incrementCanvasVersion();
    });

    canvas.on('object:moving', (e) => {
        const obj = e.target;
        if (!obj) return; // for error handling if there is no object

        // Update scale box position during movement
        updateScaleBox(obj);

        const objCenter = obj.getCenterPoint();

        // Get the current print center X (will be updated after image loads)
        // @ts-expect-error - Custom property
        const currentPrintCenterX = canvas.printCenterX || tempPrintCenterX;

        // 1. Snap: force the object to the center line
        if (Math.abs(objCenter.x - currentPrintCenterX) < snapThreshold) {
          obj.setPositionByOrigin(
            new fabric.Point(currentPrintCenterX, objCenter.y),
            'center',
            'center'
          );
          verticalSnapLine.set('visible', true);
        } else {
          verticalSnapLine.set('visible', false)
        }
    });

    canvas.on('mouse:up', () => {
        verticalSnapLine.set('visible', false);
        canvas.requestRenderAll();
    });

    return () => {
      isDisposed = true;
      loadSessionRef.current++;
      unregisterCanvas(side.id);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      upperEl.removeEventListener('mouseenter', handleUpperMouseEnter);
      upperEl.removeEventListener('mouseleave', handleUpperMouseLeave);
      upperEl.removeEventListener('touchstart', handleTouchStart);
      upperEl.removeEventListener('touchmove', handleTouchMove);
      upperEl.removeEventListener('touchend', handleTouchEnd);
      upperEl.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [side, height, width, registerCanvas, unregisterCanvas, markImageLoaded, incrementCanvasVersion, initializeLayerColors, initializeSideColor]);

  // Separate effect to update selection state when isEdit changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset zoom when entering or exiting edit mode
    resetZoom(side.id);

    canvas.selection = isEdit;
    canvas.forEachObject((obj) => {
      // Skip guide boxes and snap lines
      if (obj.excludeFromExport) return;

      // Skip the product background image (check by ID)
      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image') {
        // Ensure background stays locked regardless of edit mode
        obj.selectable = false;
        obj.evented = false;
        return;
      }

      // Make all other objects (including user-added images) selectable/editable
      obj.selectable = isEdit;
      obj.evented = isEdit;
    });
    canvas.requestRenderAll();
  }, [isEdit, side.id, resetZoom]);

  // Effect to apply color filter when color changes (single-image mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only apply in single-image mode (when side has no layers)
    if (side.layers && side.layers.length > 0) return;

    // Determine which color to use:
    // 1. If side has colorOptions, use color from layerColors (using sideId as layerId)
    // 2. Otherwise, fall back to global productColor for legacy mode
    const selectedColor = side.colorOptions && side.colorOptions.length > 0
      ? layerColors[side.id]?.[side.id] || side.colorOptions[0]?.hex || '#FFFFFF'
      : productColor;

    // Find all objects with id 'background-product-image' and apply color filter
    canvas.forEachObject((obj) => {
      // @ts-expect-error - Checking custom data property
      if (obj.data?.id === 'background-product-image' && obj.type === 'image') {
        const imgObj = obj as fabric.FabricImage;

        // Remove any existing filters
        imgObj.filters = [];

        const colorFilter = new fabric.filters.BlendColor({
          color: selectedColor,
          mode: 'multiply',
          alpha: 1, // Adjust opacity of the color overlay
        });

        imgObj.filters.push(colorFilter);
        imgObj.applyFilters();
      }
    });

    canvas.requestRenderAll();
  }, [productColor, side.layers, side.colorOptions, side.id, layerColors]);

  // Effect to apply color filter to layers when layerColors change or layers are ready
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only apply in multi-layer mode
    if (!side.layers || side.layers.length === 0) return;

    // Wait for layers to be loaded before applying colors
    if (!layersReady) {
      return;
    }

    // Build a lookup of layerId -> images on canvas to handle duplicates reliably
    const layerImagesById = new Map<string, fabric.FabricImage[]>();
    canvas.getObjects().forEach((obj) => {
      if (obj.type !== 'image') return;
      // @ts-expect-error - Checking custom data property
      const dataId = obj.data?.id;
      // @ts-expect-error - Checking custom data property
      const dataLayerId = obj.data?.layerId as string | undefined;
      if (dataId !== 'background-product-image' || !dataLayerId) return;
      const list = layerImagesById.get(dataLayerId) || [];
      list.push(obj as fabric.FabricImage);
      layerImagesById.set(dataLayerId, list);
    });

    // Update each layer's color based on layerColors state
    side.layers.forEach((layer) => {
      const canvasLayerImages = layerImagesById.get(layer.id) || [];
      const refLayerImage = layerImagesRef.current.get(layer.id);
      const layerImages = canvasLayerImages.length > 0
        ? canvasLayerImages
        : (refLayerImage ? [refLayerImage] : []);

      if (layerImages.length === 0) {
        return;
      }

      const selectedColor = layerColors[side.id]?.[layer.id] || layer.colorOptions[0]?.hex || '#FFFFFF';

      layerImages.forEach((layerImg) => {
        // Remove any existing filters
        layerImg.filters = [];

        const colorFilter = new fabric.filters.BlendColor({
          color: selectedColor,
          mode: 'multiply',
          alpha: 1,
        });

        layerImg.filters.push(colorFilter);
        layerImg.applyFilters();
      });
    });

    canvas.requestRenderAll();
  }, [layerColors, side.id, side.layers, layersReady]);

  return (
    <div className="relative" style={{ width, height }}>
      <div
        className="absolute inset-0 flex items-center justify-center bg-[#EBEBEB] transition-opacity duration-300"
        style={{ width, height, opacity: isLoading ? 1 : 0, pointerEvents: isLoading ? 'auto' : 'none' }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="text-sm text-gray-600">불러오는중...</p>
        </div>
      </div>
      <canvas
        ref={canvasEl}
        style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s', touchAction: 'none' }}
      />
      {showScaleBox && (
        <ScaleBox
          x={scaleBoxDimensions.x}
          y={scaleBoxDimensions.y}
          width={scaleBoxDimensions.width}
          height={scaleBoxDimensions.height}
          position={scaleBoxPosition}
          visible={scaleBoxVisible}
        />
      )}
    </div>
  )
}

export default SingleSideCanvas;
