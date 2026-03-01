'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import dynamic from 'next/dynamic';
import {
  X, ArrowLeft, ArrowRight, CheckCircle2, Share2,
  Search, Calendar, Tag,
  Sparkles, ChevronRight, Check, Copy, ShoppingBag,
  TextCursor, ImagePlus, Trash2, Palette, UserCircle, Mail, Phone, Pencil,
  Undo2, Redo2, Replace, Eye,
} from 'lucide-react';
import {
  Product, ProductSide, CoBuyCustomField, CoBuyDeliverySettings, CoBuyAddressInfo,
  CoBuyRequestSchedulePreferences, CoBuyRequestQuantityExpectations,
} from '@/types/types';
import { createCoBuyRequest, createDraftCoBuyRequest, updateCoBuyRequest } from '@/lib/cobuyRequestService';
import { getCobuyPreset } from '@/lib/templateService';
import LayerColorSelector from '@/app/components/canvas/LayerColorSelector';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { isCurvedText } from '@/lib/curvedText';

const SingleSideCanvas = dynamic(() => import('@/app/components/canvas/SingleSideCanvas'), {
  ssr: false,
  loading: () => <div className="w-full aspect-[4/5] bg-[#EBEBEB] animate-pulse rounded-xl" />,
});


type Step =
  | 'basic-info'
  | 'color-select'
  | 'freeform-front'
  | 'freeform-back'
  | 'design-review'
  | 'schedule-address'
  | 'success';

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'basic-info', label: '기본 정보', icon: <UserCircle className="w-4 h-4" /> },
  { id: 'color-select', label: '색상 선택', icon: <Palette className="w-4 h-4" /> },
  { id: 'freeform-front', label: '앞면 디자인', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'freeform-back', label: '뒷면 디자인', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'design-review', label: '디자인 확인', icon: <Eye className="w-4 h-4" /> },
  { id: 'schedule-address', label: '일정 및 배송', icon: <Calendar className="w-4 h-4" /> },
];

export default function CreateCoBuyRequestPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { canvasMap, layerColors, setEditMode, activeSideId, setActiveSide, getActiveCanvas, setProductColor, setLayerColor } = useCanvasStore();

  const [currentStep, setCurrentStep] = useState<Step>('basic-info');

  const [isCreating, setIsCreating] = useState(false);
  const [createdShareToken, setCreatedShareToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Welcome popup
  const [showWelcome, setShowWelcome] = useState(true);

  // Contact info (for all users)
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Product selection (fixed to a single product)
  const FIXED_PRODUCT_ID = '0d8f53fa-bac2-4f0a-8eb4-870a70e072eb';
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Product colors (fetched from product_colors table)
  const [productColors, setProductColors] = useState<{ id: string; hex: string; name: string; colorCode: string }[]>([]);
  const [selectedColorHex, setSelectedColorHex] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate] = useState('');
  const [endDate] = useState('');
  const [receiveByDate, setReceiveByDate] = useState('');
  const [skipDelivery, setSkipDelivery] = useState(false);
  const [expectedQuantity, setExpectedQuantity] = useState<number | ''>('');
  const minQuantity: number | '' = '';
  const maxQuantity: number | '' = '';
  const [uploadedImagePaths, setUploadedImagePaths] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CoBuyCustomField[]>([]);
  const [deliverySettings, setDeliverySettings] = useState<CoBuyDeliverySettings>({
    enabled: false,
    deliveryFee: 4000,
    pickupLocation: '',
    deliveryAddress: undefined,
    pickupAddress: undefined,
  });
  const isPublic = false;
  const [isPostcodeScriptLoaded, setIsPostcodeScriptLoaded] = useState(false);

  // Draft save
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);

  // Saved canvas data (captured when leaving freeform step, since canvases unmount after)
  const [savedCanvasState, setSavedCanvasState] = useState<Record<string, string>>({});
  const [savedPreviewUrl, setSavedPreviewUrl] = useState<string | null>(null);
  const [savedColorSelections, setSavedColorSelections] = useState<Record<string, Record<string, string>>>({});
  const [sidePreviewUrls, setSidePreviewUrls] = useState<Record<string, string>>({});

  // CoBuy preset (auto-loaded onto canvas)
  const [cobuyPreset, setCobuyPreset] = useState<Awaited<ReturnType<typeof getCobuyPreset>>>(null);
  const loadedCanvases = useRef(new WeakSet<any>());


  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasTextSelected, setHasTextSelected] = useState(false);
  const [hasImageSelected, setHasImageSelected] = useState(false);
  const [textColor, setTextColor] = useState('#333333');
  const [textStroke, setTextStroke] = useState('');
  const [textEditModal, setTextEditModal] = useState<{ open: boolean; value: string }>({ open: false, value: '' });
  const textColorInputRef = useRef<HTMLInputElement>(null);
  const strokeColorInputRef = useRef<HTMLInputElement>(null);

  // Undo/redo history
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoing, setIsUndoRedoing] = useState(false);

  // Animation
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const isFreeformStep = currentStep === 'freeform-front' || currentStep === 'freeform-back';

  // Check if selected product has any color options
  const hasLayerColorOptions = useMemo(() => {
    const sides = selectedProduct?.configuration ?? [];
    return sides.some((side: any) =>
      (side.layers && side.layers.some((layer: any) => layer.colorOptions && layer.colorOptions.length > 0)) ||
      (side.colorOptions && side.colorOptions.length > 0)
    );
  }, [selectedProduct]);
  const hasColorOptions = productColors.length > 0 || hasLayerColorOptions;

  const productSides = selectedProduct?.configuration ?? [];
  const hasBackSide = productSides.length > 1;

  const visibleSteps = useMemo(() => {
    let steps = STEPS.filter(s => s.id !== 'color-select' || hasColorOptions);
    if (!hasBackSide) steps = steps.filter(s => s.id !== 'freeform-back');
    return steps;
  }, [hasColorOptions, hasBackSide]);

  const currentStepIndex = visibleSteps.findIndex(s => s.id === currentStep);
  const progress = currentStep === 'success' ? 100 : ((currentStepIndex) / visibleSteps.length) * 100;

  // Product config for freeform editor
  const productConfig = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      productId: selectedProduct.id,
      sides: selectedProduct.configuration || [],
    };
  }, [selectedProduct]);

  // Derive sides
  const freeformSides = productConfig?.sides ?? [];
  const colorPreviewSides = productConfig?.sides ?? [];
  // For freeform steps, determine which side to show
  const currentFreeformSide = currentStep === 'freeform-front'
    ? freeformSides[0]
    : currentStep === 'freeform-back'
    ? freeformSides[1]
    : freeformSides[0];

  // Auto-fill contact info for authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.name && !contactName) setContactName(user.name);
      if (user.email && !contactEmail) setContactEmail(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  // Fetch product colors when product is selected
  useEffect(() => {
    if (!selectedProduct) {
      setProductColors([]);
      setSelectedColorHex(null);
      return;
    }
    async function fetchColors() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('product_colors')
        .select('id, sort_order, manufacturer_color:manufacturer_colors(id, name, hex, color_code)')
        .eq('product_id', selectedProduct!.id)
        .eq('is_active', true)
        .order('sort_order');

      if (error || !data) {
        setProductColors([]);
        return;
      }
      const colors = data
        .filter((d: any) => d.manufacturer_color)
        .map((d: any) => ({
          id: d.id,
          hex: d.manufacturer_color.hex,
          name: d.manufacturer_color.name,
          colorCode: d.manufacturer_color.color_code,
        }));
      setProductColors(colors);
      if (colors.length > 0) {
        setSelectedColorHex(colors[0].hex);
        setProductColor(colors[0].hex);
      }
    }
    fetchColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  // Set active side and edit mode based on step
  useEffect(() => {
    if (currentStep === 'freeform-front') {
      setEditMode(true);
      if (freeformSides.length > 0) setActiveSide(freeformSides[0].id);
    } else if (currentStep === 'freeform-back') {
      setEditMode(true);
      if (freeformSides.length > 1) setActiveSide(freeformSides[1].id);
    } else {
      setEditMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, setEditMode, setActiveSide]);

  // Fetch the fixed product
  useEffect(() => {
    async function fetchProduct() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('products')
          .select('id, title, base_price, configuration, size_options, category, is_active, is_featured, thumbnail_image_link, created_at, updated_at')
          .eq('id', FIXED_PRODUCT_ID)
          .single();

        if (error) throw error;
        setSelectedProduct(data);
      } catch (err) {
        console.error('Error fetching product:', err);
      }
    }
    fetchProduct();
  }, []);

  // Fetch cobuy preset when product is loaded
  useEffect(() => {
    if (!selectedProduct) return;
    getCobuyPreset(selectedProduct.id).then(preset => {
      if (preset) setCobuyPreset(preset);
    });
  }, [selectedProduct]);

  // Apply preset layer colors immediately when preset is fetched
  useEffect(() => {
    if (!cobuyPreset?.layer_colors) return;
    for (const [sideId, colorMap] of Object.entries(cobuyPreset.layer_colors)) {
      if (typeof colorMap === 'object' && colorMap !== null) {
        for (const [layerId, hex] of Object.entries(colorMap as Record<string, string>)) {
          setLayerColor(sideId, layerId, hex);
        }
      }
    }
  }, [cobuyPreset, setLayerColor]);

  // Apply preset objects onto any newly mounted canvas
  useEffect(() => {
    if (!cobuyPreset?.canvas_state) return;
    if (!isFreeformStep && currentStep !== 'color-select') return;

    const sides = selectedProduct?.configuration ?? [];
    const newCanvases = sides.filter(s => canvasMap[s.id] && !loadedCanvases.current.has(canvasMap[s.id]));
    if (newCanvases.length === 0) return;

    (async () => {
      const fabric = await import('fabric');
      const isEditable = isFreeformStep;

      // Collect font families used in preset objects and ensure they're loaded
      const fontFamilies = new Set<string>();
      for (const side of newCanvases) {
        const raw = cobuyPreset.canvas_state[side.id];
        if (!raw) continue;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        for (const obj of parsed.objects || []) {
          if (obj.fontFamily) fontFamilies.add(obj.fontFamily);
        }
      }
      if (fontFamilies.size > 0) {
        await Promise.all(
          [...fontFamilies].map(f => document.fonts.load(`bold 30px "${f}"`).catch(() => {}))
        );
      }

      for (const side of newCanvases) {
        const canvas = canvasMap[side.id];
        if (!canvas) continue;
        loadedCanvases.current.add(canvas);

        const raw = cobuyPreset.canvas_state[side.id];
        if (!raw) continue;

        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const objects = parsed.objects || [];
          if (objects.length === 0) continue;

          const enlivened = await fabric.util.enlivenObjects(objects);
          for (const obj of enlivened) {
            (obj as any).set({ selectable: isEditable, evented: isEditable });
            canvas.add(obj as any);
          }
          canvas.renderAll();
        } catch (err) {
          console.error(`Failed to load preset for side ${side.id}:`, err);
        }
      }
    })();
  }, [currentStep, cobuyPreset, selectedProduct, canvasMap]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).daum?.Postcode) {
      setIsPostcodeScriptLoaded(true);
    }
  }, []);

  // Auto-populate size dropdown when product is selected
  useEffect(() => {
    if (selectedProduct?.size_options && selectedProduct.size_options.length > 0) {
      const sizeField: CoBuyCustomField = {
        id: 'size-dropdown-fixed',
        type: 'dropdown',
        label: '사이즈',
        required: true,
        fixed: true,
        options: selectedProduct.size_options.map(s => s.label),
      };
      setCustomFields([sizeField]);
    }
  }, [selectedProduct]);

  const handleAddressSearch = (type: 'delivery' | 'pickup') => {
    if (!(window as any).daum?.Postcode) {
      alert('주소 검색 기능을 불러오는 중입니다.');
      return;
    }
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        const addressInfo: CoBuyAddressInfo = {
          roadAddress: data.roadAddress || data.jibunAddress,
          jibunAddress: data.jibunAddress,
          postalCode: data.zonecode,
          addressDetail: '',
        };
        if (type === 'delivery') {
          setDeliverySettings(prev => ({ ...prev, deliveryAddress: addressInfo }));
        } else {
          setDeliverySettings(prev => ({
            ...prev,
            pickupAddress: addressInfo,
            pickupLocation: data.roadAddress || data.jibunAddress,
          }));
        }
      }
    }).open();
  };

  const navigateToStep = useCallback((newStep: Step, direction: 'left' | 'right') => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsAnimating(false);
    }, 150);
  }, []);

  const stepOrder: Step[] = [
    'basic-info', 'color-select', 'freeform-front', 'freeform-back', 'design-review',
    'schedule-address'
  ];

  const shouldSkipStep = (step: Step): boolean => {
    if (step === 'color-select' && !hasColorOptions) return true;
    if (step === 'freeform-back' && !hasBackSide) return true;
    return false;
  };

  const getNextStep = (fromStep: Step): Step | null => {
    const idx = stepOrder.indexOf(fromStep);
    if (idx >= stepOrder.length - 1) return null;
    const next = stepOrder[idx + 1];
    if (shouldSkipStep(next)) return getNextStep(next);
    return next;
  };

  const getPrevStep = (fromStep: Step): Step | null => {
    const idx = stepOrder.indexOf(fromStep);
    if (idx <= 0) return null;
    const prev = stepOrder[idx - 1];
    if (shouldSkipStep(prev)) return getPrevStep(prev);
    return prev;
  };

  const handleNext = async () => {
    // Step 1 validation & draft save
    if (currentStep === 'basic-info') {
      if (!title.trim()) { alert('단체명을 입력해주세요.'); return; }
      if (!contactName.trim()) { alert('이름을 입력해주세요.'); return; }
      if (!contactEmail.trim()) { alert('이메일을 입력해주세요.'); return; }
      if (!contactPhone.trim()) { alert('연락처를 입력해주세요.'); return; }
      if (expectedQuantity === '' || Number(expectedQuantity) < 1) { alert('예상 수량을 입력해주세요.'); return; }
      if (!privacyConsent) { alert('개인정보 수집 동의가 필요합니다.'); return; }

      // Background draft save
      if (!draftRequestId && selectedProduct) {
        createDraftCoBuyRequest({
          productId: selectedProduct.id,
          title: title.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          estimatedQuantity: Number(expectedQuantity),
        }).then(result => {
          if (result) setDraftRequestId(result.id);
        });
      }
    }

    // Capture canvas state before leaving last freeform step
    const lastFreeformStep = hasBackSide ? 'freeform-back' : 'freeform-front';
    if (currentStep === lastFreeformStep) {
      const states = serializeCanvasState();
      setSavedCanvasState(states);
      // Save colors
      const colorData: Record<string, any> = { ...layerColors };
      if (selectedColorHex) {
        const selectedColor = productColors.find(c => c.hex === selectedColorHex);
        colorData._productColor = {
          hex: selectedColorHex,
          name: selectedColor?.name,
          colorCode: selectedColor?.colorCode,
        };
      }
      setSavedColorSelections(colorData);
      // Generate preview data URLs for review step
      const previews: Record<string, string> = {};
      for (const [sideId, canvas] of Object.entries(canvasMap)) {
        try {
          previews[sideId] = (canvas as any).toDataURL({ format: 'png', multiplier: 0.5 });
        } catch {}
      }
      setSidePreviewUrls(previews);
      // Also generate uploadable preview
      const preview = await generatePreview();
      setSavedPreviewUrl(preview);
    }

    const next = getNextStep(currentStep);
    if (next) navigateToStep(next, 'right');
  };

  const handleBack = () => {
    const prev = getPrevStep(currentStep);
    if (prev) navigateToStep(prev, 'left');
  };

  // Serialize canvas state for saving
  const serializeCanvasState = (): Record<string, string> => {
    const states: Record<string, string> = {};
    Object.entries(canvasMap).forEach(([sideId, canvas]) => {
      const userObjects = canvas.getObjects().filter((obj: any) => {
        if (obj.excludeFromExport) return false;
        if (obj.data?.id === 'background-product-image') return false;
        return true;
      });

      const canvasData = {
        version: canvas.toJSON().version,
        objects: userObjects.map((obj: any) => {
          const json = obj.toObject(['data']);
          if (obj.type === 'image') {
            json.src = obj.getSrc();
          }
          return json;
        }),
        layerColors: layerColors[sideId] || {},
      };

      states[sideId] = JSON.stringify(canvasData);
    });
    return states;
  };

  // Generate preview from canvas
  const generatePreview = async (): Promise<string | null> => {
    const firstCanvas = Object.values(canvasMap)[0];
    if (!firstCanvas) return null;

    try {
      const dataUrl = firstCanvas.toDataURL({ format: 'png', multiplier: 0.5 });
      const supabase = createClient();
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `cobuy-request-${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from('user-designs')
        .upload(`previews/${fileName}`, blob, { contentType: 'image/png' });

      if (error) throw error;
      const { data: urlData } = supabase.storage.from('user-designs').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Failed to generate preview:', err);
      return null;
    }
  };

  const handleSubmit = async (skipDelivery = false) => {
    if (!skipDelivery) {
      // Validate delivery if not skipping
      if (receiveByDate && deliverySettings.deliveryAddress?.roadAddress) {
        // All good, has both
      }
    }
    await handleCreate();
  };

  const handleCreate = async () => {
    if (!selectedProduct) return;
    setIsCreating(true);

    try {
      const canvasState = savedCanvasState;
      const previewUrl = savedPreviewUrl;

      const schedulePreferences: CoBuyRequestSchedulePreferences = {
        preferredStartDate: startDate || undefined,
        preferredEndDate: endDate || undefined,
        receiveByDate: receiveByDate || undefined,
      };

      const quantityExpectations: CoBuyRequestQuantityExpectations = {
        minQuantity: minQuantity === '' ? undefined : Number(minQuantity),
        maxQuantity: maxQuantity === '' ? undefined : Number(maxQuantity),
        estimatedQuantity: expectedQuantity === '' ? undefined : Number(expectedQuantity),
      };

      const submitData = {
        productId: selectedProduct.id,
        title: title.trim(),
        description: description.trim() || undefined,
        freeformCanvasState: canvasState,
        freeformColorSelections: savedColorSelections,
        freeformPreviewUrl: previewUrl || undefined,
        schedulePreferences,
        quantityExpectations,
        deliveryPreferences: deliverySettings,
        customFields,
        uploadedImagePaths,
        isPublic,
        guestName: contactName.trim(),
        guestEmail: contactEmail.trim(),
        guestPhone: contactPhone.trim() || undefined,
      };

      let result;
      if (draftRequestId) {
        result = await updateCoBuyRequest(draftRequestId, submitData);
      } else {
        result = await createCoBuyRequest(submitData);
      }

      if (!result) throw new Error('Failed to create request');

      setCreatedShareToken(result.share_token);
      navigateToStep('success' as Step, 'right');

      // Send notification emails (fire-and-forget)
      const submitterEmail = contactEmail.trim();
      const submitterName = contactName.trim();
      fetch('/api/cobuy/notify/request-submitted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          productName: selectedProduct.title,
          receiveByDate,
          deliveryAddress: deliverySettings.deliveryAddress?.roadAddress,
          submitterEmail,
          submitterName,
          shareToken: result.share_token,
          estimatedQuantity: Number(expectedQuantity),
        }),
      }).catch(err => console.error('Failed to send notification emails:', err));
    } catch (error) {
      console.error('Error creating CoBuy request:', error);
      alert('요청 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    if (!createdShareToken) return;
    const shareUrl = `${window.location.origin}/cobuy/request/${createdShareToken}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: '공동구매 요청 링크', url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch { /* ignore */ }
    }
  };

  // Freeform editor helpers
  const addFreeformText = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const fabric = await import('fabric');
    const text = new fabric.IText('텍스트', {
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fill: textColor,
      fontSize: 30,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    text.enterEditing();
  };

  const addFreeformImage = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImageLoading(true);
      try {
        const supabase = createClient();
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `freeform-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error } = await supabase.storage
          .from('user-designs')
          .upload(`images/${fileName}`, file, { contentType: file.type });
        if (error) { alert('이미지 업로드에 실패했습니다.'); return; }
        setUploadedImagePaths(prev => [...prev, data.path]);
        const { data: urlData } = supabase.storage.from('user-designs').getPublicUrl(data.path);
        const fabric = await import('fabric');
        const img = await fabric.FabricImage.fromURL(urlData.publicUrl, { crossOrigin: 'anonymous' });
        const maxW = canvas.width * 0.5;
        const maxH = canvas.height * 0.5;
        if (img.width > maxW || img.height > maxH) {
          img.scale(Math.min(maxW / img.width, maxH / img.height));
        }
        img.set({ left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center' });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      } catch (err) {
        console.error('Error adding image:', err);
        alert('이미지 추가 중 오류가 발생했습니다.');
      } finally {
        setIsImageLoading(false);
      }
    };
    input.click();
  };

  const deleteFreeformObject = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length > 0) {
      active.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  const replaceFreeformImage = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImageLoading(true);
      try {
        const supabase = createClient();
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `freeform-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error } = await supabase.storage
          .from('user-designs')
          .upload(`images/${fileName}`, file, { contentType: file.type });
        if (error) { alert('이미지 업로드에 실패했습니다.'); return; }
        setUploadedImagePaths(prev => [...prev, data.path]);
        const { data: urlData } = supabase.storage.from('user-designs').getPublicUrl(data.path);
        const fabric = await import('fabric');
        const newImg = await fabric.FabricImage.fromURL(urlData.publicUrl, { crossOrigin: 'anonymous' });
        const oldLeft = activeObj.left ?? canvas.width / 2;
        const oldTop = activeObj.top ?? canvas.height / 2;
        const oldBoundW = (activeObj.width || 1) * (activeObj.scaleX || 1);
        const oldBoundH = (activeObj.height || 1) * (activeObj.scaleY || 1);
        const newScale = Math.min(oldBoundW / (newImg.width || 1), oldBoundH / (newImg.height || 1));
        newImg.set({
          left: oldLeft,
          top: oldTop,
          originX: activeObj.originX || 'center',
          originY: activeObj.originY || 'center',
          scaleX: newScale,
          scaleY: newScale,
          angle: activeObj.angle || 0,
        });
        canvas.remove(activeObj);
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
      } catch (err) {
        console.error('Error replacing image:', err);
        alert('이미지 교체 중 오류가 발생했습니다.');
      } finally {
        setIsImageLoading(false);
      }
    };
    input.click();
  };

  // Undo/redo: only track user-added objects
  const isUserObject = (obj: any): boolean => {
    if (!obj) return false;
    if (obj.excludeFromExport) return false;
    if (obj.data?.id === 'background-product-image') return false;
    return true;
  };

  const getUserObjects = useCallback((canvas: any) =>
    canvas.getObjects().filter((obj: any) => isUserObject(obj)), []);

  const saveCanvasState = useCallback(() => {
    if (isUndoRedoing) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const userObjs = getUserObjects(canvas);
    const serialized = userObjs.map((obj: any) => obj.toObject(['data', 'excludeFromExport']));
    const json = JSON.stringify(serialized);
    setCanvasHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, json];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [getActiveCanvas, getUserObjects, historyIndex, isUndoRedoing]);

  // Listen for user object changes to save history
  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas || !isFreeformStep) return;
    if (canvasHistory.length === 0) {
      const userObjs = getUserObjects(canvas);
      const serialized = userObjs.map((obj: any) => obj.toObject(['data', 'excludeFromExport']));
      setCanvasHistory([JSON.stringify(serialized)]);
      setHistoryIndex(0);
    }
    const onChanged = (e: any) => {
      const target = e.target || e.path;
      if (target && !isUserObject(target)) return;
      saveCanvasState();
    };
    canvas.on('object:added', onChanged);
    canvas.on('object:modified', onChanged);
    canvas.on('object:removed', onChanged);
    canvas.on('path:created', onChanged);
    return () => {
      canvas.off('object:added', onChanged);
      canvas.off('object:modified', onChanged);
      canvas.off('object:removed', onChanged);
      canvas.off('path:created', onChanged);
    };
  }, [getActiveCanvas, getUserObjects, currentStep, saveCanvasState, canvasHistory.length]);

  const undo = useCallback(async () => {
    if (historyIndex <= 0) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    setIsUndoRedoing(true);
    const prevIndex = historyIndex - 1;
    getUserObjects(canvas).forEach((obj: any) => canvas.remove(obj));
    const savedObjects = JSON.parse(canvasHistory[prevIndex]);
    if (savedObjects.length > 0) {
      const fabric = await import('fabric');
      const objects = await fabric.util.enlivenObjects(savedObjects);
      objects.forEach((obj: any) => canvas.add(obj));
    }
    canvas.renderAll();
    setHistoryIndex(prevIndex);
    setIsUndoRedoing(false);
  }, [historyIndex, canvasHistory, getActiveCanvas, getUserObjects]);

  const redo = useCallback(async () => {
    if (historyIndex >= canvasHistory.length - 1) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    setIsUndoRedoing(true);
    const nextIndex = historyIndex + 1;
    getUserObjects(canvas).forEach((obj: any) => canvas.remove(obj));
    const savedObjects = JSON.parse(canvasHistory[nextIndex]);
    if (savedObjects.length > 0) {
      const fabric = await import('fabric');
      const objects = await fabric.util.enlivenObjects(savedObjects);
      objects.forEach((obj: any) => canvas.add(obj));
    }
    canvas.renderAll();
    setHistoryIndex(nextIndex);
    setIsUndoRedoing(false);
  }, [historyIndex, canvasHistory, getActiveCanvas, getUserObjects]);

  // Track text/image selection for toolbar
  const activeCanvas = canvasMap[activeSideId] || null;
  useEffect(() => {
    if (!activeCanvas || !isFreeformStep) return;
    const checkSelected = () => {
      const obj = activeCanvas.getActiveObject();
      if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' || isCurvedText(obj))) {
        setHasTextSelected(true);
        setHasImageSelected(false);
        setTextColor((obj as any).fill || '#333333');
        setTextStroke((obj as any).stroke || '');
      } else if (obj && obj.type === 'image') {
        setHasTextSelected(false);
        setHasImageSelected(true);
      } else {
        setHasTextSelected(false);
        setHasImageSelected(false);
      }
    };
    const onCleared = () => { setHasTextSelected(false); setHasImageSelected(false); };
    activeCanvas.on('selection:created', checkSelected);
    activeCanvas.on('selection:updated', checkSelected);
    activeCanvas.on('selection:cleared', onCleared);
    return () => {
      activeCanvas.off('selection:created', checkSelected);
      activeCanvas.off('selection:updated', checkSelected);
      activeCanvas.off('selection:cleared', onCleared);
    };
  }, [activeCanvas, currentStep]);

  const changeTextColor = (color: string) => {
    setTextColor(color);
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' || isCurvedText(obj))) {
      (obj as any).set('fill', color);
      canvas.renderAll();
    }
  };

  const changeTextStroke = (stroke: string) => {
    setTextStroke(stroke);
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' || isCurvedText(obj))) {
      (obj as any).set({ stroke: stroke || null, strokeWidth: stroke ? 1 : 0 });
      canvas.renderAll();
    }
  };

  const handleEditTextContent = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const currentText = (obj as any).text || '';
    setTextEditModal({ open: true, value: currentText });
  };

  const handleTextEditConfirm = () => {
    const canvas = getActiveCanvas();
    if (!canvas) { setTextEditModal({ open: false, value: '' }); return; }
    const obj = canvas.getActiveObject();
    if (!obj) { setTextEditModal({ open: false, value: '' }); return; }
    const newText = textEditModal.value;
    if (isCurvedText(obj)) {
      (obj as any).setText(newText);
    } else {
      (obj as any).set('text', newText);
    }
    canvas.renderAll();
    setTextEditModal({ open: false, value: '' });
  };

  const animationClass = isAnimating
    ? slideDirection === 'right' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0';

  return (
    <div className="fixed inset-0 bg-white lg:bg-gray-100/80 z-50 flex flex-col lg:items-center lg:justify-center">
      {/* Daum Postcode Script */}
      {!isPostcodeScriptLoaded && (
        <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" onLoad={() => setIsPostcodeScriptLoaded(true)} />
      )}

      <div className="flex-1 flex flex-col min-h-0 lg:flex-none lg:flex-row lg:w-full lg:max-w-5xl lg:max-h-[90vh] lg:mx-4 lg:bg-white lg:rounded-2xl lg:shadow-2xl lg:border lg:border-gray-200 lg:overflow-hidden">

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-gray-50/80 border-r border-gray-200 p-6">
          <div className="mb-8">
            <h1 className="text-lg font-bold text-gray-900">과잠 공동구매</h1>
            {selectedProduct && (
              <div className="mt-4 flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-200">
                {selectedProduct.thumbnail_image_link && (
                  <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                    <img src={selectedProduct.thumbnail_image_link} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{selectedProduct.title}</p>
                </div>
              </div>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto -mx-2">
            <div className="space-y-0.5 px-2">
              {visibleSteps.map((step, index) => {
                const isCurrent = step.id === currentStep;
                const isPast = currentStepIndex > index;
                const isSuccess = currentStep === ('success' as Step);
                return (
                  <div key={step.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    isCurrent && !isSuccess ? 'bg-[#3B55A5]/10 text-[#3B55A5] font-semibold'
                    : isPast || isSuccess ? 'text-gray-500' : 'text-gray-300'
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      isCurrent && !isSuccess ? 'bg-[#3B55A5] text-white shadow-md shadow-[#3B55A5]/25'
                      : isPast || isSuccess ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-300'
                    }`}>
                      {isPast || isSuccess ? <Check className="w-3.5 h-3.5" /> : step.icon}
                    </div>
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </nav>
          <button onClick={() => router.back()} disabled={isCreating} className="mt-4 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50">
            취소하기
          </button>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header — hidden during freeform steps */}
          {!isFreeformStep && (
            <header className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
                <div>
                  <h1 className="text-base md:text-lg font-bold text-gray-900 lg:hidden">과잠 공동구매</h1>
                  {currentStep !== ('success' as Step) && (
                    <p className="text-xs md:text-sm text-gray-500">
                      {STEPS.find(s => s.id === currentStep)?.label}
                    </p>
                  )}
                </div>
                <button onClick={() => router.push('/home')} disabled={isCreating} className="p-1.5 md:p-2 rounded-xl hover:bg-gray-100 transition-colors lg:hidden">
                  <X className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                </button>
              </div>
              {currentStep !== ('success' as Step) && (
                <div className="px-4 pb-3 md:px-6 md:pb-4 lg:hidden">
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5">{currentStepIndex + 1} / {visibleSteps.length}</p>
                </div>
              )}
            </header>
          )}

          {/* Content */}
          <main className={`flex-1 overflow-y-auto ${isFreeformStep ? 'flex flex-col' : ''}`}>
            <div className={`transition-all duration-150 ease-out ${animationClass} ${isFreeformStep ? 'flex-1 flex flex-col' : ''}`}>

              {/* Step 1: Basic Info */}
              {currentStep === 'basic-info' && (
                <div className="max-w-lg mx-auto py-8 px-4">
                  <div className="mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">기본 정보를 입력해주세요</h2>
                    <p className="text-sm text-gray-600">요청 확인 및 연락을 위해 필요해요.</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">단체명 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="예: 서울대학교 컴퓨터공학과"
                        className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">이름 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={contactName}
                          onChange={e => setContactName(e.target.value)}
                          placeholder="홍길동"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">이메일 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          placeholder="example@email.com"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">연락처 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={contactPhone}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                            const formatted = digits.length <= 3 ? digits : digits.length <= 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                            setContactPhone(formatted);
                          }}
                          placeholder="010-0000-0000"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">예상 수량 <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={expectedQuantity}
                        onChange={e => setExpectedQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                        placeholder="예: 30"
                        min={1}
                        className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                      <p className="text-xs text-gray-400 mt-1">변동이 있어도 괜찮습니다</p>
                    </div>
                    <div className="pt-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacyConsent}
                          onChange={e => setPrivacyConsent(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-700">
                          <span className="font-semibold text-red-500">[필수]</span> 개인정보 수집 및 이용에 동의합니다. 입력하신 이름, 연락처, 주소 정보는 공동구매 요청 처리 및 배송 목적으로만 사용됩니다.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Color Selection */}
              {currentStep === 'color-select' && selectedProduct && (
                <div className="max-w-lg mx-auto py-6 px-4 md:py-10 md:px-6">
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">색상을 선택해주세요</h2>
                    <p className="text-sm text-gray-500">원하시는 제품 색상을 골라주세요.</p>
                  </div>

                  {colorPreviewSides.length > 0 && (
                    <div className={`grid ${colorPreviewSides.length === 1 ? 'grid-cols-1 max-w-70 mx-auto' : 'grid-cols-2'} gap-3 mb-4`}>
                      {colorPreviewSides.map((side) => (
                        <div key={side.id} className="flex flex-col items-center">
                          <div className={`bg-[#EBEBEB] rounded-xl overflow-hidden ${colorPreviewSides.length === 1 ? 'w-[280px] h-[350px]' : 'w-[150px] h-[187px]'}`}>
                            <div className="origin-top-left" style={{ transform: `scale(${colorPreviewSides.length === 1 ? 280 / 400 : 150 / 400})` }}>
                              <SingleSideCanvas
                                side={side}
                                width={400}
                                height={500}
                                isEdit={false}
                                freeform={true}
                              />
                            </div>
                          </div>
                          {colorPreviewSides.length > 1 && (
                            <p className="text-[10px] text-gray-400 mt-1">{side.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {hasLayerColorOptions && colorPreviewSides.length > 0 && (
                    <LayerColorSelector side={colorPreviewSides[0]} />
                  )}

                  {!hasLayerColorOptions && productColors.length > 0 && (
                    <>
                      {selectedColorHex && (
                        <p className="text-center text-sm font-medium text-gray-700 mb-3">
                          {productColors.find(c => c.hex === selectedColorHex)?.name}
                        </p>
                      )}
                      <div className="flex gap-2.5 flex-wrap justify-center">
                        {productColors.map(color => (
                          <ColorSwatch
                            key={color.id}
                            hex={color.hex}
                            selected={selectedColorHex === color.hex}
                            onClick={() => {
                              setSelectedColorHex(color.hex);
                              setProductColor(color.hex);
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 3-1 & 3-2: Freeform Design (front or back) */}
              {isFreeformStep && productConfig && currentFreeformSide && (
                <div className="flex flex-col min-h-full">
                  {/* Top bar */}
                  <div className="flex items-center justify-center px-4 py-2.5 bg-white border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-500">
                      {currentFreeformSide.name} 디자인
                    </span>
                  </div>

                  {/* Canvas — render all sides but only show current */}
                  <div className="flex-1 flex items-center justify-center bg-[#EBEBEB] relative">
                    {/* Skip to design review toast */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 pl-4 pr-1.5 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 animate-[slideDown_0.4s_ease-out]">
                      <span className="text-xs text-gray-500 whitespace-nowrap">디자인 파일이 없으세요?</span>
                      <button
                        onClick={() => {
                          // Generate preview data URLs before jumping to design-review
                          const previews: Record<string, string> = {};
                          for (const [sideId, canvas] of Object.entries(canvasMap)) {
                            try {
                              previews[sideId] = (canvas as any).toDataURL({ format: 'png', multiplier: 0.5 });
                            } catch {}
                          }
                          setSidePreviewUrls(previews);
                          setCurrentStep('design-review');
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#3B55A5] hover:bg-[#2D4280] rounded-full transition-colors whitespace-nowrap"
                      >
                        디자인 요청하기
                      </button>
                    </div>
                    {(hasTextSelected || hasImageSelected) && (
                      <button
                        onClick={deleteFreeformObject}
                        className="absolute top-2 right-2 z-10 p-2 border border-red-300 bg-white text-red-500 hover:bg-red-50 rounded-xl shadow-sm transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {isImageLoading && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
                        <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 shadow-lg">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[#3B55A5]" />
                          <span className="text-xs text-gray-600">이미지 로딩중...</span>
                        </div>
                      </div>
                    )}

                    {freeformSides.map((side) => (
                      <div
                        key={side.id}
                        className={side.id === currentFreeformSide.id ? '' : 'hidden'}
                      >
                        <SingleSideCanvas
                          side={side}
                          width={400}
                          height={500}
                          isEdit={true}
                          freeform={true}
                        />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-600 text-center py-1.5 bg-[#EBEBEB]">
                    텍스트와 색상을 변경하여 원하는 디자인으로 완성해보세요.
                  </p>

                  {/* Toolbar */}
                  <div className="border-t border-gray-200 bg-white h-[52px] flex items-center">
                    {hasImageSelected ? (
                      <div className="flex items-center justify-center gap-2 w-full">
                        <button onClick={replaceFreeformImage} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-sm font-medium text-gray-700">
                          <Replace className="w-4 h-4" /> 교체
                        </button>
                        <button onClick={deleteFreeformObject} className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-500 hover:bg-red-50 rounded-xl transition text-sm">
                          <Trash2 className="w-4 h-4" /> 삭제
                        </button>
                      </div>
                    ) : hasTextSelected ? (
                      <div className="flex items-center gap-2 px-3 w-full">
                        <button
                          onClick={handleEditTextContent}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200 transition shrink-0"
                        >
                          <Pencil className="w-3 h-3" /> 수정
                        </button>
                        <div className="w-px h-5 bg-gray-200" />
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 shrink-0">글자</span>
                          {['#000000', '#FFFFFF', '#2563EB', '#DC2626'].map(c => (
                            <button key={c} onClick={() => changeTextColor(c)}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${textColor === c ? 'border-[#3B55A5] scale-110' : 'border-gray-300'}`}
                              style={{ backgroundColor: c }} />
                          ))}
                          <button onClick={() => textColorInputRef.current?.click()}
                            className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 hover:border-gray-400 transition flex items-center justify-center bg-gray-50"
                            style={!['#000000', '#FFFFFF', '#2563EB', '#DC2626', '#333333'].includes(textColor) ? { backgroundColor: textColor, borderStyle: 'solid', borderColor: '#3B55A5' } : undefined}
                          >
                            <span className="text-[10px] text-gray-400">+</span>
                          </button>
                          <input ref={textColorInputRef} type="color" value={textColor} onChange={e => changeTextColor(e.target.value)} className="sr-only" />
                        </div>
                        <div className="w-px h-5 bg-gray-200" />
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 shrink-0">테두리</span>
                          {['none', '#000000', '#FFFFFF'].map(c => (
                            <button key={c} onClick={() => changeTextStroke(c === 'none' ? '' : c)}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${textStroke === (c === 'none' ? '' : c) ? 'border-[#3B55A5] scale-110' : 'border-gray-300'}`}
                              style={c === 'none' ? { background: 'linear-gradient(135deg, #fff 45%, #ef4444 50%, #fff 55%)' } : { backgroundColor: c }} />
                          ))}
                          <button onClick={() => strokeColorInputRef.current?.click()}
                            className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 hover:border-gray-400 transition flex items-center justify-center bg-gray-50"
                            style={textStroke && !['#000000', '#FFFFFF'].includes(textStroke) ? { backgroundColor: textStroke, borderStyle: 'solid', borderColor: '#3B55A5' } : undefined}
                          >
                            <span className="text-[10px] text-gray-400">+</span>
                          </button>
                          <input ref={strokeColorInputRef} type="color" value={textStroke || '#000000'} onChange={e => changeTextStroke(e.target.value)} className="sr-only" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 w-full">
                        <button onClick={addFreeformText} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-sm font-medium text-gray-700">
                          <TextCursor className="w-4 h-4" /> 텍스트
                        </button>
                        <button onClick={addFreeformImage} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-sm font-medium text-gray-700">
                          <ImagePlus className="w-4 h-4" /> 이미지
                        </button>
                        <button onClick={deleteFreeformObject} className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-500 hover:bg-red-50 rounded-xl transition text-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1">
                          <button onClick={undo} disabled={historyIndex <= 0} className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-30">
                            <Undo2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button onClick={redo} disabled={historyIndex >= canvasHistory.length - 1} className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-30">
                            <Redo2 className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom navigation */}
                  <div className="shrink-0 border-t border-gray-200 bg-white p-3 safe-area-inset-bottom">
                    <div className="flex gap-2">
                      <button onClick={handleBack} className="py-3 px-5 border-2 border-gray-200 rounded-2xl font-semibold hover:bg-gray-50 flex items-center gap-1.5 text-sm text-gray-700">
                        <ArrowLeft className="w-4 h-4" /> 이전
                      </button>
                      <button onClick={handleNext} className="flex-1 py-3 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold shadow-lg shadow-[#3B55A5]/25 flex items-center justify-center gap-1.5 text-sm">
                        다음 <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Text edit modal */}
                  {textEditModal.open && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
                      <div className="bg-white rounded-2xl max-w-sm w-full mx-4 shadow-2xl overflow-hidden">
                        <div className="p-4">
                          <h3 className="text-sm font-bold text-gray-900 mb-3">텍스트 수정</h3>
                          <input
                            type="text"
                            value={textEditModal.value}
                            onChange={e => setTextEditModal(prev => ({ ...prev, value: e.target.value }))}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleTextEditConfirm(); }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B55A5] focus:border-transparent"
                          />
                        </div>
                        <div className="flex border-t border-gray-200">
                          <button
                            onClick={() => setTextEditModal({ open: false, value: '' })}
                            className="flex-1 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
                          >
                            취소
                          </button>
                          <button
                            onClick={handleTextEditConfirm}
                            className="flex-1 py-3 text-sm font-semibold text-white bg-[#3B55A5] hover:bg-[#2f4584] transition"
                          >
                            확인
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Design Review */}
              {currentStep === 'design-review' && (
                <div className="max-w-lg mx-auto py-8 px-4">
                  <div className="mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#3B55A5]/20 flex items-center justify-center mb-3">
                      <Eye className="w-5 h-5 text-[#3B55A5]" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">디자인을 확인해주세요</h2>
                    <p className="text-sm text-gray-600">완성된 디자인을 확인하고 참고사항을 남겨주세요.</p>
                    <p className="text-xs text-gray-400">*작업 전 디자이너가 최종확인 후 진행됩니다</p>
                  </div>

                  {/* Preview images */}
                  <div className={`grid ${Object.keys(sidePreviewUrls).length === 1 ? 'grid-cols-1 max-w-60 mx-auto' : 'grid-cols-2'} gap-3 mb-6`}>
                    {freeformSides.map(side => {
                      const url = sidePreviewUrls[side.id];
                      if (!url) return null;
                      return (
                        <div key={side.id} className="flex flex-col items-center">
                          <img src={url} alt={side.name} className="rounded-xl border border-gray-200 w-full" />
                          <p className="text-xs text-gray-500 mt-1.5">{side.name}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">참고사항 (선택)</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="예: 디자인 파일이 없어요, OO부분을 수정해주세요"
                      className="w-full px-3 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10 resize-none"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{description.length}/500자</p>
                  </div>
                </div>
              )}

              {/* Step 5: Schedule & Addresses */}
              {currentStep === 'schedule-address' && (
                <div className="max-w-lg mx-auto py-8 px-4">
                  <div className="mb-6">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">일정 및 배송</h2>
                  </div>
                  <div className="space-y-6">
                    {/* Schedule */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">일정</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">수령 희망일</label>
                        <input type="date" value={receiveByDate} onChange={e => setReceiveByDate(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-orange-500" />
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="space-y-3 border-t border-gray-200 pt-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">배송 주소</p>
                      <p className="text-xs text-gray-500">공장에서 제품을 배송받을 주소예요.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSkipDelivery(false)}
                          className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${!skipDelivery ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          주소 입력하기
                        </button>
                        <button
                          onClick={() => setSkipDelivery(true)}
                          className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${skipDelivery ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          아직 모르겠어요
                        </button>
                      </div>
                      {!skipDelivery && (
                        <>
                          <div className="flex gap-2">
                            <input type="text" value={deliverySettings.deliveryAddress?.postalCode || ''} readOnly
                              className="w-24 px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50" placeholder="우편번호" />
                            <button type="button" onClick={() => handleAddressSearch('delivery')}
                              className="flex-1 px-3 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium flex items-center justify-center gap-1.5 text-sm">
                              <Search className="w-4 h-4" /> 주소 검색
                            </button>
                          </div>
                          {deliverySettings.deliveryAddress?.roadAddress && (
                            <div className="space-y-2">
                              <input type="text" value={deliverySettings.deliveryAddress.roadAddress} readOnly className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50" />
                              <input type="text" value={deliverySettings.deliveryAddress.addressDetail || ''}
                                onChange={e => setDeliverySettings(prev => ({ ...prev, deliveryAddress: prev.deliveryAddress ? { ...prev.deliveryAddress, addressDetail: e.target.value } : undefined }))}
                                placeholder="상세주소" className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500" maxLength={100} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Success */}
              {currentStep === ('success' as Step) && createdShareToken && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mb-6 shadow-lg shadow-green-500/25">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-3">요청이 제출되었어요!</h1>
                  <p className="text-base text-gray-600 mb-6">관리자가 디자인을 제작한 후 알려드릴게요.</p>
                  <div className="w-full max-w-sm bg-gray-50 rounded-2xl p-3 mb-6">
                    <p className="text-[10px] font-medium text-gray-500 mb-1.5">요청 확인 링크</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-gray-700 truncate bg-white px-2 py-1.5 rounded-lg border border-gray-200">
                        {typeof window !== 'undefined' ? `${window.location.origin}/cobuy/request/${createdShareToken}` : ''}
                      </code>
                      <button onClick={handleShare} className={`p-1.5 rounded-lg transition-all ${linkCopied ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                        {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => router.push('/home')} className="w-full max-w-sm py-3 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold flex items-center justify-center gap-1.5 text-sm">
                    확인 <ChevronRight className="w-4 h-4" />
                  </button>
                  <a
                    href="http://pf.kakao.com/_xjSdYG/chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full max-w-sm mt-3 py-3 bg-[#FEE500] text-[#191919] rounded-2xl font-semibold text-sm hover:brightness-95 transition"
                  >
                    <img src="/icons/kakaotalk_channel.png" alt="카카오톡" className="w-5 h-5" />
                    카카오톡으로 문의하기
                  </a>
                  <a
                    href="tel:01081400621"
                    className="flex items-center justify-center gap-2 w-full max-w-sm mt-2 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-semibold text-sm hover:bg-gray-50 transition"
                  >
                    <Phone className="w-4 h-4" />
                    전화로 문의하기
                  </a>
                </div>
              )}
            </div>
          </main>

          {/* Footer Navigation (non-freeform, non-success steps) */}
          {currentStep !== ('success' as Step) && !isFreeformStep && (
            <footer className="shrink-0 border-t border-gray-200 bg-white p-3 safe-area-inset-bottom">
              <div className="max-w-lg mx-auto space-y-2">
                <div className="flex gap-2">
                  {getPrevStep(currentStep) !== null && (
                    <button onClick={handleBack} className="py-3 px-5 border-2 border-gray-200 rounded-2xl font-semibold hover:bg-gray-50 flex items-center gap-1.5 text-sm text-gray-700">
                      <ArrowLeft className="w-4 h-4" /> 이전
                    </button>
                  )}
                  {currentStep === 'schedule-address' ? (
                    <button onClick={() => handleSubmit(skipDelivery)} disabled={isCreating}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl font-semibold shadow-lg shadow-green-500/25 flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                      {isCreating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 제출 중...</> : <><Sparkles className="w-4 h-4" /> 제출하기</>}
                    </button>
                  ) : (
                    <button onClick={handleNext}
                      className="flex-1 py-3 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold hover:from-[#2D4280] hover:to-[#243366] shadow-lg shadow-[#3B55A5]/25 flex items-center justify-center gap-1.5 text-sm">
                      다음 <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </footer>
          )}

        </div>
      </div>

      {/* Welcome Popup */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-[fadeIn_0.3s_ease-out]"
          style={{ background: 'radial-gradient(circle at center, rgba(59,85,165,0.15), rgba(0,0,0,0.5))' }}>
          <div className="bg-white rounded-3xl max-w-sm w-full mx-4 shadow-2xl overflow-hidden animate-[popIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="relative p-8 text-center overflow-hidden">
              {/* Decorative background circles */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#3B55A5]/5 animate-[pulse_3s_ease-in-out_infinite]" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-indigo-100/50 animate-[pulse_3s_ease-in-out_infinite_1s]" />

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B55A5] to-indigo-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#3B55A5]/30 animate-[bounceIn_0.5s_ease-out_0.2s_both]">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2 animate-[slideUp_0.4s_ease-out_0.3s_both]">과잠 공동구매</h2>
                <p className="text-sm text-gray-500 leading-relaxed animate-[slideUp_0.4s_ease-out_0.4s_both]">
                  색상 고르고, 수량 선택하면<br />
                  <span className="font-semibold text-[#3B55A5]">견적 자동 완성!</span>
                </p>
              </div>
            </div>
            <div className="px-6 pb-6 animate-[slideUp_0.4s_ease-out_0.5s_both]">
              <button
                onClick={() => setShowWelcome(false)}
                className="w-full py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-[#3B55A5] to-indigo-500 hover:from-[#2f4584] hover:to-indigo-600 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-[#3B55A5]/25"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3) rotate(-12deg); }
          60% { transform: scale(1.1) rotate(3deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Color swatch button
// ============================================================================

function ColorSwatch({ hex, selected, onClick }: { hex: string; selected: boolean; onClick: () => void }) {
  const c = hex.replace('#', '');
  const lum = (0.299 * parseInt(c.substring(0, 2), 16) + 0.587 * parseInt(c.substring(2, 4), 16) + 0.114 * parseInt(c.substring(4, 6), 16)) / 255;
  const checkColor = lum > 0.5 ? '#000' : '#FFF';

  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-full border-2 shrink-0 transition-all ${selected ? 'border-[#3B55A5] scale-110 shadow-md' : 'border-gray-200 hover:scale-105'}`}
      style={{ backgroundColor: hex }}
    >
      {selected && (
        <svg className="w-full h-full p-2" fill="none" stroke={checkColor} strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
