import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Plus, TextCursor, Layers, FileImage, Trash2, RefreshCcw, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, LayoutTemplate, ChevronLeft, MapPin } from 'lucide-react';
import { ProductSide } from '@/types/types';
import TextStylePanel from './TextStylePanel';
import TemplatePicker from './TemplatePicker';
import { isCurvedText } from '@/lib/curvedText';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';
import { createClient } from '@/lib/supabase-client';
import { convertToPNG, isAiOrPsdFile, getConversionErrorMessage, MAX_UPLOAD_BYTES } from '@/lib/imageConvert';
import { trimFileToAlphaBounds } from '@/lib/imageAlphaTrim';
import { fetchProductCalibrations, calibrationToCanvasMmPerPx } from '@/lib/calibrationFetch';
import type { AnchorPreset } from '@/lib/anchorPresets';
import { snapArtworkToAnchor } from '@/lib/anchorSnap';
import { drawAnchorPreviews, clearAnchorPreviews } from './anchorPreviewLayer';
import AnchorPresetPanel from './AnchorPresetPanel';
import LoadingModal from '@/app/components/LoadingModal';
import { trackDesignAction } from '@/lib/gtm-events';
import {
  BackgroundRemovalFlow,
  preloadBackgroundRemoval,
  type FlowResult,
} from '@/app/components/background-removal/BackgroundRemovalFlow';
import { addDesignerPendingBadge } from './designerPendingBadge';
import FreeFormCropper from './FreeFormCropper';

interface ToolbarProps {
  sides?: ProductSide[];
  handleExitEditMode?: () => void;
  variant?: 'mobile' | 'desktop';
  productId?: string;
  onColorPress?: () => void;
  displayColor?: string;
  hasColorOptions?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ sides = [], handleExitEditMode, variant = 'mobile', productId, onColorPress, displayColor, hasColorOptions }) => {
  const { getActiveCanvas, activeSideId, setActiveSide, isEditMode, canvasMap, incrementCanvasVersion, zoomIn, zoomOut, getZoomLevel, anchorPanelOpen, setAnchorPanelOpen, hoveredAnchorId, setHoveredAnchorId, setLayersPanelOpen } = useCanvasStore();
  const layersLabEnabled = useSearchParams()?.get('layers-lab') === '1';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const currentZoom = getZoomLevel();
  const isDesktop = variant === 'desktop';

  // Loading modal state
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubmessage, setLoadingSubmessage] = useState('');

  // Image upload modal state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUploadAgreed, setImageUploadAgreed] = useState(false);

  // Background-removal modal state. Opens after agreement → file picker → (AI/PSD
  // conversion). The pending file pair is the PNG-ready blob (for bg-removal)
  // plus the user's original (for designer-request source upload).
  type BgPending = {
    pngFile: File;
    sourceFile: File;
    sourceUrl: string | null;
    sourcePath: string | null;
  };
  const [bgPending, setBgPending] = useState<BgPending | null>(null);
  const [bgModalOpen, setBgModalOpen] = useState(false);
  // Crop step (free-form) sits between file pick and bg-removal modal.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  // const canvas = getActiveCanvas();

  // Anchor preset panel state는 스토어에서 공유(데스크톱은 우측 aside에 도킹).
  const [sideAnchors, setSideAnchors] = useState<AnchorPreset[]>([]);
  // 호버한 앵커 1개만 캔버스에 라벨까지 미리보기. 미호버 시 박스만(라벨 X) → 겹침 방지.
  const hoveredAnchor = hoveredAnchorId ? (sideAnchors.find((a) => a.id === hoveredAnchorId) ?? null) : null;
  // Fetched native (original-mockup-px) mm-per-px for the active side. Used directly
  // (instead of reading canvas property) so panel/snap/preview don't race with
  // SingleSideCanvas calibration effect.
  const [nativeMmPerPxForSide, setNativeMmPerPxForSide] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    if (!productId || !activeSideId) {
      setSideAnchors([]);
      setNativeMmPerPxForSide(0);
      return;
    }
    fetchProductCalibrations(productId).then((map) => {
      if (cancelled) return;
      const cal = map.get(activeSideId);
      setSideAnchors(cal?.anchors ?? []);
      setNativeMmPerPxForSide(cal?.nativeMmPerPx ?? 0);
    }).catch(() => {
      if (!cancelled) {
        setSideAnchors([]);
        setNativeMmPerPxForSide(0);
      }
    });
    return () => { cancelled = true; };
  }, [productId, activeSideId]);

  // Resolve canvas-pixel mmPerPx using the directly-fetched calibration when
  // available (preferred — avoids race with SingleSideCanvas effect), then
  // legacy productWidthMm fallback.
  const resolveCanvasGeometry = (): {
    mmPerPx: number;
    mockupLeft: number;
    mockupTop: number;
  } | null => {
    const canvas = getActiveCanvas();
    if (!canvas) return null;
    // @ts-expect-error - Custom property
    const sw = canvas.scaledImageWidth as number | undefined;
    // @ts-expect-error - Custom property
    const ow = canvas.originalImageWidth as number | undefined;
    // @ts-expect-error - Custom property
    const mockupLeft = (canvas.mockupCanvasLeft as number | undefined) ?? 0;
    // @ts-expect-error - Custom property
    const mockupTop = (canvas.mockupCanvasTop as number | undefined) ?? 0;
    if (nativeMmPerPxForSide > 0 && sw && ow) {
      const r = calibrationToCanvasMmPerPx({
        nativeMmPerPx: nativeMmPerPxForSide,
        scaledImageWidth: sw,
        originalImageWidth: ow,
      });
      if (r) return { mmPerPx: r, mockupLeft, mockupTop };
    }
    // @ts-expect-error - Custom property
    const realW = (canvas.realWorldProductWidth as number | undefined) ?? 500;
    if (sw && sw > 0 && realW > 0) {
      return { mmPerPx: realW / sw, mockupLeft, mockupTop };
    }
    return null;
  };

  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    if (anchorPanelOpen && sideAnchors.length > 0) {
      const geo = resolveCanvasGeometry();
      if (geo) {
        // 호버한 앵커가 있으면 그것만(라벨 포함), 아니면 전체를 박스만(라벨 X)으로.
        drawAnchorPreviews(canvas, hoveredAnchor ? [hoveredAnchor] : sideAnchors, {
          canvasMmPerPx: geo.mmPerPx,
          mockupCanvasLeft: geo.mockupLeft,
          mockupCanvasTop: geo.mockupTop,
          showLabels: !!hoveredAnchor,
        });
      }
    } else {
      clearAnchorPreviews(canvas);
    }
    return () => {
      clearAnchorPreviews(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorPanelOpen, hoveredAnchor, sideAnchors, activeSideId, nativeMmPerPxForSide]);

  const handlePickAnchor = (anchor: AnchorPreset) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target) return;
    const geo = resolveCanvasGeometry();
    if (!geo) return;
    const ok = snapArtworkToAnchor({
      obj: target,
      anchor,
      canvasMmPerPx: geo.mmPerPx,
      mockupCanvasLeft: geo.mockupLeft,
      mockupCanvasTop: geo.mockupTop,
    });
    if (ok) {
      canvas.requestRenderAll();
      incrementCanvasVersion();
      setAnchorPanelOpen(false);
    }
  };

  const hasAnchors = sideAnchors.length > 0;
  const hasSelectedArtwork = !!selectedObject;

  const handleObjectSelection = (object : fabric.FabricObject | null) => {
    // console.log('handleObjectSelection called with:', object?.type);

    if (!object) {
      setSelectedObject(null);
      return;
    }

    setSelectedObject(object);

    if (object.type === "i-text" || object.type === "text") {
    }
  }

  // Resetting states
  const clearSettings = () => {
    // No state to clear currently
  }

  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) {
      setSelectedObject(null);
      return;
    }

    // Clear any existing selection when switching canvases
    setSelectedObject(null);

    const handleSelectionCreated = (options: { selected: fabric.FabricObject[] }) => {
      const selected = options.selected?.[0] || canvas.getActiveObject();
      handleObjectSelection(selected || null);
    };

    const handleSelectionUpdated = (options: { selected: fabric.FabricObject[]; deselected: fabric.FabricObject[] }) => {
      const selected = options.selected?.[0] || canvas.getActiveObject();
      handleObjectSelection(selected || null);
    };

    const handleSelectionCleared = () => {
      handleObjectSelection(null);
      clearSettings();
    };

    const handleObjectModified = (options: { target?: fabric.FabricObject }) => {
      const target = options.target || canvas.getActiveObject();
      handleObjectSelection(target || null);
      // Trigger pricing recalculation when object is modified (scaled, rotated, etc.)
      incrementCanvasVersion();
    };

    const handleObjectScaling = (options: { target?: fabric.FabricObject }) => {
      const target = options.target || canvas.getActiveObject();
      handleObjectSelection(target || null);
      // Trigger pricing recalculation when object is scaling
      incrementCanvasVersion();
    };

    canvas.on("selection:created", handleSelectionCreated);
    canvas.on("selection:updated", handleSelectionUpdated);
    canvas.on("selection:cleared", handleSelectionCleared);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("object:scaling", handleObjectScaling);

    return () => {
      console.log('Cleaning up canvas event listeners');
      canvas.off("selection:created", handleSelectionCreated);
      canvas.off("selection:updated", handleSelectionUpdated);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("object:scaling", handleObjectScaling);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSideId, canvasMap]);
  
  


  const addText = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return; // for error handling

    // Generate unique ID for the object
    const objectId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const text = new fabric.IText('modoo', {
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fill: '#333',
      fontSize: 30,
    })

    // Assign objectId to the text object
    // @ts-expect-error - Adding custom data property
    text.data = {
      // @ts-expect-error - Reading data property
      ...(text.data || {}),
      objectId: objectId,
      printMethod: 'dtf',
    };

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    text.enterEditing();

    // Manually trigger selection handler for newly created text
    handleObjectSelection(text);

    // Trigger pricing recalculation
    incrementCanvasVersion();
    trackDesignAction({ action_type: 'text_add', product_id: productId, side_id: activeSideId });
  };

  const handleAddImageClick = () => {
    setImageUploadAgreed(false);
    setIsImageModalOpen(true);
  };

  const handleImageModalConfirm = () => {
    if (!imageUploadAgreed) return;
    setIsImageModalOpen(false);
    pickFileForBgRemoval();
  };

  const SIZE_OVERFLOW_MSG = (mb: string) =>
    `파일이 너무 큽니다 (현재 ${mb}MB / 최대 50MB)\n\n` +
    `아래 방법 중 하나로 진행해주세요:\n` +
    `1) 더 작은 파일(최대 50MB)로 다시 업로드\n` +
    `2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n` +
    `3) modoo.contact@gmail.com 으로 원본 파일 전달`;

  // Phase 1: file picker → (AI/PSD conversion + original upload in parallel) →
  // store pending state → open BackgroundRemovalFlow modal.
  const pickFileForBgRemoval = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.ai,.psd';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      if (file.size > MAX_UPLOAD_BYTES) {
        alert(SIZE_OVERFLOW_MSG((file.size / 1024 / 1024).toFixed(1)));
        return;
      }

      try {
        const supabase = createClient();

        if (isAiOrPsdFile(file)) {
          console.log('AI/PSD file detected, converting to PNG...');
          setLoadingMessage('파일 변환 중...');
          setLoadingSubmessage('AI/PSD 파일을 PNG로 변환하고 있습니다. (최대 수 분 소요)');
          setIsLoadingModalOpen(true);

          const [conversionResult, origUploadResult] = await Promise.all([
            convertToPNG(file, (msg) => setLoadingSubmessage(msg)),
            uploadFileToStorage(
              supabase,
              file,
              STORAGE_BUCKETS.USER_DESIGNS,
              STORAGE_FOLDERS.IMAGES,
            ),
          ]);

          setIsLoadingModalOpen(false);

          if (!conversionResult.success || !conversionResult.pngBlob) {
            console.error('Conversion failed:', conversionResult.error);
            alert(getConversionErrorMessage(conversionResult.error));
            return;
          }
          if (!origUploadResult.success || !origUploadResult.url) {
            const rawErr = origUploadResult.error || '';
            console.error('Failed to upload original file:', rawErr);
            const friendly = rawErr.includes('exceeded the maximum')
              ? SIZE_OVERFLOW_MSG((file.size / 1024 / 1024).toFixed(1))
              : `원본 파일 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
            alert(friendly);
            return;
          }

          const pngFile = new File(
            [conversionResult.pngBlob],
            `${file.name.split('.')[0]}.png`,
            { type: 'image/png' },
          );

          setBgPending({
            pngFile,
            sourceFile: file,
            sourceUrl: origUploadResult.url,
            sourcePath: origUploadResult.path ?? null,
          });
          // Show crop step before bg-removal.
          setCropFile(pngFile);
          setCropOpen(true);
        } else {
          // Regular image — show crop step before bg-removal modal.
          setBgPending({
            pngFile: file,
            sourceFile: file,
            sourceUrl: null,
            sourcePath: null,
          });
          setCropFile(file);
          setCropOpen(true);
        }
      } catch (error) {
        setIsLoadingModalOpen(false);
        console.error('Error preparing image for bg-removal:', error);
        alert('이미지 추가 중 오류가 발생했습니다.');
      }
    };

    input.click();
  };

  const handleBgCancel = () => {
    setBgModalOpen(false);
    setBgPending(null);
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropFile(null);
    setBgPending(null);
  };

  const proceedToBgRemoval = (pngFile: File) => {
    setBgPending((prev) => (prev ? { ...prev, pngFile } : prev));
    setCropOpen(false);
    setCropFile(null);
    setBgModalOpen(true);
  };

  const handleCropConfirm = (cropped: File) => {
    proceedToBgRemoval(cropped);
  };

  const handleCropSkip = () => {
    if (bgPending) proceedToBgRemoval(bgPending.pngFile);
  };

  // Phase 2: BackgroundRemovalFlow finished → upload result → place on canvas.
  // designerPending=true 시 designer_requests row insert + amber "!" 뱃지 추가.
  const handleBgComplete = async (result: FlowResult) => {
    if (!bgPending) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const pending = bgPending;
    setBgModalOpen(false);

    setLoadingMessage('이미지 업로드 중...');
    setLoadingSubmessage('이미지를 저장하고 있습니다. 잠시만 기다려주세요.');
    setIsLoadingModalOpen(true);

    try {
      const supabase = createClient();

      // The bg-removal output (or original kept by user) becomes the display
      // image. Alpha-trim AFTER bg-removal so transparent margins introduced
      // by removal get cropped out.
      const finalFile = new File(
        [result.blob],
        `image-${Date.now()}.png`,
        { type: result.blob.type || 'image/png' },
      );
      const trimResult = await trimFileToAlphaBounds(finalFile);
      if (trimResult.trimmed) {
        console.log(
          `[ALPHA-TRIM] post-bg-removal ${trimResult.originalWidth}x${trimResult.originalHeight} -> ${trimResult.width}x${trimResult.height}`,
        );
      }

      // Preserve the customer's TRUE original upload as a downloadable
      // attachment. AI/PSD files already uploaded their original during phase 1
      // (pending.sourceUrl); regular images have not, so upload the source file
      // now — in parallel with the processed/display image to avoid extra latency.
      const needsOriginalUpload = !pending.sourceUrl;
      const [displayUploadResult, originalUploadResult] = await Promise.all([
        uploadFileToStorage(
          supabase,
          trimResult.file,
          STORAGE_BUCKETS.USER_DESIGNS,
          STORAGE_FOLDERS.IMAGES,
        ),
        needsOriginalUpload
          ? uploadFileToStorage(
              supabase,
              pending.sourceFile,
              STORAGE_BUCKETS.USER_DESIGNS,
              STORAGE_FOLDERS.IMAGES,
            )
          : Promise.resolve(null),
      ]);

      if (!displayUploadResult.success || !displayUploadResult.url) {
        setIsLoadingModalOpen(false);
        const rawErr = displayUploadResult.error || '';
        console.error('Failed to upload image:', rawErr);
        const friendly = rawErr.includes('exceeded the maximum')
          ? SIZE_OVERFLOW_MSG((trimResult.file.size / 1024 / 1024).toFixed(1))
          : `이미지 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
        alert(friendly);
        setBgPending(null);
        return;
      }

      // Resolve the customer's original-file reference. Falls back to the
      // processed/display image only if there was no original to upload or the
      // upload failed — so the order always carries at least one attachment.
      const originalUrl =
        pending.sourceUrl ??
        (originalUploadResult?.success ? originalUploadResult.url ?? null : null);
      const originalPath =
        pending.sourcePath ??
        (originalUploadResult?.success ? originalUploadResult.path ?? null : null);
      if (needsOriginalUpload && !originalUrl) {
        console.warn(
          '[bg-removal] original image upload failed; only the processed image will be attached.',
        );
      }

      // Designer delegation: tag the canvas object with a pending jobId. The
      // actual designer_requests row is inserted at order placement time using
      // the customer info collected at checkout — avoids duplicate data entry
      // and prevents orphan rows from abandoned designs.
      let designerJobId: string | null = null;
      if (result.designerPending) {
        designerJobId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      const displayUrl = displayUploadResult.url;
      setLoadingMessage('이미지 불러오는 중...');
      setLoadingSubmessage('캔버스에 이미지를 추가하고 있습니다.');

      const img = await fabric.FabricImage.fromURL(displayUrl, {
        crossOrigin: 'anonymous',
      });

      const maxWidth = canvas.width * 0.5;
      const maxHeight = canvas.height * 0.5;
      if (img.width > maxWidth || img.height > maxHeight) {
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        img.scale(scale);
      }
      img.set({
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
      });

      const objectId = `image-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // @ts-expect-error - Adding custom data property to FabricImage
      img.data = {
        // @ts-expect-error - Reading data property
        ...(img.data || {}),
        objectId,
        supabaseUrl: displayUrl,
        supabasePath: displayUploadResult.path,
        originalFileUrl: originalUrl ?? displayUrl,
        originalFilePath: originalPath ?? null,
        originalFileName: pending.sourceFile.name,
        fileType: pending.sourceFile.type || 'unknown',
        isConverted: isAiOrPsdFile(pending.sourceFile),
        uploadedAt: new Date().toISOString(),
        printMethod: 'dtf',
        ...(designerJobId
          ? {
              designerJobId,
              designerPending: true,
              designerSourceUrl: originalUrl ?? displayUrl,
              designerSourcePath: originalPath ?? null,
              designerSourceFileName: pending.sourceFile.name,
            }
          : { bgRemoved: result.usedRemoval }),
      };

      canvas.add(img);
      canvas.setActiveObject(img);

      if (designerJobId) {
        addDesignerPendingBadge(canvas, img);
      }

      canvas.renderAll();

      incrementCanvasVersion();
      trackDesignAction({
        action_type: 'image_upload',
        product_id: productId,
        side_id: activeSideId,
      });

      setIsLoadingModalOpen(false);

      if (isAiOrPsdFile(pending.sourceFile)) {
        setLoadingMessage('완료!');
        setLoadingSubmessage('파일이 성공적으로 추가되었습니다.');
        setIsLoadingModalOpen(true);
        setTimeout(() => setIsLoadingModalOpen(false), 1500);
      }
    } catch (error) {
      setIsLoadingModalOpen(false);
      console.error('Error placing image on canvas:', error);
      alert('이미지를 캔버스에 추가하는 데 실패했습니다.');
    } finally {
      setBgPending(null);
    }
  };

  const handleSideSelect = (sideId: string) => {
    setActiveSide(sideId);
    setIsModalOpen(false);
    trackDesignAction({ action_type: 'face_change', product_id: productId, side_id: sideId });
  };

  const handleDeleteObject = () => {
    const canvas = getActiveCanvas();
    const selectedObject = canvas?.getActiveObject();
    const selectedObjects = canvas?.getActiveObjects();

    if (selectedObjects && selectedObjects.length > 0) {
    // Remove all selected objects
    selectedObjects.forEach(obj => canvas?.remove(obj));
    // Discard the selection after removal
    canvas?.discardActiveObject()
    canvas?.renderAll();
    // Trigger pricing recalculation
    incrementCanvasVersion();
    trackDesignAction({ action_type: 'object_delete', product_id: productId, side_id: activeSideId });
  } else if (selectedObject) {
    // Remove a single selected object
    canvas?.remove(selectedObject);
    canvas?.renderAll();
    // Trigger pricing recalculation
    incrementCanvasVersion();
    trackDesignAction({ action_type: 'object_delete', product_id: productId, side_id: activeSideId });
    }
  }

  const handleResetCanvas = () => {
    const canvas = getActiveCanvas();

    if (!canvas) return;

    canvas.getObjects().forEach((obj) => {
      const objData = obj.get('data') as { id?: string } | undefined;
      // remove all objects except for background image, center guide line, visual guide box
      if (objData?.id !== 'background-product-image' && objData?.id !== 'center-line') {
        canvas.remove(obj)
      }
    })

    canvas.renderAll();

    // Trigger pricing recalculation
    incrementCanvasVersion();
    trackDesignAction({ action_type: 'reset', product_id: productId, side_id: activeSideId });
  }

  // Layer manipulation functions
  const bringToFront = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.renderAll();
      trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
    }
  };

  const sendToBack = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      // Find all system objects (background, guides, etc.) that should stay below user objects
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });

      // Find the highest index among system objects
      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);

      // Move the object to just above the highest system object
      const currentIndex = objects.indexOf(activeObject);
      const targetIndex = maxSystemIndex + 1;

      if (currentIndex > targetIndex) {
        // Remove and re-insert at the correct position
        canvas.remove(activeObject);
        canvas.insertAt(targetIndex, activeObject);
        canvas.setActiveObject(activeObject);
        canvas.renderAll();
        trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
      }
    }
  };

  const bringForward = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.renderAll();
      trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
    }
  };

  const sendBackward = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      // Find all system objects (background, guides, etc.) that should stay below user objects
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });

      // Find the highest index among system objects
      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);

      // Only send backward if it won't go below system objects
      const currentIndex = objects.indexOf(activeObject);
      if (currentIndex > maxSystemIndex + 1) {
        canvas.sendObjectBackwards(activeObject);
        canvas.renderAll();
        trackDesignAction({ action_type: 'layer_move', product_id: productId, side_id: activeSideId });
      }
    }
  };

  // Generate canvas previews when modal is open
  const canvasPreviews = useMemo(() => {
    if (!isModalOpen) return {};

    const previews: Record<string, string> = {};
    sides.forEach((side) => {
      const canvas = canvasMap[side.id];
      if (canvas) {
        // Generate a data URL from the canvas
        previews[side.id] = canvas.toDataURL({
          format: 'png',
          quality: 0.8,
          multiplier: 0.3, // Scale down for thumbnail
        });
      }
    });
    return previews;
  }, [isModalOpen, sides, canvasMap]);

  // Only show toolbar in edit mode
  if (!isEditMode) return null;

  const currentSide = sides.find(side => side.id === activeSideId);

  // Shared modal element rendered once at the end of either variant return.
  const bgRemovalModal =
    bgModalOpen && bgPending ? (
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleBgCancel();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="이미지 추가하기"
      >
        <div
          className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleBgCancel}
            aria-label="닫기"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <h2 className="text-lg font-bold mb-4 pr-8">이미지 추가하기</h2>
          <BackgroundRemovalFlow
            initialFile={bgPending.pngFile}
            onComplete={handleBgComplete}
            onCancel={handleBgCancel}
          />
        </div>
      </div>
    ) : null;

  const cropModal = cropOpen && cropFile ? (
    <FreeFormCropper
      file={cropFile}
      isOpen={cropOpen}
      title="영역 선택"
      onConfirm={handleCropConfirm}
      onSkip={handleCropSkip}
      onCancel={handleCropCancel}
    />
  ) : null;

  if (isDesktop) {
    return (
      <>
        <div className="flex flex-col items-center gap-3">
          {/* Toolbar Items */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleResetCanvas}
              className="flex flex-col items-center gap-1.5 group"
              title="초기화"
            >
              <div className="w-12 h-12 rounded-full border border-gray-200 bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition shadow-sm">
                <RefreshCcw className="size-5 text-white" />
              </div>
              <span className="text-xs text-gray-600 font-medium">초기화</span>
            </button>
            <button
              onClick={addText}
              className="flex flex-col items-center gap-1.5 group"
              title="텍스트 추가"
            >
              <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm">
                <TextCursor className="size-5 text-gray-700" />
              </div>
              <span className="text-xs text-gray-600 font-medium">텍스트</span>
            </button>
            <button
              onClick={handleAddImageClick}
              className="flex flex-col items-center gap-1.5 group"
              title="이미지 추가"
            >
              <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm">
                <FileImage className="size-5 text-gray-700" />
              </div>
              <span className="text-xs text-gray-600 font-medium">이미지</span>
            </button>
            {productId && (
              <button
                onClick={() => setIsTemplatePickerOpen(true)}
                className="flex flex-col items-center gap-1.5 group"
                title="템플릿"
              >
                <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm">
                  <LayoutTemplate className="size-5 text-gray-700" />
                </div>
                <span className="text-xs text-gray-600 font-medium">템플릿</span>
              </button>
            )}
            {hasAnchors && (
              <button
                onClick={() => setAnchorPanelOpen(true)}
                className="flex flex-col items-center gap-1.5 group"
                title="자주 쓰는 위치"
              >
                <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm">
                  <MapPin className="size-5 text-gray-700" />
                </div>
                <span className="text-xs text-gray-600 font-medium">자주쓰는위치</span>
              </button>
            )}
          </div>
        </div>

        {/* 데스크톱 자주쓰는위치 패널은 우측 aside(ProductEditorUnified)에 도킹됨. */}

        {/* Loading Modal for file conversion */}
        <LoadingModal
          isOpen={isLoadingModalOpen}
          message={loadingMessage}
          submessage={loadingSubmessage}
        />

        {/* Image Upload Modal */}
        {isImageModalOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.
                </p>
                <p>
                  다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.
                </p>
              </div>
              <label className="flex items-start gap-3 mt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imageUploadAgreed}
                  onChange={(e) => setImageUploadAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm text-gray-700">
                  위 내용을 확인했습니다.
                </span>
              </label>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsImageModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  onClick={handleImageModalConfirm}
                  disabled={!imageUploadAgreed}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Picker */}
        {productId && (
          <TemplatePicker
            productId={productId}
            isOpen={isTemplatePickerOpen}
            onClose={() => setIsTemplatePickerOpen(false)}
          />
        )}

        {cropModal}
        {bgRemovalModal}
      </>
    );
  }

  return (
    <>

      {/* Exit Edit Mode Button */}
        {isEditMode && (
          <div className="w-full bg-white shadow-md z-100 fixed top-0 left-0 flex items-center justify-between px-4">
            <button
              onClick={handleExitEditMode}
              className="py-3 bg-white hover:bg-gray-100 text-gray-900 transition flex items-center"
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className='flex items-center gap-3'>
              {selectedObject ? (
                <>
                  {/* Layer controls when object is selected */}
                  <button onClick={bringToFront} title="맨 앞으로" className='p-1.5 hover:bg-gray-100 rounded transition'>
                    <ChevronsUp className='text-black/80 size-5' />
                  </button>
                  <button onClick={bringForward} title="앞으로" className='p-1.5 hover:bg-gray-100 rounded transition'>
                    <ArrowUp className='text-black/80 size-5' />
                  </button>
                  <button onClick={sendBackward} title="뒤로" className='p-1.5 hover:bg-gray-100 rounded transition'>
                    <ArrowDown className='text-black/80 size-5' />
                  </button>
                  <button onClick={sendToBack} title="맨 뒤로" className='p-1.5 hover:bg-gray-100 rounded transition'>
                    <ChevronsDown className='text-black/80 size-5' />
                  </button>
                  <div className='h-6 w-px bg-gray-300' />
                  <button onClick={handleDeleteObject} title="삭제" className='p-1.5 hover:bg-gray-100 rounded transition'>
                    <Trash2 className='text-red-400 size-5' />
                  </button>
                </>
              ) : (
                <>
                  {/* Zoom controls when no object is selected */}
                  <div className='flex items-center gap-1 border-r border-gray-300 pr-3'>
                    <button
                      onClick={() => zoomOut()}
                      className='p-1.5 hover:bg-gray-100 rounded transition'
                      title="축소"
                    >
                      <ZoomOut className='text-black/80 size-5' />
                    </button>
                    <span className='text-xs text-gray-600 min-w-12 text-center'>
                      {Math.round(currentZoom * 100)}%
                    </span>
                    <button
                      onClick={() => zoomIn()}
                      className='p-1.5 hover:bg-gray-100 rounded transition'
                      title="확대"
                    >
                      <ZoomIn className='text-black/80 size-5' />
                    </button>
                  </div>
                  <button onClick={handleResetCanvas} title="초기화" className='p-1.5 hover:bg-gray-100 rounded transition'>
                    <RefreshCcw className='text-black/80' />
                  </button>
                </>
              )}
            </div>
          </div>
        )}


      {/* Modal for side selection */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-white/20 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 shadow-lg shadow-black"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">편집할 면 선택</h2>
            <div className="space-y-3">
              {sides.map((side) => (
                <button
                  key={side.id}
                  onClick={() => handleSideSelect(side.id)}
                  className={`w-full p-2 rounded-lg border-2 transition-all text-left flex items-center gap-4 ${
                    side.id === activeSideId
                      ? 'border-blue-600 bg-gray-100'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {/* Canvas Preview */}
                  <div className="flex-shrink-0 w-20 h-24 bg-gray-100 rounded border border-gray-200 overflow-hidden">
                    {canvasPreviews[side.id] ? (
                      <img
                        src={canvasPreviews[side.id]}
                        alt={`${side.name} preview`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        미리보기
                      </div>
                    )}
                  </div>

                  {/* Side Info */}
                  <div className="flex-1">
                    <div className="font-semibold">{side.name}</div>
                    {side.id === activeSideId && (
                      <div className="text-sm text-gray-600 mt-1">현재 편집 중</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* Default Toolbar render only when no object is selected */}
      {/* Center button for side selection */}
      {sides.length > 0 && !selectedObject && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white shadow-xl rounded-full px-6 py-3 flex items-center gap-2 hover:bg-gray-50 transition border border-gray-200"
          >
            <Layers className="size-5" />
            <span className="font-medium">{currentSide?.name || '면 선택'}</span>
          </button>
        </div>
      )}
      {/* Mobile bottom tool dock — 흩어진 플로팅 버튼을 한 줄로 통합.
          텍스트 편집 중(텍스트 선택)일 땐 TextStylePanel이 떠서 dock은 숨김. */}
      {!(selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text" || isCurvedText(selectedObject))) && (
        <div className="fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t border-gray-200">
          <div className="h-full flex items-stretch justify-around gap-0.5 px-1 overflow-x-auto">
            <button onClick={() => addText()} className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition min-w-[52px]">
              <TextCursor className="size-5 text-gray-700" />
              <span className="text-[10px] font-medium text-gray-600">텍스트</span>
            </button>
            <button onClick={() => handleAddImageClick()} className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition min-w-[52px]">
              <FileImage className="size-5 text-gray-700" />
              <span className="text-[10px] font-medium text-gray-600">이미지</span>
            </button>
            {productId && (
              <button onClick={() => setIsTemplatePickerOpen(true)} className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition min-w-[52px]">
                <LayoutTemplate className="size-5 text-gray-700" />
                <span className="text-[10px] font-medium text-gray-600">템플릿</span>
              </button>
            )}
            {hasColorOptions && onColorPress && (
              <button onClick={onColorPress} className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition min-w-[52px]">
                <span className="size-5 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: displayColor || '#FFFFFF' }} />
                <span className="text-[10px] font-medium text-gray-600">색상</span>
              </button>
            )}
            {hasAnchors && (
              <button
                onClick={() => setAnchorPanelOpen(true)}
                disabled={!selectedObject}
                title={!selectedObject ? '이미지를 먼저 선택하세요' : '자주 쓰는 위치'}
                className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition min-w-[52px] disabled:opacity-40"
              >
                <MapPin className="size-5 text-gray-700" />
                <span className="text-[10px] font-medium text-gray-600">위치</span>
              </button>
            )}
            {layersLabEnabled && (
              <button onClick={() => setLayersPanelOpen(true)} className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition min-w-[52px]">
                <Layers className="size-5 text-blue-600" />
                <span className="text-[10px] font-medium text-blue-600">레이어</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Render if selected item is text */}
      {selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text" || isCurvedText(selectedObject)) && (
        <TextStylePanel
          selectedObject={selectedObject as fabric.IText}
          onClose={() => setSelectedObject(null)}
        />
      )}

      {/* Anchor preset panel (mobile bottom sheet) */}
      {!isDesktop && (
        <AnchorPresetPanel
          open={anchorPanelOpen}
          onClose={() => setAnchorPanelOpen(false)}
          anchors={sideAnchors}
          hasSelectedArtwork={hasSelectedArtwork}
          onPick={handlePickAnchor}
          onHoverAnchor={(a) => setHoveredAnchorId(a?.id ?? null)}
          variant="mobile"
        />
      )}

      {/* Loading Modal for file conversion */}
      <LoadingModal
        isOpen={isLoadingModalOpen}
        message={loadingMessage}
        submessage={loadingSubmessage}
      />

      {/* Image Upload Modal */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.
              </p>
              <p>
                다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.
              </p>
            </div>
            <label className="flex items-start gap-3 mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={imageUploadAgreed}
                onChange={(e) => setImageUploadAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <span className="text-sm text-gray-700">
                위 내용을 확인했습니다.
              </span>
            </label>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleImageModalConfirm}
                disabled={!imageUploadAgreed}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Picker */}
      {productId && (
        <TemplatePicker
          productId={productId}
          isOpen={isTemplatePickerOpen}
          onClose={() => setIsTemplatePickerOpen(false)}
        />
      )}

      {cropModal}
      {bgRemovalModal}
    </>
  );
}

export default Toolbar;
