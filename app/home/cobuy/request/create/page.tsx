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
  Undo2, Redo2, Replace, Eye, MessageSquare, PaintBucket,
} from 'lucide-react';
import {
  Product, ProductSide, CoBuyCustomField, CoBuyDeliverySettings, CoBuyAddressInfo,
  CoBuyRequestSchedulePreferences, CoBuyRequestQuantityExpectations,
} from '@/types/types';
import { createCoBuyRequest } from '@/lib/cobuyRequestService';
import { getPricingInfo } from '@/lib/cobuyPricing';
declare global { interface Window { gtag?: (...args: any[]) => void } }
const gtagEvent = (name: string, params?: Record<string, any>) => {
  window.gtag?.('event', name, params);
};
import { getCobuyPreset } from '@/lib/templateService';
import LayerColorSelector from '@/app/components/canvas/LayerColorSelector';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { isCurvedText } from '@/lib/curvedText';
import { motion, AnimatePresence } from 'motion/react';

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
  | 'user-info'
  | 'success';

type RequestType = 'design' | 'consultation';

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'basic-info', label: '수량 선택', icon: <ShoppingBag className="w-4 h-4" /> },
  { id: 'color-select', label: '색상 선택', icon: <Palette className="w-4 h-4" /> },
  { id: 'freeform-front', label: '앞면 디자인', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'freeform-back', label: '뒷면 디자인', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'design-review', label: '디자인 확인', icon: <Eye className="w-4 h-4" /> },
  { id: 'schedule-address', label: '일정 및 배송', icon: <Calendar className="w-4 h-4" /> },
  { id: 'user-info', label: '기본 정보', icon: <UserCircle className="w-4 h-4" /> },
];

export default function CreateCoBuyRequestPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { canvasMap, layerColors, setEditMode, activeSideId, setActiveSide, getActiveCanvas, setProductColor, setLayerColor } = useCanvasStore();

  const [currentStep, setCurrentStep] = useState<Step>('basic-info');

  const [isCreating, setIsCreating] = useState(false);
  const [createdShareToken, setCreatedShareToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Contact info (for all users)
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPreference, setContactPreference] = useState<'phone' | 'email' | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Design choice: 'design' = self-design, 'consultation' = skip design, request consultation
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [showDesignChoice, setShowDesignChoice] = useState(false);

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
  const [expectedQuantity, setExpectedQuantity] = useState<number | ''>(100);
  const minQuantity: number | '' = '';
  const maxQuantity: number | '' = '';
  const [uploadedImagePaths, setUploadedImagePaths] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<{ path: string; name: string; url: string }[]>([]);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
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

  // Undo/redo history (per-side)
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoing, setIsUndoRedoing] = useState(false);
  const isLoadingPresetsRef = useRef(false);
  const sideHistoryRef = useRef<Record<string, { history: string[]; index: number }>>({});
  const prevSideIdRef = useRef<string | null>(null);

  // Tutorial guide state
  const [tutorialStep, setTutorialStep] = useState<number>(-1);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const tutorialHasRun = useRef(false);
  const tutorialReadyAt = useRef(0);

  // Color step tutorial
  const [colorTutorialStep, setColorTutorialStep] = useState<number>(-1);
  const [colorTutorialDismissed, setColorTutorialDismissed] = useState(false);
  const colorTutorialHasRun = useRef(false);

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

  const isConsultation = requestType === 'consultation';
  const designSteps: Step[] = ['color-select', 'freeform-front', 'freeform-back', 'design-review'];

  const canProceed = useMemo(() => {
    if (currentStep === 'basic-info') {
      return !!(expectedQuantity !== '' && Number(expectedQuantity) >= 10);
    }
    return true;
  }, [currentStep, expectedQuantity]);

  const visibleSteps = useMemo(() => {
    let steps = STEPS.filter(s => s.id !== 'color-select' || hasColorOptions);
    if (!hasBackSide) steps = steps.filter(s => s.id !== 'freeform-back');
    if (isConsultation) {
      steps = steps.filter(s => !designSteps.includes(s.id) && s.id !== 'schedule-address');
    }
    return steps;
  }, [hasColorOptions, hasBackSide, isConsultation]);

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

  // Save/restore undo history per side when switching
  useEffect(() => {
    if (!activeSideId || !isFreeformStep) return;
    // Save history for the side we're leaving
    if (prevSideIdRef.current && prevSideIdRef.current !== activeSideId) {
      sideHistoryRef.current[prevSideIdRef.current] = { history: canvasHistory, index: historyIndex };
    }
    // Restore history for the side we're entering
    if (prevSideIdRef.current !== activeSideId) {
      const saved = sideHistoryRef.current[activeSideId];
      if (saved) {
        setCanvasHistory(saved.history);
        setHistoryIndex(saved.index);
      } else {
        setCanvasHistory([]);
        setHistoryIndex(-1);
      }
    }
    prevSideIdRef.current = activeSideId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSideId, isFreeformStep]);

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

  // Apply preset or saved user state onto any newly mounted canvas
  useEffect(() => {
    const hasSavedState = Object.keys(savedCanvasState).length > 0;
    if (!cobuyPreset?.canvas_state && !hasSavedState) return;
    if (!isFreeformStep && currentStep !== 'color-select') return;

    const sides = selectedProduct?.configuration ?? [];
    const newCanvases = sides.filter(s => canvasMap[s.id] && !loadedCanvases.current.has(canvasMap[s.id]));
    if (newCanvases.length === 0) return;

    (async () => {
      isLoadingPresetsRef.current = true;
      const fabric = await import('fabric');
      const isEditable = isFreeformStep;

      // For each side, prefer savedCanvasState (user edits) over preset
      const stateSource: Record<string, string> = {};
      for (const side of newCanvases) {
        if (savedCanvasState[side.id]) {
          stateSource[side.id] = savedCanvasState[side.id];
        } else if (cobuyPreset?.canvas_state?.[side.id]) {
          const raw = cobuyPreset.canvas_state[side.id];
          stateSource[side.id] = typeof raw === 'string' ? raw : JSON.stringify(raw);
        }
      }

      // Collect font families and ensure they're loaded
      const fontFamilies = new Set<string>();
      for (const raw of Object.values(stateSource)) {
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

        const raw = stateSource[side.id];
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
          console.error(`Failed to load state for side ${side.id}:`, err);
        }
      }

      // Reset history so loaded state becomes the baseline
      isLoadingPresetsRef.current = false;
      if (isFreeformStep) {
        for (const side of newCanvases) {
          const c = canvasMap[side.id];
          if (!c) continue;
          const objs = c.getObjects().filter((obj: any) => isUserObject(obj));
          const serialized = objs.map((obj: any) => obj.toObject(['data', 'excludeFromExport']));
          sideHistoryRef.current[side.id] = { history: [JSON.stringify(serialized)], index: 0 };
        }
        const activeCanvas = getActiveCanvas();
        if (activeCanvas) {
          const saved = sideHistoryRef.current[activeSideId];
          if (saved) {
            setCanvasHistory(saved.history);
            setHistoryIndex(saved.index);
          } else {
            const userObjs = getUserObjects(activeCanvas);
            const serialized = userObjs.map((obj: any) => obj.toObject(['data', 'excludeFromExport']));
            setCanvasHistory([JSON.stringify(serialized)]);
            setHistoryIndex(0);
          }
        }
      }
    })();
  }, [currentStep, cobuyPreset, selectedProduct, canvasMap, savedCanvasState]);

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
    gtagEvent('공구_단계이동', { step: newStep, direction });
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsAnimating(false);
    }, 150);
  }, []);

  const stepOrder: Step[] = [
    'basic-info', 'color-select', 'freeform-front', 'freeform-back', 'design-review',
    'schedule-address', 'user-info'
  ];

  const shouldSkipStep = (step: Step): boolean => {
    if (step === 'color-select' && !hasColorOptions) return true;
    if (step === 'freeform-back' && !hasBackSide) return true;
    if (isConsultation && (designSteps.includes(step) || step === 'schedule-address')) return true;
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
    // Step 1 validation
    if (currentStep === 'basic-info') {
      if (expectedQuantity === '' || Number(expectedQuantity) < 10) { alert('최소 10벌 이상 입력해주세요.'); return; }

      gtagEvent('공구_기본정보_완료', { 예상수량: Number(expectedQuantity) });

      // Show design choice modal instead of advancing directly
      setShowDesignChoice(true);
      return;
    }

    // Capture canvas state before leaving freeform steps
    if (isFreeformStep) {
      captureCanvasState();
      // Generate uploadable preview when leaving the last freeform step
      const lastFreeformStep = hasBackSide ? 'freeform-back' : 'freeform-front';
      if (currentStep === lastFreeformStep) {
        const preview = await generatePreview();
        setSavedPreviewUrl(preview);
      }
    }

    const next = getNextStep(currentStep);
    if (next) navigateToStep(next, 'right');
  };

  const handleBack = () => {
    // Capture canvas state before leaving freeform steps
    if (isFreeformStep) {
      captureCanvasState();
    }
    const prev = getPrevStep(currentStep);
    if (prev) navigateToStep(prev, 'left');
  };

  const handleDesignChoice = (choice: RequestType) => {
    setRequestType(choice);
    setShowDesignChoice(false);
    gtagEvent('공구_진행방식_선택', { type: choice });

    if (choice === 'consultation') {
      // Save premade template canvas state directly
      if (cobuyPreset?.canvas_state) {
        const states: Record<string, string> = {};
        for (const [sideId, raw] of Object.entries(cobuyPreset.canvas_state)) {
          states[sideId] = typeof raw === 'string' ? raw : JSON.stringify(raw);
        }
        setSavedCanvasState(states);
        if (cobuyPreset.layer_colors) {
          setSavedColorSelections(cobuyPreset.layer_colors as Record<string, Record<string, string>>);
        }
      }
      // Skip design + schedule steps, go to user-info
      navigateToStep('user-info', 'right');
    } else {
      // Continue normal flow — go to color-select or first freeform step
      // Note: can't use getNextStep here since requestType state hasn't updated yet
      const firstDesignStep: Step = hasColorOptions ? 'color-select' : 'freeform-front';
      navigateToStep(firstDesignStep, 'right');
    }
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

  // Save canvas state (called before navigating away from freeform steps)
  const captureCanvasState = () => {
    if (Object.keys(canvasMap).length === 0) return;
    const states = serializeCanvasState();
    if (Object.keys(states).length > 0) {
      setSavedCanvasState(states);
    }
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
    const previews: Record<string, string> = {};
    for (const [sideId, canvas] of Object.entries(canvasMap)) {
      try {
        previews[sideId] = (canvas as any).toDataURL({ format: 'png', multiplier: 0.5 });
      } catch {}
    }
    if (Object.keys(previews).length > 0) {
      setSidePreviewUrls(previews);
    }
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
    // Validate contact fields
    if (!title.trim()) { alert('단체명을 입력해주세요.'); return; }
    if (!contactName.trim()) { alert('이름을 입력해주세요.'); return; }
    if (!contactPreference) { alert('연락 방법을 선택해주세요.'); return; }
    if (!contactEmail.trim()) { alert('이메일을 입력해주세요.'); return; }
    if (contactPreference === 'phone' && !contactPhone.trim()) { alert('연락처를 입력해주세요.'); return; }
    if (!privacyConsent) { alert('개인정보 수집 동의가 필요합니다.'); return; }

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
        receiveByDate: receiveByDate && receiveByDate !== 'undecided' ? receiveByDate : undefined,
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
        requestType: requestType || 'design',
      };

      const result = await createCoBuyRequest(submitData);

      if (!result) throw new Error('Failed to create request');

      gtagEvent('공구_요청_제출완료', { 예상수량: Number(expectedQuantity) });
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
          submitterPhone: contactPhone.trim() || undefined,
          contactPreference,
          shareToken: result.share_token,
          estimatedQuantity: Number(expectedQuantity),
        }),
      }).catch(err => console.error('Failed to send notification emails:', err));
    } catch (error) {
      console.error('Error creating CoBuy request:', error);
      gtagEvent('공구_요청_제출실패');
      alert('요청 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    if (!createdShareToken) return;
    gtagEvent('공구_링크공유');
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
    gtagEvent('공구_디자인_텍스트추가');
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
    gtagEvent('공구_디자인_이미지추가');
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
        img.set({ left: canvas.width / 2, top: canvas.height / 2, originX: 'center', originY: 'center', data: { storagePath: data.path } });
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

  const deleteFreeformObject = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    gtagEvent('공구_디자인_객체삭제');
    const active = canvas.getActiveObjects();
    if (active.length > 0) {
      const supabase = createClient();
      for (const obj of active) {
        // Delete uploaded images from storage
        if (obj.type === 'image' && (obj as any).data?.storagePath) {
          const storagePath = (obj as any).data.storagePath;
          supabase.storage.from('user-designs').remove([storagePath]);
          setUploadedImagePaths(prev => prev.filter(p => p !== storagePath));
        }
        canvas.remove(obj);
      }
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
          data: { storagePath: data.path },
        });
        // Delete old image from storage if it was user-uploaded
        if ((activeObj as any).data?.storagePath) {
          const oldPath = (activeObj as any).data.storagePath;
          supabase.storage.from('user-designs').remove([oldPath]);
          setUploadedImagePaths(prev => prev.filter(p => p !== oldPath));
        }
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

  const handleReferenceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingRef(true);
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error } = await supabase.storage
          .from('user-designs')
          .upload(`references/${fileName}`, file, { contentType: file.type });
        if (error) { alert('파일 업로드에 실패했습니다.'); continue; }
        setUploadedImagePaths(prev => [...prev, data.path]);
        const { data: urlData } = supabase.storage.from('user-designs').getPublicUrl(data.path);
        setReferenceFiles(prev => [...prev, { path: data.path, name: file.name, url: urlData.publicUrl }]);
      }
    } catch (err) {
      console.error('Error uploading reference file:', err);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingRef(false);
      e.target.value = '';
    }
  };

  const removeReferenceFile = (path: string) => {
    setReferenceFiles(prev => prev.filter(f => f.path !== path));
    setUploadedImagePaths(prev => prev.filter(p => p !== path));
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
    if (isUndoRedoing || isLoadingPresetsRef.current) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const userObjs = getUserObjects(canvas);
    const serialized = userObjs.map((obj: any) => obj.toObject(['data', 'excludeFromExport']));
    const json = JSON.stringify(serialized);
    setCanvasHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, json];
      const newIndex = next.length - 1;
      setHistoryIndex(newIndex);
      // Keep per-side ref in sync
      if (activeSideId) sideHistoryRef.current[activeSideId] = { history: next, index: newIndex };
      return next;
    });
  }, [getActiveCanvas, getUserObjects, historyIndex, isUndoRedoing, activeSideId]);

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

  // ============================================================================
  // Tutorial guide — tours preset objects then teaches editing tools
  // ============================================================================

  type TutorialStep = { text: string; position: 'top' | 'center' | 'above-toolbar'; objectIndex?: number };
  const [tutorialSteps, setTutorialSteps] = useState<TutorialStep[]>([]);

  const dismissTutorial = useCallback(() => {
    setTutorialStep(-1);
    setTutorialDismissed(true);
    localStorage.setItem('modoo_cobuy_editor_tutorial_seen', 'true');
    const canvas = getActiveCanvas();
    if (canvas) canvas.discardActiveObject?.();
  }, [getActiveCanvas]);

  // Build tutorial steps dynamically from preset objects on canvas
  const buildTutorialSteps = useCallback(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return [];
    const objects = canvas.getObjects().filter((obj: any) => isUserObject(obj));

    const steps: TutorialStep[] = [
      { text: '안녕하세요! 여기서 디자인을 꾸밀 수 있어요!\n하나씩 알려드릴게요 🎨', position: 'top' },
    ];

    // Descriptions for preset objects in order
    const textDescriptions = [
      '이건 학교 이니셜이에요!\n눌러서 원하는 글자로 바꿔보세요 ✏️',
      '이건 학번이에요!\n눌러서 본인 학번으로 수정할 수 있어요 🔢',
    ];
    const imageDescriptions = [
      '이건 학교 로고예요!\n눌러서 다른 이미지로 교체할 수 있어요 🏫',
    ];

    let textIdx = 0;
    let imageIdx = 0;
    objects.forEach((obj: any, i: number) => {
      const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' || isCurvedText(obj);
      const isImage = obj.type === 'image';
      if (isText) {
        const desc = textDescriptions[textIdx] || `이건 텍스트예요!\n눌러서 내용을 수정할 수 있어요 ✏️`;
        textIdx++;
        steps.push({ text: desc, position: 'top', objectIndex: i });
      } else if (isImage) {
        const desc = imageDescriptions[imageIdx] || `이건 이미지예요!\n눌러서 다른 이미지로 교체할 수 있어요 🖼️`;
        imageIdx++;
        steps.push({ text: desc, position: 'top', objectIndex: i });
      }
    });

    // Editing tool tips + reassuring message
    steps.push(
      { text: '이미지 파일이 없어도 괜찮아요!\n나중에 추가사항에 적어주시면 돼요 😊', position: 'top' },
    );

    return steps;
  }, [getActiveCanvas]);

  const restartTutorial = useCallback(() => {
    // Rebuild steps, or reuse existing if canvas isn't ready
    const steps = buildTutorialSteps();
    const stepsToUse = steps.length > 0 ? steps : tutorialSteps;
    if (stepsToUse.length > 0) {
      // Clear localStorage so the init useEffect won't immediately re-dismiss
      localStorage.removeItem('modoo_cobuy_editor_tutorial_seen');
      tutorialHasRun.current = true;
      setTutorialSteps(stepsToUse);
      setTutorialDismissed(false);
      setTutorialStep(0);
      setSpotlightRect(null);
      tutorialReadyAt.current = Date.now() + 500;
    }
  }, [buildTutorialSteps, tutorialSteps]);

  // Start tutorial on first freeform-front entry (poll until preset objects are loaded)
  useEffect(() => {
    if (currentStep !== 'freeform-front') return;
    if (tutorialHasRun.current || tutorialDismissed) return;
    const seen = localStorage.getItem('modoo_cobuy_editor_tutorial_seen');
    if (seen === 'true') {
      setTutorialDismissed(true);
      return;
    }
    // Poll until preset objects are on the canvas (preset loading is async)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts > 30) { clearInterval(interval); return; } // give up after 15s
      if (isLoadingPresetsRef.current) return; // still loading
      const canvas = getActiveCanvas();
      if (!canvas) return;
      const userObjs = canvas.getObjects().filter((obj: any) => isUserObject(obj));
      if (userObjs.length === 0 && attempts < 10) return; // wait for objects (up to 5s)
      clearInterval(interval);
      const steps = buildTutorialSteps();
      if (steps.length > 0) {
        setTutorialSteps(steps);
        setTutorialStep(0);
        tutorialHasRun.current = true;
        tutorialReadyAt.current = Date.now() + 500;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentStep, tutorialDismissed, buildTutorialSteps, getActiveCanvas]);

  // Highlight rect for spotlight cutout (screen coordinates)
  const [spotlightRect, setSpotlightRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Highlight the relevant canvas object when tutorial step changes
  useEffect(() => {
    if (tutorialStep < 0 || tutorialDismissed) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const step = tutorialSteps[tutorialStep];
    if (!step) return;

    if (step.objectIndex !== undefined) {
      const objects = canvas.getObjects().filter((obj: any) => isUserObject(obj));
      const target = objects[step.objectIndex];
      if (target) {
        canvas.setActiveObject(target);
        canvas.renderAll();
        // Calculate screen position for spotlight
        const canvasEl = (canvas as any).lowerCanvasEl || (canvas as any).getElement?.();
        if (canvasEl) {
          const canvasRect = canvasEl.getBoundingClientRect();
          const objBound = target.getBoundingRect();
          const scaleX = canvasRect.width / canvas.width;
          const scaleY = canvasRect.height / canvas.height;
          const pad = 8;
          setSpotlightRect({
            x: canvasRect.left + objBound.left * scaleX - pad,
            y: canvasRect.top + objBound.top * scaleY - pad,
            w: objBound.width * scaleX + pad * 2,
            h: objBound.height * scaleY + pad * 2,
          });
        }
      } else {
        setSpotlightRect(null);
      }
    } else {
      canvas.discardActiveObject?.();
      canvas.renderAll();
      setSpotlightRect(null);
    }
  }, [tutorialStep, tutorialSteps, tutorialDismissed, getActiveCanvas]);

  // Auto-advance for steps without objectIndex (timed tips)
  useEffect(() => {
    if (tutorialStep < 0 || tutorialDismissed) return;
    const step = tutorialSteps[tutorialStep];
    if (!step) return;
    // Only auto-advance non-object steps (welcome, tool tips, final)
    if (step.objectIndex !== undefined) return;
    const isLast = tutorialStep >= tutorialSteps.length - 1;
    const timer = setTimeout(() => {
      if (isLast) dismissTutorial();
      else setTutorialStep(prev => prev + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [tutorialStep, tutorialSteps, tutorialDismissed, dismissTutorial]);

  // ============================================================================
  // Color step tutorial
  // ============================================================================

  const COLOR_TUTORIAL_STEPS = [
    { text: '여기서 원하시는 색상을 골라보세요!\n색상에 따라 미리보기가 바뀌어요 🎨', position: 'center' as const },
    { text: '아래 색상을 눌러보세요!\n선택하면 위 미리보기에 바로 반영돼요 👆', position: 'bottom' as const },
    { text: '마음에 드는 색상을 고르셨으면\n"다음"을 눌러주세요! 😊', position: 'center' as const },
  ];

  const dismissColorTutorial = useCallback(() => {
    setColorTutorialStep(-1);
    setColorTutorialDismissed(true);
    localStorage.setItem('modoo_cobuy_color_tutorial_seen', 'true');
  }, []);

  // Start color tutorial on first color-select entry
  useEffect(() => {
    if (currentStep !== 'color-select') return;
    if (colorTutorialHasRun.current || colorTutorialDismissed) return;
    const seen = localStorage.getItem('modoo_cobuy_color_tutorial_seen');
    if (seen === 'true') {
      setColorTutorialDismissed(true);
      return;
    }
    const timer = setTimeout(() => {
      setColorTutorialStep(0);
      colorTutorialHasRun.current = true;
      tutorialReadyAt.current = Date.now() + 500;
    }, 600);
    return () => clearTimeout(timer);
  }, [currentStep, colorTutorialDismissed]);

  // Auto-advance color tutorial timed steps
  useEffect(() => {
    if (colorTutorialStep < 0 || colorTutorialDismissed) return;
    // Step 1 (pick color) waits for user action — don't auto-advance
    if (colorTutorialStep === 1) return;
    const isLast = colorTutorialStep >= COLOR_TUTORIAL_STEPS.length - 1;
    const timer = setTimeout(() => {
      if (isLast) dismissColorTutorial();
      else setColorTutorialStep(prev => prev + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [colorTutorialStep, colorTutorialDismissed, dismissColorTutorial]);

  // Advance color tutorial step 1 when user picks a color
  useEffect(() => {
    if (colorTutorialStep !== 1 || colorTutorialDismissed) return;
    if (selectedColorHex) {
      setColorTutorialStep(2);
    }
  }, [selectedColorHex, colorTutorialStep, colorTutorialDismissed]);

  // Auto-scroll inputs into view when focused (mobile keyboard fix)
  useEffect(() => {
    if (currentStep !== 'user-info') return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Wait for keyboard to appear
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, [currentStep]);

  const changeTextColor = (color: string) => {
    setTextColor(color);
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' || isCurvedText(obj))) {
      (obj as any).set('fill', color);
      canvas.renderAll();
      saveCanvasState();
    }
  };

  const changeTextStroke = (stroke: string) => {
    setTextStroke(stroke);
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox' || isCurvedText(obj))) {
      (obj as any).set({ stroke: stroke || null, strokeWidth: stroke ? 3 : 0 });
      canvas.renderAll();
      saveCanvasState();
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
    saveCanvasState();
    setTextEditModal({ open: false, value: '' });
  };

  const animationClass = isAnimating
    ? slideDirection === 'right' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0';

  return (
    <div className="fixed inset-0 bg-white lg:bg-gray-100/80 z-50 flex flex-col lg:items-center lg:justify-center overflow-x-hidden">
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
                {selectedProduct.thumbnail_image_link?.[0] && (
                  <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                    <img src={selectedProduct.thumbnail_image_link[0]} alt="" className="w-full h-full object-cover" />
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
          {/* Logo header for first step */}
          {currentStep === 'basic-info' && (
            <header className="shrink-0 bg-white px-4 py-3 flex items-center justify-between">
              <img src="/icons/modoo_logo.png" alt="modoo" className="h-6" />
              <button onClick={() => router.push('/home')} disabled={isCreating} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </header>
          )}

          {/* Header — hidden during freeform steps and first step */}
          {!isFreeformStep && currentStep !== 'basic-info' && (
            <header className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
                <div>
                  {/* <h1 className="text-base md:text-lg font-bold text-gray-900 lg:hidden">과잠 공동구매</h1> */}
                  {currentStep !== ('success' as Step) && (
                    <p className="text-xs md:text-sm text-gray-500">
                      {STEPS.find(s => s.id === currentStep)?.label}
                    </p>
                  )}
                </div>
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

              {/* Step 1: Quantity Selection */}
              {currentStep === 'basic-info' && (
                <div className="max-w-lg mx-auto py-6 px-4">
                  <p className="text-center text-sm font-semibold text-gray-700 mb-5">
                    {'예상 수량을 입력하고 바로 견적을 받아보세요!'.split('').map((char, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.05 + i * 0.03 }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  </p>

                  {/* Receipt card */}
                  <motion.div
                    className="bg-white border border-gray-300 rounded-t-lg p-5"
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <span className="text-sm text-gray-600 font-medium">제작 수량 :</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={expectedQuantity}
                        onChange={e => setExpectedQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                        min={10}
                        className="w-20 px-2 py-1 text-xl font-bold text-center border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#3B55A5] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <span className="text-sm text-gray-600 font-medium">벌</span>
                    </div>
                    <div className="flex items-center justify-center mb-6">
                      <input
                        type="range"
                        min={10}
                        max={200}
                        step={1}
                        value={expectedQuantity === '' ? 100 : Number(expectedQuantity)}
                        onChange={e => setExpectedQuantity(parseInt(e.target.value))}
                        className="w-48 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#3B55A5] [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3B55A5] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
                      />
                    </div>
                    {(() => {
                      const qty = expectedQuantity === '' ? 0 : Number(expectedQuantity);
                      const pricing = getPricingInfo(qty);
                      if (qty < 10) return null;
                      if (!pricing) return (
                        <p className="text-xs text-red-500 text-center">최소 10벌부터 제작 가능합니다.</p>
                      );
                      return (
                        <motion.div
                          key={pricing.unitPrice}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                          <p className="text-center text-base font-bold text-gray-900 mb-3">
                            예상 벌당 단가 : <SlotNumber value={pricing.unitPrice} className="text-gray-400" style={{ textDecorationLine: 'line-through' }} /><span className="text-gray-400 line-through">원</span>
                            <span className="text-red-500 ml-1"><SlotNumber value={pricing.discountedUnitPrice} className="text-red-500" />원</span>
                          </p>
                          <div className="text-[11px] text-gray-500 space-y-0.5">
                            <p>*수량이 많아질수록 개당 단가가 줄어듭니다</p>
                            <p>*기본 단가로, 디자인이 복잡해지거나</p>
                            <p>&nbsp;개별 이니셜등이 필요한 경우 소정의 비용이 추가될 수 있습니다.</p>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </motion.div>

                  {/* Promotional banner */}
                  {(() => {
                    const qty = expectedQuantity === '' ? 0 : Number(expectedQuantity);
                    const pricing = getPricingInfo(qty);
                    if (!pricing) return null;
                    const discount = pricing.totalPrice - pricing.discountedTotalPrice;
                    return (
                      <motion.div
                        className="rounded-b-xl overflow-hidden relative"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.4 }}
                      >
                        {/* Background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#5C6DB5] via-[#7B8CC9] to-[#A8B4D8]" />
                        {/* Decorative circle */}
                        <div className="absolute -bottom-16 -right-10 w-56 h-56 rounded-full bg-white/10" />
                        <div className="absolute -bottom-20 -right-6 w-48 h-48 rounded-full bg-white/5" />
                        {/* Content */}
                        <div className="relative p-5 flex flex-col items-start justify-center h-full text-white">
                          <motion.img
                            src="/icons/modoo_logo.png" alt="modoo"
                            className="h-5 mb-3 brightness-0 invert opacity-80"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 0.8, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.5 }}
                          />
                          <p className="text-sm font-medium opacity-90">
                            {'2026 새학기 맞이'.split('').map((char, i) => (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 0.9, y: 0 }}
                                transition={{ duration: 0.25, delay: 0.6 + i * 0.03 }}
                              >
                                {char}
                              </motion.span>
                            ))}
                          </p>
                          <p className="text-base font-bold leading-snug">
                            {'지금 견적만 받아도'.split('').map((char, i) => (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: 0.85 + i * 0.04 }}
                              >
                                {char}
                              </motion.span>
                            ))}
                          </p>
                          <motion.p
                            className="text-3xl font-black tracking-tight mt-4"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 1.2 }}
                          >
                            <SlotNumber value={discount} className="text-white" />원 <span className="text-lg">할인쿠폰 즉시 지급</span>
                          </motion.p>
                          <motion.p
                            className="text-[10px] opacity-50 mt-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            transition={{ duration: 0.4, delay: 1.5 }}
                          >
                            기본 견적가 기준의 할인
                          </motion.p>
                        </div>
                      </motion.div>
                    );
                  })()}
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
                              gtagEvent('공구_색상_선택', { 색상: color.name });
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
                <div className="flex flex-col min-h-full overflow-x-hidden">

                  {/* Canvas — render all sides but only show current */}
                  <div className="flex-1 flex items-center justify-center bg-[#EBEBEB] relative">

                    {/* Skip to consultation pill — floating on top */}
                    <div className="absolute top-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-full shadow-md pointer-events-auto">
                        <span className="text-[11px] text-gray-600">디자인이 어려우신가요?</span>
                        <button
                          onClick={async () => {
                            gtagEvent('공구_디자이너요청_스킵');
                            captureCanvasState();
                            const preview = await generatePreview();
                            setSavedPreviewUrl(preview);
                            setRequestType('consultation');
                            navigateToStep('user-info', 'right');
                          }}
                          className="px-3 py-1 text-[11px] font-medium text-white bg-[#2D3A4A] rounded-full hover:bg-[#1f2937] transition-colors"
                        >
                          디자이너에게 요청하기
                        </button>
                      </div>
                    </div>
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
                        />
                      </div>
                    ))}

                    {/* Tutorial overlay with spotlight cutout + fixed bottom-left character */}
                    <AnimatePresence>
                      {tutorialStep >= 0 && !tutorialDismissed && currentStep === 'freeform-front' && tutorialSteps[tutorialStep] && (
                        <motion.div
                          key="tutorial-overlay"
                          className="fixed inset-0 z-[100]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          onClick={() => {
                            if (Date.now() < tutorialReadyAt.current) return;
                            if (tutorialStep >= tutorialSteps.length - 1) dismissTutorial();
                            else setTutorialStep(prev => prev + 1);
                          }}
                        >
                          {/* Dark backdrop with spotlight cutout */}
                          <svg className="absolute inset-0 w-full h-full">
                            <defs>
                              <mask id="tutorial-spotlight">
                                <rect width="100%" height="100%" fill="white" />
                                {spotlightRect && (
                                  <motion.rect
                                    x={spotlightRect.x}
                                    y={spotlightRect.y}
                                    width={spotlightRect.w}
                                    height={spotlightRect.h}
                                    rx={8}
                                    fill="black"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                  />
                                )}
                              </mask>
                            </defs>
                            <rect
                              width="100%"
                              height="100%"
                              fill="rgba(0,0,0,0.55)"
                              mask="url(#tutorial-spotlight)"
                            />
                          </svg>

                          {/* Spotlight border glow */}
                          {spotlightRect && (
                            <motion.div
                              className="absolute rounded-lg border-2 border-white/60 pointer-events-none"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                              style={{
                                left: spotlightRect.x,
                                top: spotlightRect.y,
                                width: spotlightRect.w,
                                height: spotlightRect.h,
                              }}
                            />
                          )}

                          {/* Character + speech bubble — fixed bottom-left */}
                          <motion.div
                            key={tutorialStep}
                            className="absolute bottom-28 left-3 z-10"
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                          >
                            <div className="flex items-end gap-2">
                              <motion.img
                                src="/icons/modi.png"
                                alt="모디"
                                className="w-14 h-14 shrink-0 select-none mb-1"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                              />
                              <div className="relative bg-white rounded-2xl px-4 py-3 shadow-lg border border-gray-200 max-w-[260px]">
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                  {tutorialSteps[tutorialStep].text}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-300">
                                    {tutorialStep + 1}/{tutorialSteps.length}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); dismissTutorial(); }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    건너뛰기
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Tutorial replay button */}
                    {tutorialDismissed && currentStep === 'freeform-front' && (
                      <button
                        onClick={restartTutorial}
                        className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center hover:bg-white hover:shadow-md transition-all p-1.5"
                        title="튜토리얼 다시보기"
                      >
                        <img src="/icons/modi.png" alt="모디" className="w-7 h-7" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 text-center py-1.5 bg-[#EBEBEB]">
                    텍스트와 색상을 변경하여 원하는 디자인으로 완성해보세요.
                  </p>

                  {/* Toolbar */}
                  <div className="border-t border-gray-200 bg-white h-[52px] flex items-center overflow-x-auto overflow-y-hidden px-3">
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

                  {/* Bottom navigation — fixed to bottom */}
                  <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white p-3 safe-area-inset-bottom">
                    <div className="flex gap-2 max-w-lg mx-auto">
                      <button onClick={handleBack} className="py-3 px-5 border-2 border-gray-200 rounded-2xl font-semibold hover:bg-gray-50 flex items-center gap-1.5 text-sm text-gray-700">
                        <ArrowLeft className="w-4 h-4" /> 이전
                      </button>
                      <button onClick={handleNext} className="flex-1 py-3 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold shadow-lg shadow-[#3B55A5]/25 flex items-center justify-center gap-1.5 text-sm">
                        다음 <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Spacer for fixed bottom nav */}
                  <div className="h-[68px] shrink-0" />

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
                <div className="max-w-lg mx-auto py-6 px-4 relative overflow-hidden">

                  {/* Confetti — falls from top */}
                  <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute animate-[confettiFall_2.5s_ease-in_forwards]"
                        style={{
                          left: `${5 + Math.random() * 90}%`,
                          top: '-12px',
                          animationDelay: `${Math.random() * 1.2}s`,
                          ['--confetti-x' as any]: `${(Math.random() - 0.5) * 80}px`,
                          ['--confetti-r' as any]: `${Math.random() * 720 - 360}deg`,
                        }}
                      >
                        <div
                          className="rounded-sm"
                          style={{
                            backgroundColor: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8FDA', '#A66CFF'][i % 6],
                            width: `${6 + Math.random() * 6}px`,
                            height: `${4 + Math.random() * 4}px`,
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Character speech bubble */}
                  <div className="flex items-start gap-2.5 mb-5">
                    <motion.img
                      src="/icons/modi_happy.png"
                      alt="모디"
                      className="w-14 h-14 shrink-0"
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.1 }}
                    />
                    <motion.div
                      className="relative bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed"
                      initial={{ opacity: 0, scale: 0.8, x: -20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                    >
                      <p className="font-semibold">짜잔!</p>
                      <p>멋진 디자인이 완성됐어요! 아래에서 확인해보세요! 😆</p>
                      <p className="mt-1.5">아이디어나 확인이 필요한 부분은 &apos;참고사항&apos;에 써주시면 디자이너가 참고할게요!</p>
                      <p className="mt-1.5 text-gray-400">10년 차 디자이너가 검토하고 어색한 부분은 잡아드릴 테니 걱정 마세요!</p>
                    </motion.div>
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
                      placeholder={"예: 디자인 파일이 없어요, OO부분을 수정해주세요"}
                      className="w-full px-3 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10 resize-none"
                      rows={4}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{description.length}/500자</p>
                  </div>

                  {/* Reference file upload */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">참고 파일 첨부 (선택)</label>
                    <label className={`flex items-center justify-center gap-1.5 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-[#3B55A5] hover:text-[#3B55A5] transition ${isUploadingRef ? 'opacity-50 pointer-events-none' : ''}`}>
                      {isUploadingRef ? <div className="w-4 h-4 border-2 border-gray-300 border-t-[#3B55A5] rounded-full animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      {isUploadingRef ? '업로드 중...' : '파일 선택'}
                      <input type="file" accept="image/*,.pdf,.ai,.psd,.zip" multiple className="hidden" onChange={handleReferenceFileUpload} />
                    </label>
                    {referenceFiles.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {referenceFiles.map(f => (
                          <div key={f.path} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                            {f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={f.url} alt={f.name} className="w-8 h-8 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center shrink-0">
                                <Tag className="w-3.5 h-3.5 text-gray-400" />
                              </div>
                            )}
                            <span className="text-xs text-gray-600 truncate flex-1">{f.name}</span>
                            <button onClick={() => removeReferenceFile(f.path)} className="text-gray-400 hover:text-red-500 transition shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Schedule & Delivery */}
              {currentStep === 'schedule-address' && (
                <div className="max-w-lg mx-auto py-6 px-4">
                  {/* Modi character speech bubble */}
                  <div className="flex items-start gap-2.5 mb-6">
                    <motion.img
                      src="/icons/modi_thinking.png"
                      alt="모디"
                      className="w-14 shrink-0"
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.1 }}
                    />
                    <motion.div
                      className="relative bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed"
                      initial={{ opacity: 0, scale: 0.8, x: -20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                    >
                      <p>단체복은 뭐니뭐니해도</p>
                      <p>일정에 맞춰 도착하는 것이 가장 중요해요!</p>
                      <p className="mt-1">꼭 받아야하시는 날짜가 있나요?</p>
                    </motion.div>
                  </div>

                  <div className="space-y-6">
                    {/* Schedule */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">일정</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { if (receiveByDate === 'undecided') setReceiveByDate(''); }}
                          className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${receiveByDate !== 'undecided' ? 'bg-[#3B55A5] text-white shadow-md shadow-[#3B55A5]/20' : 'border-2 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          날짜 입력하기
                        </button>
                        <button
                          onClick={() => setReceiveByDate('undecided')}
                          className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${receiveByDate === 'undecided' ? 'bg-[#3B55A5] text-white shadow-md shadow-[#3B55A5]/20' : 'border-2 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          아직 모르겠어요
                        </button>
                      </div>
                      {receiveByDate !== 'undecided' && (
                        <input type="date" value={receiveByDate} onChange={e => setReceiveByDate(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5]" />
                      )}
                    </div>

                    {/* Delivery Address */}
                    <div className="space-y-3 border-t border-gray-200 pt-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">배송 주소</p>
                      <p className="text-xs text-gray-500">공장에서 제품을 배송받을 주소예요.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSkipDelivery(false)}
                          className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${!skipDelivery ? 'bg-[#3B55A5] text-white shadow-md shadow-[#3B55A5]/20' : 'border-2 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          주소 입력하기
                        </button>
                        <button
                          onClick={() => setSkipDelivery(true)}
                          className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${skipDelivery ? 'bg-[#3B55A5] text-white shadow-md shadow-[#3B55A5]/20' : 'border-2 border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          아직 모르겠어요
                        </button>
                      </div>
                      {!skipDelivery && (
                        <>
                          {!deliverySettings.deliveryAddress?.roadAddress ? (
                            <button type="button" onClick={() => handleAddressSearch('delivery')}
                              className="w-full px-3 py-2.5 bg-white border-2 border-[#3B55A5] text-[#3B55A5] rounded-xl hover:bg-[#3B55A5]/5 font-medium flex items-center justify-center gap-1.5 text-sm">
                              <Search className="w-4 h-4" /> 주소 검색
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input type="text" value={deliverySettings.deliveryAddress.postalCode || ''} readOnly
                                  className="w-24 px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50" placeholder="우편번호" />
                                <button type="button" onClick={() => handleAddressSearch('delivery')}
                                  className="flex-1 px-3 py-2.5 bg-white border-2 border-[#3B55A5] text-[#3B55A5] rounded-xl hover:bg-[#3B55A5]/5 font-medium flex items-center justify-center gap-1.5 text-sm">
                                  <Search className="w-4 h-4" /> 주소 검색
                                </button>
                              </div>
                              <input type="text" value={deliverySettings.deliveryAddress.roadAddress} readOnly className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50" />
                              <input type="text" value={deliverySettings.deliveryAddress.addressDetail || ''}
                                onChange={e => setDeliverySettings(prev => ({ ...prev, deliveryAddress: prev.deliveryAddress ? { ...prev.deliveryAddress, addressDetail: e.target.value } : undefined }))}
                                placeholder="상세주소" className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5]" maxLength={100} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: User Info */}
              {currentStep === 'user-info' && (
                <div className="max-w-lg mx-auto py-6 px-4 pb-32">
                  <h2 className="text-base font-bold text-gray-900 text-center mb-4">할인쿠폰과 함께 견적을 보내드릴게요</h2>

                  {/* Modi character speech bubble */}
                  <div className="flex items-start gap-2.5 mb-6">
                    <motion.img
                      src="/icons/modi_thumbsup.png"
                      alt="모디"
                      className="w-14 h-14 shrink-0"
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.1 }}
                    />
                    <motion.div
                      className="relative bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 leading-relaxed"
                      initial={{ opacity: 0, scale: 0.8, x: -20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                    >
                      <p>여기까지 오시느라 고생 많으셨습니다!</p>
                      <p>이제 전문 담당자가</p>
                      <p>정확한 견적을 산출해서 곧 연락드릴게요!</p>
                      <p className="mt-1">어디로 보내드리면 될까요?</p>
                    </motion.div>
                  </div>

                  <div className="space-y-4">
                    {/* 단체명 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">단체명 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="예: 서울대학교 컴퓨터공학과"
                        className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10"
                        maxLength={100}
                      />
                    </div>

                    {/* 이름 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">이름 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                        placeholder="홍길동"
                        className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10"
                      />
                    </div>

                    {/* Contact preference toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setContactPreference('phone')}
                        className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${contactPreference === 'phone' ? 'bg-[#3B55A5] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        전화가 편해요
                      </button>
                      <button
                        onClick={() => setContactPreference('email')}
                        className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition ${contactPreference === 'email' ? 'bg-[#3B55A5] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        이메일이 편해요
                      </button>
                    </div>

                    {/* Email field (shown when any preference is selected) */}
                    {contactPreference && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        이메일 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10"
                      />
                    </div>
                    )}

                    {/* Phone field (only when phone preference) */}
                    {contactPreference === 'phone' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        전화번호 <span className="text-red-500">*</span>
                      </label>
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
                        className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10"
                      />
                    </div>
                    )}

                    {/* Consultation notes */}
                    {isConsultation && (
                      <div className="space-y-3 border-t border-gray-200 pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">참고사항</p>
                        <textarea
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="원하시는 디자인, 참고 이미지 링크 등 자유롭게 남겨주세요."
                          className="w-full px-3 py-3 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#3B55A5] focus:ring-4 focus:ring-[#3B55A5]/10 resize-none"
                          rows={3}
                          maxLength={500}
                        />
                        <p className="text-xs text-gray-400">{description.length}/500자</p>
                        <label className={`flex items-center justify-center gap-1.5 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-[#3B55A5] hover:text-[#3B55A5] transition ${isUploadingRef ? 'opacity-50 pointer-events-none' : ''}`}>
                          {isUploadingRef ? <div className="w-4 h-4 border-2 border-gray-300 border-t-[#3B55A5] rounded-full animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                          {isUploadingRef ? '업로드 중...' : '참고 파일 첨부'}
                          <input type="file" accept="image/*,.pdf,.ai,.psd,.zip" multiple className="hidden" onChange={handleReferenceFileUpload} />
                        </label>
                        {referenceFiles.length > 0 && (
                          <div className="space-y-1.5">
                            {referenceFiles.map(f => (
                              <div key={f.path} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                                {f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <img src={f.url} alt={f.name} className="w-8 h-8 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center shrink-0">
                                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                                  </div>
                                )}
                                <span className="text-xs text-gray-600 truncate flex-1">{f.name}</span>
                                <button onClick={() => removeReferenceFile(f.path)} className="text-gray-400 hover:text-red-500 transition shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Privacy consent */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacyConsent}
                          onChange={e => setPrivacyConsent(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#3B55A5] focus:ring-[#3B55A5]"
                        />
                        <span className="text-xs text-gray-700">
                          <span className="font-semibold text-red-500">[필수]</span> 개인정보 수집 및 이용에 동의합니다. 입력하신 이름, 연락처, 주소 정보는 공동구매 요청 처리 및 배송 목적으로만 사용됩니다.
                        </span>
                      </label>
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
                  <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    {isConsultation ? '상담 요청이 제출되었어요!' : '요청이 제출되었어요!'}
                  </h1>
                  <p className="text-base text-gray-600 mb-6">
                    {isConsultation ? '담당자가 확인 후 연락드릴게요.' : '관리자가 디자인을 제작한 후 알려드릴게요.'}
                  </p>
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
                  <button onClick={() => router.push(`/cobuy/request/${createdShareToken}`)} className="w-full max-w-sm py-3 bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white rounded-2xl font-semibold flex items-center justify-center gap-1.5 text-sm">
                    확인 <ChevronRight className="w-4 h-4" />
                  </button>
                  <a
                    href="http://pf.kakao.com/_xjSdYG/chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => gtagEvent('공구_완료_카카오톡문의')}
                    className="flex items-center justify-center gap-2 w-full max-w-sm mt-3 py-3 bg-[#FEE500] text-[#191919] rounded-2xl font-semibold text-sm hover:brightness-95 transition"
                  >
                    <img src="/icons/kakaotalk_channel.png" alt="카카오톡" className="w-5 h-5" />
                    카카오톡으로 문의하기
                  </a>
                  <a
                    href="tel:01081400621"
                    onClick={() => gtagEvent('공구_완료_전화문의')}
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
                  {currentStep === 'user-info' ? (
                    <button onClick={() => handleSubmit(skipDelivery)} disabled={isCreating}
                      className="flex-1 py-3 bg-gradient-to-r from-[#3B55A5] to-[#3B55A0] text-white rounded-2xl font-semibold shadow-lg flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                      {isCreating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 제출 중...</> : <>제출하기</>}
                    </button>
                  ) : currentStep === 'basic-info' ? (
                    <button onClick={handleNext} disabled={!canProceed}
                      className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center text-base transition-all ${
                        canProceed
                          ? 'bg-[#FEE500] text-[#191919] hover:brightness-95 shadow-lg shadow-yellow-500/20'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}>
                      견적내고 할인쿠폰 받기
                    </button>
                  ) : (
                    <button onClick={handleNext} disabled={!canProceed}
                      className={`flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-1.5 text-sm transition-all ${
                        canProceed
                          ? 'bg-gradient-to-r from-[#3B55A5] to-[#2D4280] text-white hover:from-[#2D4280] hover:to-[#243366] shadow-lg shadow-[#3B55A5]/25'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}>
                      다음 <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </footer>
          )}

        </div>
      </div>

      {/* Design Choice Modal */}
      {showDesignChoice && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setShowDesignChoice(false)}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full sm:mx-4 shadow-2xl overflow-hidden animate-[slideUpModal_0.35s_cubic-bezier(0.16,1,0.3,1)]"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 sm:hidden" />
            <div className="px-6 pt-5 pb-3 text-center">
              <p className="text-sm font-bold text-gray-900 leading-relaxed">
                정확한 견적과<br />
                1차 디자인 시안 검토를 위해<br />
                아래 두가지 방식 중 하나를 선택해주세요!
              </p>
            </div>
            <div className="px-5 pb-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDesignChoice('design')}
                className="group relative text-center p-5 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 hover:border-[#3B55A5] hover:shadow-lg hover:shadow-[#3B55A5]/10 transition-all duration-200 active:scale-[0.97] flex flex-col items-center"
              >
                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">🎨</div>
                <p className="text-[13px] font-bold text-gray-900 mb-2">제가 직접 <br></br>디자인 해볼래요</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  텍스트, 이미지를 배치해보고
                  <br></br>디자인 시안을 바로 <br></br>확인할 수 있어요
                </p>
              </button>
              <button
                onClick={() => handleDesignChoice('consultation')}
                className="group relative text-center p-5 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-400/10 transition-all duration-200 active:scale-[0.97] flex flex-col items-center"
              >
                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">🤔</div>
                <p className="text-[13px] font-bold text-gray-900 mb-2">전문 디자이너에게 <br></br> 부탁할래요</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  디자인이 어려우신가요?<br></br>
                  이미지 파일이 없으신가요?<br></br>
                  전문 디자이너에게<br></br>
                  <span className='text-black'>무료로 시안을 받아보세요</span>
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Popup */}
      {/* Color step tutorial overlay — top level so it covers entire screen */}
      <AnimatePresence>
        {colorTutorialStep >= 0 && !colorTutorialDismissed && currentStep === 'color-select' && (
          <motion.div
            key="color-tutorial-overlay"
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => {
              if (Date.now() < tutorialReadyAt.current) return;
              if (colorTutorialStep >= COLOR_TUTORIAL_STEPS.length - 1) dismissColorTutorial();
              else setColorTutorialStep(prev => prev + 1);
            }}
          >
            <div className="absolute inset-0 bg-black/50" />
            <motion.div
              key={colorTutorialStep}
              className="absolute bottom-28 left-3 z-10"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            >
              <div className="flex items-end gap-2">
                <motion.img
                  src="/icons/modi.png"
                  alt="모디"
                  className="w-14 h-14 shrink-0 select-none mb-1"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                />
                <div className="relative bg-white rounded-2xl px-4 py-3 shadow-lg border border-gray-200 max-w-[280px]">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {COLOR_TUTORIAL_STEPS[colorTutorialStep].text}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-300">
                      {colorTutorialStep + 1}/{COLOR_TUTORIAL_STEPS.length}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissColorTutorial(); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      건너뛰기
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
        @keyframes slotShuffle {
          0% { transform: translateY(0); opacity: 1; }
          20% { transform: translateY(-100%); opacity: 0; }
          40% { transform: translateY(100%); opacity: 0; }
          60% { transform: translateY(50%); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideUpModal {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tutorialBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh) translateX(var(--confetti-x, 0px)) rotate(var(--confetti-r, 360deg)); opacity: 0; }
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

// ============================================================================
// Slot-machine animated number
// ============================================================================

function SlotNumber({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const formatted = value.toLocaleString();
  const prevRef = useRef(formatted);
  const [digits, setDigits] = useState(formatted.split(''));
  const [animating, setAnimating] = useState<boolean[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    const next = formatted;
    if (prev === next) return;

    const maxLen = Math.max(prev.length, next.length);
    const padPrev = prev.padStart(maxLen);
    const padNext = next.padStart(maxLen);
    const changed = padNext.split('').map((c, i) => c !== padPrev[i]);

    setAnimating(changed);
    setDigits(padNext.split(''));
    prevRef.current = next;

    const timer = setTimeout(() => setAnimating(new Array(maxLen).fill(false)), 400);
    return () => clearTimeout(timer);
  }, [formatted]);

  return (
    <span className={`inline-flex overflow-hidden ${className || ''}`} style={style}>
      {digits.map((d, i) => (
        <span
          key={`${i}-${digits.length}`}
          className={`inline-block transition-all duration-300 ${animating[i] ? 'animate-[slotShuffle_0.4s_ease-out]' : ''}`}
        >
          {d}
        </span>
      ))}
    </span>
  );
}

