import React, { useState, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Plus, TextCursor, Layers, FileImage, Trash2, RefreshCcw, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, LayoutTemplate, ChevronLeft } from 'lucide-react';
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
  const { getActiveCanvas, activeSideId, setActiveSide, isEditMode, canvasMap, incrementCanvasVersion, zoomIn, zoomOut, getZoomLevel } = useCanvasStore();
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
  // const canvas = getActiveCanvas();

  // Anchor preset panel state.
  const [isAnchorPanelOpen, setIsAnchorPanelOpen] = useState(false);
  const [sideAnchors, setSideAnchors] = useState<AnchorPreset[]>([]);

  // Fetch registered anchors for the active side whenever product/side changes.
  useEffect(() => {
    let cancelled = false;
    if (!productId || !activeSideId) {
      setSideAnchors([]);
      return;
    }
    fetchProductCalibrations(productId).then((map) => {
      if (cancelled) return;
      const cal = map.get(activeSideId);
      setSideAnchors(cal?.anchors ?? []);
    }).catch(() => {
      if (!cancelled) setSideAnchors([]);
    });
    return () => { cancelled = true; };
  }, [productId, activeSideId]);

  // Resolve canvas-pixel mmPerPx using the same priority as canvasUtils
  // (calibration > legacy productWidthMm). Returns null when no usable input.
  const resolveCanvasMmPerPx = (): number | null => {
    const canvas = getActiveCanvas();
    if (!canvas) return null;
    // @ts-expect-error - Custom property
    const native = canvas.calibrationNativeMmPerPx as number | undefined;
    // @ts-expect-error - Custom property
    const sw = canvas.scaledImageWidth as number | undefined;
    // @ts-expect-error - Custom property
    const ow = canvas.originalImageWidth as number | undefined;
    if (native && native > 0 && sw && ow) {
      return calibrationToCanvasMmPerPx({ nativeMmPerPx: native, scaledImageWidth: sw, originalImageWidth: ow });
    }
    // Legacy fallback: derive from realWorldProductWidth.
    // @ts-expect-error - Custom property
    const realW = (canvas.realWorldProductWidth as number | undefined) ?? 500;
    if (sw && sw > 0 && realW > 0) return realW / sw;
    return null;
  };

  // Show / hide ghost preview rectangles when the panel toggles.
  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    if (isAnchorPanelOpen && sideAnchors.length > 0) {
      const ratio = resolveCanvasMmPerPx();
      if (ratio) drawAnchorPreviews(canvas, sideAnchors, { canvasMmPerPx: ratio });
    } else {
      clearAnchorPreviews(canvas);
    }
    return () => {
      clearAnchorPreviews(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnchorPanelOpen, sideAnchors, activeSideId]);

  const handlePickAnchor = (anchor: AnchorPreset) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target) return;
    const ratio = resolveCanvasMmPerPx();
    if (!ratio) return;
    const ok = snapArtworkToAnchor({ obj: target, anchor, canvasMmPerPx: ratio });
    if (ok) {
      canvas.requestRenderAll();
      incrementCanvasVersion();
      setIsAnchorPanelOpen(false);
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
    addImage();
  };

  const addImage = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return; // for error handling

    // Create a hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.ai,.psd'; // Accept images, AI, and PSD files

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      // Pre-flight size guard (matches Supabase Storage limit and CloudConvert practical limit)
      if (file.size > MAX_UPLOAD_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        alert(
          `파일이 너무 큽니다 (현재 ${mb}MB / 최대 50MB)\n\n` +
          `아래 방법 중 하나로 진행해주세요:\n` +
          `1) 더 작은 파일(최대 50MB)로 다시 업로드\n` +
          `2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n` +
          `3) modoo.contact@gmail.com 으로 원본 파일 전달`
        );
        return;
      }

      try {
        // Create Supabase client for browser
        const supabase = createClient();

        let displayUrl: string;
        let originalFileUploadResult;

        // Check if file is AI or PSD and needs conversion
        if (isAiOrPsdFile(file)) {
          console.log('AI/PSD file detected, converting to PNG...');

          // Show loading modal for conversion
          setLoadingMessage('파일 변환 중...');
          setLoadingSubmessage('AI/PSD 파일을 PNG로 변환하고 있습니다. (최대 수 분 소요)');
          setIsLoadingModalOpen(true);

          // Run conversion and original-file upload IN PARALLEL to save time.
          // CloudConvert typically dominates wall time; uploading the original
          // PSD/AI to Supabase concurrently piggybacks onto that wait.
          const [conversionResult, origUploadResult] = await Promise.all([
            convertToPNG(file, (msg) => setLoadingSubmessage(msg)),
            uploadFileToStorage(
              supabase,
              file,
              STORAGE_BUCKETS.USER_DESIGNS,
              STORAGE_FOLDERS.IMAGES
            ),
          ]);

          if (!conversionResult.success || !conversionResult.pngBlob) {
            setIsLoadingModalOpen(false);
            const errorMessage = getConversionErrorMessage(conversionResult.error);
            console.error('Conversion failed:', conversionResult.error);
            alert(errorMessage);
            return;
          }

          if (!origUploadResult.success || !origUploadResult.url) {
            setIsLoadingModalOpen(false);
            const rawErr = origUploadResult.error || '';
            console.error('Failed to upload original file:', rawErr);
            const friendly = rawErr.includes('exceeded the maximum')
              ? '파일 용량이 서버 한도를 초과했습니다 (최대 50MB).\n\n' +
                '아래 방법 중 하나로 진행해주세요:\n' +
                '1) 더 작은 파일(최대 50MB)로 다시 업로드\n' +
                '2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n' +
                '3) modoo.contact@gmail.com 으로 원본 파일 전달'
              : `원본 파일 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
            alert(friendly);
            return;
          }

          originalFileUploadResult = origUploadResult;
          console.log('Conversion + original upload complete:', originalFileUploadResult.url);

          // Update loading message for PNG upload phase
          setLoadingMessage('파일 업로드 중...');
          setLoadingSubmessage('변환된 PNG를 저장하고 있습니다.');

          // Create a PNG file from the blob for canvas display
          const pngFile = new File([conversionResult.pngBlob], `${file.name.split('.')[0]}.png`, {
            type: 'image/png',
          });

          // Alpha-trim the converted PNG before uploading the display copy.
          // The original AI/PSD file was already uploaded in parallel above,
          // so this only affects the display/measurement asset.
          const pngTrimResult = await trimFileToAlphaBounds(pngFile);
          if (pngTrimResult.trimmed) {
            console.log(
              `[ALPHA-TRIM] AI/PSD PNG ${pngTrimResult.originalWidth}x${pngTrimResult.originalHeight} -> ${pngTrimResult.width}x${pngTrimResult.height}`
            );
          }

          // Upload the converted PNG for display
          const pngUploadResult = await uploadFileToStorage(
            supabase,
            pngTrimResult.file,
            STORAGE_BUCKETS.USER_DESIGNS,
            STORAGE_FOLDERS.IMAGES
          );

          if (!pngUploadResult.success || !pngUploadResult.url) {
            setIsLoadingModalOpen(false);
            const rawErr = pngUploadResult.error || '';
            console.error('Failed to upload PNG:', rawErr);
            const friendly = rawErr.includes('exceeded the maximum')
              ? '변환된 PNG가 서버 한도를 초과했습니다 (최대 50MB).\n\n' +
                '아래 방법 중 하나로 진행해주세요:\n' +
                '1) 더 작은 파일(최대 50MB)로 다시 업로드\n' +
                '2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n' +
                '3) modoo.contact@gmail.com 으로 원본 파일 전달'
              : `변환된 이미지 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
            alert(friendly);
            return;
          }

          // Use the PNG URL for display
          displayUrl = pngUploadResult.url;
          console.log('PNG uploaded for display:', displayUrl);
        } else {
          // Regular image file - upload as usual
          console.log('Uploading image to Supabase...');

          // Show loading modal for upload
          setLoadingMessage('이미지 업로드 중...');
          setLoadingSubmessage('이미지를 저장하고 있습니다. 잠시만 기다려주세요.');
          setIsLoadingModalOpen(true);

          // Alpha-trim transparent margins before upload so the stored asset's
          // raster bounds equal the visible artwork. Downstream Fabric size
          // measurements (px → mm conversion, A3 cap, pricing) automatically
          // reflect the actual print area. JPEG passes through untouched.
          const trimResult = await trimFileToAlphaBounds(file);
          if (trimResult.trimmed) {
            console.log(
              `[ALPHA-TRIM] ${trimResult.originalWidth}x${trimResult.originalHeight} -> ${trimResult.width}x${trimResult.height}`
            );
          }
          const fileToUpload = trimResult.file;

          originalFileUploadResult = await uploadFileToStorage(
            supabase,
            fileToUpload,
            STORAGE_BUCKETS.USER_DESIGNS,
            STORAGE_FOLDERS.IMAGES
          );

          if (!originalFileUploadResult.success || !originalFileUploadResult.url) {
            setIsLoadingModalOpen(false);
            const rawErr = originalFileUploadResult.error || '';
            console.error('Failed to upload image:', rawErr);
            const friendly = rawErr.includes('exceeded the maximum')
              ? '파일 용량이 서버 한도를 초과했습니다 (최대 50MB).\n\n' +
                '아래 방법 중 하나로 진행해주세요:\n' +
                '1) 더 작은 파일(최대 50MB)로 다시 업로드\n' +
                '2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n' +
                '3) modoo.contact@gmail.com 으로 원본 파일 전달'
              : `이미지 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
            alert(friendly);
            return;
          }

          // Use the original image URL for display
          displayUrl = originalFileUploadResult.url;
          console.log('Image uploaded successfully:', displayUrl);

          // Update loading message for image loading phase
          setLoadingMessage('이미지 불러오는 중...');
          setLoadingSubmessage('캔버스에 이미지를 추가하고 있습니다.');
        }

        // Load image from display URL
        fabric.FabricImage.fromURL(displayUrl, {
          crossOrigin: 'anonymous',
        }).then((img) => {
          // Scale image to fit canvas if it's too large
          const maxWidth = canvas.width * 0.5;
          const maxHeight = canvas.height * 0.5;

          if (img.width > maxWidth || img.height > maxHeight) {
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            img.scale(scale);
          }

          // Center the image on canvas
          img.set({
            left: canvas.width / 2,
            top: canvas.height / 2,
            originX: 'center',
            originY: 'center',
          });

          // Generate unique ID for the object
          const objectId = `image-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

          // Store Supabase metadata in the image object
          // @ts-expect-error - Adding custom data property to FabricImage
          img.data = {
            // @ts-expect-error - Reading data property
            ...(img.data || {}),
            objectId: objectId, // Unique object ID for tracking
            supabaseUrl: displayUrl, // URL of the display image (PNG for AI/PSD)
            supabasePath: originalFileUploadResult.path, // Path to original file
            originalFileUrl: originalFileUploadResult.url, // URL of original file (AI/PSD or image)
            originalFileName: file.name,
            fileType: file.type || 'unknown',
            isConverted: isAiOrPsdFile(file), // Flag to indicate if file was converted
            uploadedAt: new Date().toISOString(),
            printMethod: 'dtf',
          };

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();

          // Trigger pricing recalculation
          incrementCanvasVersion();
          trackDesignAction({ action_type: 'image_upload', product_id: productId, side_id: activeSideId });

          // Hide loading modal
          setIsLoadingModalOpen(false);

          // Show success message for converted files
          if (isAiOrPsdFile(file)) {
            // Show brief success message
            setLoadingMessage('완료!');
            setLoadingSubmessage('파일이 성공적으로 추가되었습니다.');
            setIsLoadingModalOpen(true);

            // Auto-hide after 1.5 seconds
            setTimeout(() => {
              setIsLoadingModalOpen(false);
            }, 1500);
          }
        }).catch((error) => {
          setIsLoadingModalOpen(false);
          console.error('Failed to load image:', error);
          alert('이미지를 불러오는데 실패했습니다.');
        });
      } catch (error) {
        setIsLoadingModalOpen(false);
        console.error('Error adding image:', error);
        alert('이미지 추가 중 오류가 발생했습니다.');
      }
    };

    // Trigger file input click
    input.click();
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
                onClick={() => setIsAnchorPanelOpen(true)}
                className="flex flex-col items-center gap-1.5 group"
                title="자주 쓰는 위치"
              >
                <div className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition shadow-sm text-lg">
                  📍
                </div>
                <span className="text-xs text-gray-600 font-medium">자주쓰는위치</span>
              </button>
            )}
          </div>
        </div>

        <AnchorPresetPanel
          open={isAnchorPanelOpen}
          onClose={() => setIsAnchorPanelOpen(false)}
          anchors={sideAnchors}
          hasSelectedArtwork={hasSelectedArtwork}
          onPick={handlePickAnchor}
          variant="desktop"
        />

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
      {!selectedObject &&
        <>
        {isExpanded && (
          <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
        )}
        <div className="fixed bottom-36 right-6 flex flex-col items-end gap-3 z-50">
          {/* Inner buttons - expand upwards */}
          <div className={`flex flex-col gap-2 transition-all duration-700 overflow-hidden ${
            isExpanded ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'
          }`}>
            <button
              onClick={() => { addText(); setIsExpanded(false); }}
            >
              <div className='bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap'>
                <TextCursor />
              </div>
              <p className='text-xs'>텍스트</p>
            </button>
            <button
              onClick={() => { handleAddImageClick(); setIsExpanded(false); }}
            >
              <div className='bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap'>
                <FileImage />
              </div>
              <p className='text-xs'>이미지</p>
            </button>
            {productId && (
              <button
                onClick={() => {
                  setIsTemplatePickerOpen(true);
                  setIsExpanded(false);
                }}
              >
                <div className='bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap'>
                  <LayoutTemplate />
                </div>
                <p className='text-xs'>템플릿</p>
              </button>
            )}
          </div>

          {/* Color button */}
          {hasColorOptions && onColorPress && (
            <button
              onClick={onColorPress}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="size-12 rounded-full border-2 border-gray-300 shadow-xl transition hover:border-gray-500"
                style={{ backgroundColor: displayColor || '#FFFFFF' }}
              />
              <p className="text-[10px] font-medium">색상 선택</p>
            </button>
          )}

          {/* Plus button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-col items-center gap-1"
          >
            <div className={`size-12 ${isExpanded ? "bg-black text-white" : "bg-white text-black"} shadow-xl rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-300`}>
              <Plus className={`${isExpanded ? 'rotate-45' : ''} size-8 transition-all duration-300`}/>
            </div>
            <p className="text-[10px] font-medium">디자인하기</p>
          </button>
        </div>
        </>
      }


      {/* Render if selected item is text */}
      {selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text" || isCurvedText(selectedObject)) && (
        <TextStylePanel
          selectedObject={selectedObject as fabric.IText}
          onClose={() => setSelectedObject(null)}
        />
      )}

      {/* Mobile floating button — Anchor presets (자주 쓰는 위치) */}
      {!isDesktop && hasAnchors && selectedObject && (
        <button
          type="button"
          onClick={() => setIsAnchorPanelOpen(true)}
          className="fixed bottom-36 left-6 z-50 bg-white shadow-xl rounded-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 transition border border-gray-200"
          title="자주 쓰는 위치"
        >
          <span className="text-lg">📍</span>
          <span className="text-xs font-medium text-gray-700 whitespace-nowrap">자주 쓰는 위치</span>
        </button>
      )}

      {/* Anchor preset panel (mobile bottom sheet) */}
      {!isDesktop && (
        <AnchorPresetPanel
          open={isAnchorPanelOpen}
          onClose={() => setIsAnchorPanelOpen(false)}
          anchors={sideAnchors}
          hasSelectedArtwork={hasSelectedArtwork}
          onPick={handlePickAnchor}
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

    </>
  );
}

export default Toolbar;
