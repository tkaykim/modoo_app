'use client'
import ProductDesigner from "@/app/components/canvas/ProductDesigner";
import LayerColorSelector from "@/app/components/canvas/LayerColorSelector";
import DesktopToolbar from "@/app/components/canvas/DesktopToolbar";
import { Product, ProductConfig, CartItem, ProductColor, PrintMethodRecord } from "@/types/types";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useCartStore } from "@/store/useCartStore";
import { useFontStore } from "@/store/useFontStore";
import Header from "@/app/components/Header";
import { X, Trash2, ChevronsUp, ArrowUp, ArrowDown, ChevronsDown, Loader2, Info, Check, Layers as LayersIcon, MapPin } from "lucide-react";
import AnchorPresetPanel from '@/app/components/canvas/AnchorPresetPanel';
import { fetchProductCalibrations, calibrationToCanvasMmPerPx } from '@/lib/calibrationFetch';
import { snapArtworkToAnchor } from '@/lib/anchorSnap';
import type { AnchorPreset } from '@/lib/anchorPresets';
import { useState, useEffect, useRef } from "react";
import {
  trackViewItem,
  trackEditorOpen,
  trackDesignStart,
  trackDesignAction,
  trackDesignComplete,
  trackDesignResume,
  trackDesignDiscard,
  trackCheckoutIntent,
  trackAddToCart,
  trackBeginCheckout,
} from "@/lib/gtm-events";
import * as fabric from 'fabric';
import { isCurvedText } from '@/lib/curvedText';
import TextStylePanel from '@/app/components/canvas/TextStylePanel';
import { calculateAllSidesPricing, type PricingSummary } from "@/app/utils/canvasPricing";
import { saveDesign } from "@/lib/designService";
import { addToCartDB } from "@/lib/cartService";
import { generateProductThumbnail } from "@/lib/thumbnailGenerator";
import QuantitySelectorModal from "@/app/components/QuantitySelectorModal";
import LayersPrintPanel from "@/app/components/canvas/LayersPrintPanel";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useAuthStore } from "@/store/useAuthStore";
import LoginPromptModal from "@/app/components/LoginPromptModal";
import GuestDesignRecallModal from "@/app/components/GuestDesignRecallModal";
import { getGuestDesign, removeGuestDesign, saveGuestDesign, createGuestDesignAutosaver, type GuestDesign } from "@/lib/guestDesignStorage";
import { setPrintPricingConfig } from "@/lib/printPricingConfig";
import LandingStep from "./steps/LandingStep";
import ColorSelectorModal from "@/app/components/canvas/ColorSelectorModal";
import ReviewsSection from "@/app/components/ReviewsSection";
import DescriptionImageSection from "@/app/components/DescriptionImageSection";
import SizeChartTable from "@/app/components/SizeChartTable";
import QuickReplacePanel from "@/app/components/canvas/QuickReplacePanel";
import { getTemplate, getGroup } from "@/lib/templateService";
import { applyTemplateToStore, applyGroupTemplateToStore } from "@/lib/applyTemplate";
import type { DesignTemplate, TemplateGroup } from "@/types/types";
import { uploadDataUrlToStorage } from "@/lib/supabase-storage";
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from "@/lib/storage-config";
import type { Canvas as FabricCanvas } from "fabric";

/**
 * Build the customer-facing design proof image (시안 확인용).
 *
 * Renders the front at high resolution and uploads it to storage, returning a
 * URL — so the proof stays crisp for small designs without bloating the DB with
 * inline base64. Falls back to a small inline data URL if the upload fails
 * (e.g. a guest without storage access), so it never blocks save/checkout.
 */
async function buildProofImage(canvasMap: Record<string, FabricCanvas>): Promise<string> {
  if (Object.keys(canvasMap).length === 0) {
    return '';
  }
  const highRes = generateProductThumbnail(canvasMap, 'front', 1600, 1600);
  if (!highRes) {
    return '';
  }
  try {
    const supabase = createClient();
    const res = await uploadDataUrlToStorage(
      supabase,
      highRes,
      STORAGE_BUCKETS.USER_DESIGNS,
      STORAGE_FOLDERS.IMAGES,
    );
    if (res.success && res.url) return res.url;
  } catch (e) {
    console.warn('[proof] preview upload failed, using inline fallback', e);
  }
  // Fallback: small inline image — avoid storing a 1600px base64 blob in the DB.
  return generateProductThumbnail(canvasMap, 'front', 400, 400);
}

function getLiveCanvasMap(fallback: Record<string, FabricCanvas>): Record<string, FabricCanvas> {
  const liveCanvasMap = useCanvasStore.getState().canvasMap;
  return Object.keys(liveCanvasMap).length > 0 ? liveCanvasMap : fallback;
}

function createGuestDesignId(productId: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `guest-${productId}-${uuid}`;
  return `guest-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type CanvasSelectionEvent = {
  selected?: fabric.FabricObject[];
};

type EditorStep = 'landing' | 'editor' | 'quantity';

interface ProductEditorUnifiedProps {
  product: Product;
  allPrintMethods?: PrintMethodRecord[];
  enabledPrintMethodIds?: Set<string>;
  isMobile: boolean;
}

export default function ProductEditorUnified({
  product,
  allPrintMethods = [],
  enabledPrintMethodIds = new Set(),
  isMobile,
}: ProductEditorUnifiedProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cartItemId = searchParams.get('cartItemId');
  const partnerMallAdd = searchParams.get('partnerMallAdd');
  const partnerMallBuy = searchParams.get('partnerMallBuy');
  const templateIdParam = searchParams.get('templateId');
  // 실험: ?layers-lab=1 진입 시에만 LayersPrintPanel 마운트. prod URL엔 안 붙음 → 손님 무영향.
  const layersLabEnabled = searchParams?.get('layers-lab') === '1';
  // layers-lab 진입은 landing 거치지 않고 바로 editor로 보내서 패널 즉시 확인 가능하게.
  const isSpecialMode = !!cartItemId || !!partnerMallAdd || !!partnerMallBuy || !!templateIdParam || layersLabEnabled;

  const [currentStep, setCurrentStep] = useState<EditorStep>(
    isSpecialMode ? 'editor' : 'landing'
  );

  // Quick-replace template state — populated when entering with ?templateId=...
  const [quickReplaceTemplate, setQuickReplaceTemplate] = useState<DesignTemplate | null>(null);
  const [quickReplaceGroup, setQuickReplaceGroup] = useState<TemplateGroup | null>(null);
  const [templateApplyAttempted, setTemplateApplyAttempted] = useState(false);

  const {
    setEditMode,
    setActiveSide,
    productColor,
    setProductColor,
    setSelectedProductColor,
    saveAllCanvasState,
    restoreAllCanvasState,
    canvasMap,
    canvasVersion,
    incrementCanvasVersion,
    activeSideId,
    resetCanvasState,
    anchorPanelOpen,
    setAnchorPanelOpen,
    setHoveredAnchorId,
    layersPanelOpen,
    setLayersPanelOpen,
  } = useCanvasStore();

  const { addItem: addToCart, items: cartStoreItems } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isQuantitySelectorOpen, setIsQuantitySelectorOpen] = useState(false);
  const [, setIsLoadingCartItem] = useState(false);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isRecallGuestDesignOpen, setIsRecallGuestDesignOpen] = useState(false);
  const [guestDesign, setGuestDesign] = useState<GuestDesign | null>(null);
  // 비회원 디자인 불러오기(recall) 진행중 플래그. landing→editor 캔버스 리마운트 때문에
  // 복원은 반드시 editor 단계의 캔버스가 마운트된 뒤 수행해야 한다(아래 effect 참고).
  const [recallRequested, setRecallRequested] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [isSavingToMall, setIsSavingToMall] = useState(false);
  const [retouchRequested, setRetouchRequested] = useState(false);
  const [showRetouchModal, setShowRetouchModal] = useState(false);
  const [showBgRemovalModal, setShowBgRemovalModal] = useState(false);
  // 모바일 하단 바(리터치+완료) 높이를 측정해 CSS 변수로 노출 → 툴 독이 그 위에 flush로 얹힌다.
  // 바 높이는 배경제거 체크박스 유무로 가변이라 고정 offset 대신 측정값을 쓴다.
  const mobileBottomBarRef = useRef<HTMLDivElement>(null);
  // 실험 패널 토글 — layersPanelOpen은 스토어 공유(모바일 툴 독에서 토글).

  // 자주쓰는위치(앵커) — 데스크톱 우측 aside에 도킹. 데이터·지오메트리·픽 핸들러.
  const [sideAnchorsForPanel, setSideAnchorsForPanel] = useState<AnchorPreset[]>([]);
  const [nativeMmPerPxForPanel, setNativeMmPerPxForPanel] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!product.id || !activeSideId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setSideAnchorsForPanel([]);
        setNativeMmPerPxForPanel(0);
      });
      return () => { cancelled = true; };
    }
    fetchProductCalibrations(product.id).then((map) => {
      if (cancelled) return;
      const cal = map.get(activeSideId);
      setSideAnchorsForPanel(cal?.anchors ?? []);
      setNativeMmPerPxForPanel(cal?.nativeMmPerPx ?? 0);
    }).catch(() => {
      if (!cancelled) { setSideAnchorsForPanel([]); setNativeMmPerPxForPanel(0); }
    });
    return () => { cancelled = true; };
  }, [product.id, activeSideId]);

  // 모바일 하단 바 높이 → --editor-dock-bottom. 툴 독이 이 변수만큼 띄워져 바 위에 붙는다.
  useEffect(() => {
    const el = mobileBottomBarRef.current;
    const root = document.documentElement;
    if (!el) { root.style.removeProperty('--editor-dock-bottom'); return; }
    const apply = () => root.style.setProperty('--editor-dock-bottom', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--editor-dock-bottom'); };
  }, [isMobile, quickReplaceTemplate, selectedObject]);

  const resolveAnchorGeometry = (): { mmPerPx: number; mockupLeft: number; mockupTop: number } | null => {
    const canvas = canvasMap[activeSideId];
    if (!canvas) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = canvas as any;
    const sw = c.scaledImageWidth as number | undefined;
    const ow = c.originalImageWidth as number | undefined;
    const mockupLeft = (c.mockupCanvasLeft as number | undefined) ?? 0;
    const mockupTop = (c.mockupCanvasTop as number | undefined) ?? 0;
    if (nativeMmPerPxForPanel > 0 && sw && ow) {
      const r = calibrationToCanvasMmPerPx({ nativeMmPerPx: nativeMmPerPxForPanel, scaledImageWidth: sw, originalImageWidth: ow });
      if (r) return { mmPerPx: r, mockupLeft, mockupTop };
    }
    const realW = (c.realWorldProductWidth as number | undefined) ?? 0;
    if (sw && sw > 0 && realW > 0) return { mmPerPx: realW / sw, mockupLeft, mockupTop };
    return null;
  };

  const handlePickAnchorSidebar = (anchor: AnchorPreset) => {
    const canvas = canvasMap[activeSideId];
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target) return;
    const geo = resolveAnchorGeometry();
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

  const productConfig: ProductConfig = {
    productId: product.id,
    sides: product.configuration,
  };

  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  // ─── Step transitions ────────────────────────────────────────────
  const goToEditor = () => {
    setCurrentStep('editor');
    setEditMode(true);
    trackDesignStart({
      product_id: product.id,
      product_name: product.title,
      brand: product.manufacturer_name ?? undefined,
      category: product.category ?? undefined,
    });
  };

  // 비회원 저장 디자인 불러오기 시작.
  // ⚠ 복원은 여기서 즉시 하지 않는다. 일반 비회원은 recall 모달이 'landing' 단계에서 뜨는데,
  // landing의 (숨은) 캔버스에 복원한 뒤 editor로 전환하면 editor가 캔버스를 새로 마운트하면서
  // 복원된 객체가 사라진다(디자인은 없고 디자인 비용만 남는 버그). 그래서 editor로 먼저 전환하고,
  // editor 캔버스가 준비된 뒤 아래 effect에서 복원한다.
  const handleBeginRecall = async () => {
    if (!guestDesign) { setIsRecallGuestDesignOpen(false); return; }
    setRecallRequested(true);
    if (currentStep !== 'editor') goToEditor();
  };

  const handleEditorDone = () => {
    if (!isAuthenticated) {
      // Save guest design as backup, but allow proceeding to quantity selector
      const canvasState = saveAllCanvasState();
      saveGuestDesign({
        productId: product.id,
        productColor,
        canvasState,
        customFonts: useFontStore.getState().customFonts,
      });
    }
    setCurrentStep('quantity');
    setIsQuantitySelectorOpen(true);
    {
      const facesUsed: ('front' | 'back' | 'left' | 'right')[] = [];
      let textCount = 0;
      let imageCount = 0;
      try {
        for (const side of product.configuration) {
          const c = canvasMap[side.id];
          if (!c) continue;
          const objects = c.getObjects().filter((obj) => {
            if (obj.excludeFromExport) return false;
            const data = obj.get('data') as { id?: string } | undefined;
            return data?.id !== 'background-product-image' && data?.id !== 'center-line';
          });
          if (objects.length > 0) {
            const idLower = (side.id || '').toLowerCase();
            const nameLower = (side.name || '').toLowerCase();
            const guess: 'front' | 'back' | 'left' | 'right' | null =
              idLower.includes('front') || nameLower.includes('앞') || nameLower.includes('front') ? 'front'
              : idLower.includes('back') || nameLower.includes('뒤') || nameLower.includes('back') ? 'back'
              : idLower.includes('left') || nameLower.includes('왼') || nameLower.includes('left') ? 'left'
              : idLower.includes('right') || nameLower.includes('오른') || nameLower.includes('right') ? 'right'
              : null;
            if (guess) facesUsed.push(guess);
          }
          for (const o of objects) {
            const t = o.type;
            if (t === 'i-text' || t === 'text' || t === 'textbox') textCount++;
            else if (t === 'image') imageCount++;
          }
        }
      } catch {
        // 집계 실패해도 무시(트래킹 부가 정보)
      }
      trackDesignComplete({
        product_id: product.id,
        faces_used: facesUsed,
        text_count: textCount,
        image_count: imageCount,
        template_used: false,
        retouch_requested: retouchRequested,
        color: productColor,
        base_price: product.base_price,
        design_fee: pricingData.totalAdditionalPrice,
      });
      trackCheckoutIntent({
        product_id: product.id,
        total_quantity: 0,
        value: pricePerItem,
      });
    }
  };

  // ─── Color change ────────────────────────────────────────────────
  const handleColorChange = (color: string) => {
    setProductColor(color);
    const matched = productColors.find((c) => c.manufacturer_colors.hex === color);
    setSelectedProductColor(
      matched
        ? { id: matched.id, sideMockups: (matched.side_mockups ?? {}) as Record<string, string> }
        : null
    );
    trackDesignAction({ action_type: 'color_change', product_id: product.id, color });
  };

  // ─── Desktop layer manipulation ──────────────────────────────────
  const bringToFront = () => {
    const canvas = canvasMap[activeSideId];
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.renderAll();
      trackDesignAction({ action_type: 'layer_move', product_id: product.id, side_id: activeSideId });
    }
  };

  const sendToBack = () => {
    const canvas = canvasMap[activeSideId];
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });
      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);
      const currentIndex = objects.indexOf(activeObject);
      const targetIndex = maxSystemIndex + 1;
      if (currentIndex > targetIndex) {
        canvas.remove(activeObject);
        canvas.insertAt(targetIndex, activeObject);
        canvas.setActiveObject(activeObject);
        canvas.renderAll();
        trackDesignAction({ action_type: 'layer_move', product_id: product.id, side_id: activeSideId });
      }
    }
  };

  const bringForward = () => {
    const canvas = canvasMap[activeSideId];
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.renderAll();
      trackDesignAction({ action_type: 'layer_move', product_id: product.id, side_id: activeSideId });
    }
  };

  const sendBackward = () => {
    const canvas = canvasMap[activeSideId];
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });
      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);
      const currentIndex = objects.indexOf(activeObject);
      if (currentIndex > maxSystemIndex + 1) {
        canvas.sendObjectBackwards(activeObject);
        canvas.renderAll();
        trackDesignAction({ action_type: 'layer_move', product_id: product.id, side_id: activeSideId });
      }
    }
  };

  const handleDeleteObject = () => {
    const canvas = canvasMap[activeSideId];
    const selected = canvas?.getActiveObject();
    const selectedObjects = canvas?.getActiveObjects();
    if (selectedObjects && selectedObjects.length > 0) {
      selectedObjects.forEach(obj => canvas?.remove(obj));
      canvas?.discardActiveObject();
      canvas?.renderAll();
      incrementCanvasVersion();
      trackDesignAction({ action_type: 'object_delete', product_id: product.id, side_id: activeSideId });
    } else if (selected) {
      canvas?.remove(selected);
      canvas?.renderAll();
      incrementCanvasVersion();
      trackDesignAction({ action_type: 'object_delete', product_id: product.id, side_id: activeSideId });
    }
  };

  // ─── Background removal toggle ──────────────────────────────────
  const isBgRemovalRequested = selectedObject
    // @ts-expect-error - Custom data property
    ? !!selectedObject.data?.backgroundRemovalRequested
    : false;

  const toggleBgRemoval = () => {
    if (!selectedObject) return;
    const canvas = canvasMap[activeSideId];
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target) return;
    const newValue = !isBgRemovalRequested;
    const currentData = (target.get('data') as Record<string, unknown> | undefined) ?? {};
    target.set('data', {
      ...currentData,
      backgroundRemovalRequested: newValue,
    });
    setSelectedObject(target);
    if (newValue) setShowBgRemovalModal(true);
    incrementCanvasVersion();
    canvas.requestRenderAll();
  };

  // ─── Save to cart ────────────────────────────────────────────────
  const handleSaveToCart = async (
    designName: string,
    selectedItems: CartItem[],
    purchaseType: 'direct' | 'cart',
    /** 모달이 열린 시점의 단가 — freeze된 값. 누락 시 라이브 pricePerItem 사용. */
    frozenPricePerItem?: number,
  ) => {
    // 모달이 freeze한 단가를 우선 사용. 라이브 재계산으로 인한 모달↔카트 불일치 차단.
    const effectivePricePerItem = typeof frozenPricePerItem === 'number' && frozenPricePerItem > 0
      ? frozenPricePerItem
      : pricePerItem;
    // 단체몰에서 진입한 경우 단체몰의 색상/표시명/소속을 덮어쓴다.
    // (productColors 조회 결과보다 단체몰 메타가 우선)
    const mallProductTitle = partnerMallBuyData?.displayName || product.title;
    const partnerMallId = partnerMallBuyData?.partnerMallId ?? null;
    const checkoutCanvasMap = getLiveCanvasMap(canvasMap);
    const hasCheckoutCanvas = Object.keys(checkoutCanvasMap).length > 0;

    if (!isAuthenticated) {
      // Guest flow: save to cart store (localStorage) and navigate
      const canvasState = saveAllCanvasState();
      const thumbnail = hasCheckoutCanvas ? generateProductThumbnail(checkoutCanvasMap, 'front', 200, 200) : '';
      const previewImage = await buildProofImage(checkoutCanvasMap);
      const selectedColor = productColors.find(c => c.manufacturer_colors.hex === productColor);
      const colorName = partnerMallBuyData?.colorName || selectedColor?.manufacturer_colors.name || '색상';
      const colorCode = partnerMallBuyData?.colorCode || selectedColor?.manufacturer_colors.color_code;
      const customFonts = useFontStore.getState().customFonts;

      // Also save guest design as backup
      saveGuestDesign({ productId: product.id, productColor, canvasState, customFonts });

      // Generate a shared design ID so all sizes from this design are grouped together
      const guestDesignId = createGuestDesignId(product.id);

      for (const item of selectedItems) {
        addToCart({
          productId: product.id,
          productTitle: mallProductTitle,
          productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: effectivePricePerItem,
          canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: guestDesignId,
          designName,
          customFonts,
          previewImage,
          retouchRequested,
          partnerMallId,
        });
      }

      // Clear canvas
      Object.values(checkoutCanvasMap).forEach((canvas) => {
        const objectsToRemove = canvas.getObjects().filter(obj => {
          if (obj.excludeFromExport) return false;
          // @ts-expect-error - Checking custom data property
          if (obj.data?.id === 'background-product-image') return false;
          return true;
        });
        objectsToRemove.forEach(obj => canvas.remove(obj));
        canvas.requestRenderAll();
      });
      setProductColor('#FFFFFF');

      {
        const totalQuantity = selectedItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
        const totalValue = effectivePricePerItem * totalQuantity;
        const items = selectedItems.map((it) => ({
          item_id: product.id,
          item_name: product.title,
          item_brand: product.manufacturer_name ?? undefined,
          item_category: product.category ?? undefined,
          item_variant: it.size,
          price: effectivePricePerItem,
          quantity: it.quantity,
          design_id: guestDesignId,
          design_fee: pricingData.totalAdditionalPrice,
        }));
        if (purchaseType === 'direct') {
          trackBeginCheckout({ value: totalValue, items, design_id: guestDesignId });
        } else {
          trackAddToCart({ value: totalValue, items, design_id: guestDesignId });
        }
      }
      if (purchaseType === 'direct') {
        // Filter to only the just-added items so checkout doesn't show old cart items
        const currentItems = useCartStore.getState().items;
        const newItemIds = currentItems
          .filter(i => i.savedDesignId === guestDesignId)
          .map(i => i.id);
        sessionStorage.setItem('directCheckoutItemIds', JSON.stringify(newItemIds));
      } else {
        router.push('/cart');
      }
      return;
    }
    setIsSaving(true);
    try {
      const canvasState = saveAllCanvasState();
      const thumbnail = hasCheckoutCanvas ? generateProductThumbnail(checkoutCanvasMap, 'front', 200, 200) : '';
      const previewImage = await buildProofImage(checkoutCanvasMap);
      const selectedColor = productColors.find(c => c.manufacturer_colors.hex === productColor);
      const colorName = partnerMallBuyData?.colorName || selectedColor?.manufacturer_colors.name || '색상';
      const colorCode = partnerMallBuyData?.colorCode || selectedColor?.manufacturer_colors.color_code;
      const customFonts = useFontStore.getState().customFonts;

      let sharedDesignId: string | undefined;
      const newCartItemIds: string[] = [];

      for (const item of selectedItems) {
        const dbCartItem = await addToCartDB({
          productId: product.id,
          productTitle: mallProductTitle,
          productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: effectivePricePerItem,
          canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: sharedDesignId,
          designName,
          previewImage,
          customFonts,
          canvasMap: checkoutCanvasMap,
          retouchRequested,
          partnerMallId,
        });

        if (dbCartItem?.id) {
          newCartItemIds.push(dbCartItem.id);
        } else {
          console.error('addToCartDB returned no id:', dbCartItem);
        }

        if (!sharedDesignId && dbCartItem?.saved_design_id) {
          sharedDesignId = dbCartItem.saved_design_id;
        }

        addToCart({
          productId: product.id,
          productTitle: mallProductTitle,
          productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: effectivePricePerItem,
          canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: sharedDesignId,
          designName,
          customFonts,
          previewImage,
          retouchRequested,
          partnerMallId,
        });
      }

      // For direct purchase, store the item IDs so checkout only shows these items
      if (purchaseType === 'direct' && newCartItemIds.length > 0) {
        sessionStorage.setItem('directCheckoutItemIds', JSON.stringify(newCartItemIds));
      }

      {
        const totalQuantity = selectedItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
        const totalValue = effectivePricePerItem * totalQuantity;
        const items = selectedItems.map((it) => ({
          item_id: product.id,
          item_name: product.title,
          item_brand: product.manufacturer_name ?? undefined,
          item_category: product.category ?? undefined,
          item_variant: it.size,
          price: effectivePricePerItem,
          quantity: it.quantity,
          design_id: sharedDesignId,
          design_fee: pricingData.totalAdditionalPrice,
        }));
        if (purchaseType === 'direct') {
          trackBeginCheckout({ value: totalValue, items, design_id: sharedDesignId });
        } else {
          trackAddToCart({ value: totalValue, items, design_id: sharedDesignId });
        }
      }

      removeGuestDesign(product.id);

      // Clear canvas state
      Object.values(checkoutCanvasMap).forEach((canvas) => {
        const objectsToRemove = canvas.getObjects().filter(obj => {
          if (obj.excludeFromExport) return false;
          // @ts-expect-error - Checking custom data property
          if (obj.data?.id === 'background-product-image') return false;
          return true;
        });
        objectsToRemove.forEach(obj => canvas.remove(obj));
        canvas.requestRenderAll();
      });

      setProductColor('#FFFFFF');
    } catch (error) {
      console.error('Add to cart failed:', error);
      alert('장바구니 추가 중 오류가 발생했습니다.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Partner mall ────────────────────────────────────────────────
  const [partnerMallAddData, setPartnerMallAddData] = useState<{
    shareToken: string;
    mallName: string;
    logoUrl: string;
    displayName: string;
    manufacturerColorId: string | null;
    colorHex: string | null;
    colorName: string | null;
    colorCode: string | null;
    existingId?: string;
    canvasState?: Record<string, string>;
  } | null>(null);

  // ?partnerMallBuy=1 진입 시 사용. 단체몰의 기존 디자인을 에디터에 그대로 restore해서
  // 사용자가 그대로 또는 살짝 수정해서 주문할 수 있게 한다. 장바구니 insert 시
  // partnerMallId 가 함께 들어가 영업사원 자동 귀속이 유지된다.
  const [partnerMallBuyData, setPartnerMallBuyData] = useState<{
    shareToken: string;
    partnerMallId: string;
    displayName: string;
    colorHex: string | null;
    colorName: string | null;
    colorCode: string | null;
    /** 영업사원이 정한 진열 판매가(바닥값). null이면 base+인쇄가로 계산. */
    price: number | null;
    canvasState: Record<string, string>;
  } | null>(null);

  useEffect(() => {
    if (!partnerMallAdd) return;
    const loadPartnerMallAddData = async () => {
      const raw = sessionStorage.getItem('partnerMallAddData');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        setPartnerMallAddData(data);
        sessionStorage.removeItem('partnerMallAddData');

        const checkCanvasesReady = () => {
          const store = useCanvasStore.getState();
          return product.configuration.every(side => store.canvasMap[side.id] && store.imageLoadedMap[side.id]);
        };
        let attempts = 0;
        while (!checkCanvasesReady() && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!checkCanvasesReady()) return;

        if (data.colorHex) {
          setProductColor(data.colorHex);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (data.existingId && data.canvasState && Object.keys(data.canvasState).length > 0) {
          await restoreAllCanvasState(data.canvasState as Record<string, string>);
          incrementCanvasVersion();
        } else if (data.logoUrl) {
          const firstSide = product.configuration[0];
          if (!firstSide) return;
          const canvas = canvasMap[firstSide.id];
          if (!canvas) return;
          try {
            const logoImg = await fabric.FabricImage.fromURL(data.logoUrl, { crossOrigin: 'anonymous' });
            // @ts-expect-error - Custom property
            const printAreaLeft = canvas.printAreaLeft || 0;
            // @ts-expect-error - Custom property
            const printAreaTop = canvas.printAreaTop || 0;
            // @ts-expect-error - Custom property
            const scaledPrintW = canvas.printAreaWidth || firstSide.printArea.width;
            const canvasScale = scaledPrintW / firstSide.printArea.width;
            const centerX = firstSide.printArea.width / 2;
            const centerY = firstSide.printArea.height / 2;
            const maxWidth = firstSide.printArea.width * 0.2;
            const maxHeight = firstSide.printArea.height * 0.2;
            const logoScale = Math.min(
              maxWidth / (logoImg.width || 100),
              maxHeight / (logoImg.height || 100)
            );
            logoImg.set({
              left: printAreaLeft + centerX * canvasScale,
              top: printAreaTop + centerY * canvasScale,
              scaleX: logoScale * canvasScale,
              scaleY: logoScale * canvasScale,
              originX: 'center',
              originY: 'center',
              data: { id: 'partner-mall-logo' },
            });
            canvas.add(logoImg);
            canvas.setActiveObject(logoImg);
            canvas.renderAll();
            incrementCanvasVersion();
          } catch (err) {
            console.error('Failed to load mall logo:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load partner mall add data:', err);
      }
    };
    loadPartnerMallAddData();
  }, [partnerMallAdd, canvasMap, product.configuration, setProductColor, restoreAllCanvasState, incrementCanvasVersion]);

  useEffect(() => {
    if (!partnerMallBuy) return;
    const loadPartnerMallBuyData = async () => {
      const raw = sessionStorage.getItem('partnerMallBuyData');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        setPartnerMallBuyData(data);
        sessionStorage.removeItem('partnerMallBuyData');

        const checkCanvasesReady = () => {
          const store = useCanvasStore.getState();
          return product.configuration.every(side => store.canvasMap[side.id] && store.imageLoadedMap[side.id]);
        };
        let attempts = 0;
        while (!checkCanvasesReady() && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!checkCanvasesReady()) return;

        if (data.colorHex) {
          setProductColor(data.colorHex);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (data.canvasState && Object.keys(data.canvasState).length > 0) {
          await restoreAllCanvasState(data.canvasState as Record<string, string>);
          incrementCanvasVersion();
        }
      } catch (err) {
        console.error('Failed to load partner mall buy data:', err);
      }
    };
    loadPartnerMallBuyData();
  }, [partnerMallBuy, canvasMap, product.configuration, setProductColor, restoreAllCanvasState, incrementCanvasVersion]);

  const handleSaveToMall = async () => {
    if (!partnerMallAddData) return;
    setIsSavingToMall(true);
    try {
      const canvasState = saveAllCanvasState();
      const previewUrl = await buildProofImage(canvasMap);
      const customFonts = useFontStore.getState().customFonts;

      // Also persist as a saved_designs row so the design appears in admin's
      // 디자인 목록 with its actual preview, not the bare product mockup fallback.
      // Best-effort: failure here doesn't block partner-mall save.
      if (isAuthenticated) {
        try {
          await saveDesign({
            productId: product.id,
            title: partnerMallAddData.displayName || product.title,
            productColor,
            canvasState,
            previewImage: previewUrl,
            pricePerItem,
            canvasMap,
            customFonts,
          });
        } catch (err) {
          console.warn('saveDesign for partner-mall failed (non-fatal):', err);
        }
      }

      const isUpdate = !!partnerMallAddData.existingId;
      const response = await fetch(`/api/partner-mall/${partnerMallAddData.shareToken}/products`, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isUpdate ? { id: partnerMallAddData.existingId } : { product_id: product.id }),
          logo_placements: {},
          canvas_state: canvasState,
          preview_url: previewUrl,
          display_name: partnerMallAddData.displayName,
          manufacturer_color_id: partnerMallAddData.manufacturerColorId,
          color_hex: partnerMallAddData.colorHex,
          color_name: partnerMallAddData.colorName,
          color_code: partnerMallAddData.colorCode,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '저장에 실패했습니다.');
      }
      router.push(`/mall/${partnerMallAddData.shareToken}`);
    } catch (err) {
      console.error('Save to mall error:', err);
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSavingToMall(false);
    }
  };

  // ─── Effects ─────────────────────────────────────────────────────

  // Initialize pricing config
  useEffect(() => {
    if (allPrintMethods.length > 0) setPrintPricingConfig(allPrintMethods);
  }, [allPrintMethods]);

  // Fetch product colors
  useEffect(() => {
    const fetchColors = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('product_colors')
        .select(`
          id, product_id, manufacturer_color_id, is_active, sort_order,
          created_at, updated_at,
          manufacturer_colors (id, name, hex, color_code)
        `)
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch product colors:', error);
        return;
      }
      if (data && data.length > 0) {
        const colors = data.map((item) => ({
          ...item,
          manufacturer_colors: item.manufacturer_colors as unknown as ProductColor['manufacturer_colors'],
        })) as ProductColor[];
        colors.sort((a, b) => (a.manufacturer_colors?.color_code || '').localeCompare(b.manufacturer_colors?.color_code || ''));
        setProductColors(colors);
      }
    };
    fetchColors();
  }, [product.id]);

  // Set initial product color from first available color
  useEffect(() => {
    if (cartItemId || partnerMallAdd || partnerMallBuy) return;
    if (productColors.length > 0) {
      const first = productColors[0];
      setProductColor(first.manufacturer_colors.hex);
      setSelectedProductColor({
        id: first.id,
        sideMockups: (first.side_mockups ?? {}) as Record<string, string>,
      });
    }
  }, [productColors, cartItemId, partnerMallAdd, partnerMallBuy, setProductColor, setSelectedProductColor]);

  // ─── Quick-replace template auto-apply ──────────────────────────────
  // When editor is opened with ?templateId=..., load the template and apply
  // it to the canvas as soon as canvases (and product images) are ready.
  // QuickReplacePanel mounts only when image_slots/text_slots are non-empty;
  // legacy templates fall back to the regular editor experience with a hint.

  // Force-skip landing when ?templateId is added on the same route (e.g. user
  // taps a template card in LandingStep — router.push only updates URL, the
  // useState initializer doesn't re-run, so we explicitly switch the step).
  useEffect(() => {
    if (templateIdParam && currentStep === 'landing') {
      queueMicrotask(() => {
        setCurrentStep('editor');
        setEditMode(false);
        setTemplateApplyAttempted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateIdParam]);

  useEffect(() => {
    if (!templateIdParam || templateApplyAttempted) return;
    let cancelled = false;
    (async () => {
      const template = await getTemplate(templateIdParam);
      if (!template || cancelled) {
        setTemplateApplyAttempted(true);
        return;
      }
      // Wait for all canvases to be mounted with their product images.
      const checkReady = () => {
        const store = useCanvasStore.getState();
        return product.configuration.every(
          (side) => store.canvasMap[side.id] && store.imageLoadedMap[side.id],
        );
      };
      let attempts = 0;
      while (!checkReady() && attempts < 80) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (cancelled) return;

      // Group-bound template? Compose from group.design_composition + template.placement_map
      let group: TemplateGroup | null = null;
      if (template.template_group_id) {
        group = await getGroup(template.template_group_id);
      }

      try {
        if (group && (group.design_composition?.slots?.length ?? 0) > 0) {
          await applyGroupTemplateToStore(template, group, product);
        } else {
          // Legacy single template — restore canvas_state directly
          await applyTemplateToStore(template);
        }
        trackDesignAction({ action_type: 'template_quick_apply', product_id: product.id });
      } catch (err) {
        console.error('Failed to apply template from URL:', err);
      }

      // Quick-replace panel decision:
      //  - group + composition slots → quick replace mode
      //  - legacy + image_slots/text_slots → quick replace mode
      //  - otherwise (legacy w/ no slots) → fall back to full editor
      const hasGroupSlots = (group?.design_composition?.slots?.length ?? 0) > 0;
      const hasLegacySlots =
        (template.image_slots?.length ?? 0) > 0 || (template.text_slots?.length ?? 0) > 0;

      if (hasGroupSlots || hasLegacySlots) {
        setQuickReplaceTemplate(template);
        setQuickReplaceGroup(group);
        setEditMode(false);
      } else {
        setEditMode(true);
        if (typeof window !== 'undefined') {
          console.info('[template] legacy template (no slots) — full editor active');
        }
      }
      setTemplateApplyAttempted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateIdParam, templateApplyAttempted, product, product.id, product.configuration, setEditMode]);

  // Load cart item design
  useEffect(() => {
    const loadCartItemDesign = async () => {
      if (!cartItemId) return;
      const cartItem = cartStoreItems.find(item => item.id === cartItemId);
      if (!cartItem) { console.error('Cart item not found:', cartItemId); return; }
      setIsLoadingCartItem(true);
      try {
        const checkCanvasesReady = () => {
          const store = useCanvasStore.getState();
          return product.configuration.every(side => store.canvasMap[side.id] && store.imageLoadedMap[side.id]);
        };
        let attempts = 0;
        while (!checkCanvasesReady() && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!checkCanvasesReady()) { console.error('Canvases not ready after timeout'); return; }
        // Load custom fonts before restoring canvas state
        if (cartItem.customFonts && cartItem.customFonts.length > 0) {
          const fontStore = useFontStore.getState();
          fontStore.setCustomFonts(cartItem.customFonts);
          await fontStore.loadAllFonts();
        }
        if (cartItem.productColor) setProductColor(cartItem.productColor);
        await new Promise(resolve => setTimeout(resolve, 100));
        await restoreAllCanvasState(cartItem.canvasState);
        incrementCanvasVersion();
      } catch (error) {
        console.error('Failed to load cart item design:', error);
      } finally {
        setIsLoadingCartItem(false);
      }
    };
    loadCartItemDesign();
  }, [cartItemId, cartStoreItems, canvasMap, product.configuration, restoreAllCanvasState, setProductColor, incrementCanvasVersion]);

  // Guest design recall
  useEffect(() => {
    if (cartItemId || partnerMallAdd || partnerMallBuy) return;
    const saved = getGuestDesign(product.id);
    if (!saved) return;
    queueMicrotask(() => {
      setGuestDesign(saved);
      setIsRecallGuestDesignOpen(true);
    });
  }, [cartItemId, partnerMallAdd, partnerMallBuy, product.id]);

  // 비회원 저장 디자인 실제 복원.
  // handleBeginRecall이 recallRequested=true + editor 전환을 트리거하면, 이 effect는 editor 단계의
  // 캔버스(리마운트 후 최종 인스턴스)가 준비될 때까지 기다렸다가 그 캔버스에 복원한다.
  // 이 effect는 커밋 이후 실행되므로 landing 캔버스는 이미 unregister된 상태 → stale 캔버스 복원 레이스 방지.
  useEffect(() => {
    if (!recallRequested || currentStep !== 'editor') return;
    let cancelled = false;
    (async () => {
      const checkCanvasesReady = () => {
        const store = useCanvasStore.getState();
        return product.configuration.every(
          (side) => store.canvasMap[side.id] && store.imageLoadedMap[side.id]
        );
      };
      let attempts = 0;
      while (!checkCanvasesReady() && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
      if (cancelled) return;
      const design = guestDesign;
      if (!design || !checkCanvasesReady()) {
        setRecallRequested(false);
        setIsRecallGuestDesignOpen(false);
        return;
      }
      // Load custom fonts before restoring canvas state
      if (design.customFonts && design.customFonts.length > 0) {
        const fontStore = useFontStore.getState();
        fontStore.setCustomFonts(design.customFonts);
        await fontStore.loadAllFonts();
      }
      if (cancelled) return;
      setProductColor(design.productColor);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (cancelled) return;
      await restoreAllCanvasState(design.canvasState);
      incrementCanvasVersion();
      setRecallRequested(false);
      setIsRecallGuestDesignOpen(false);
      trackDesignResume({ product_id: product.id });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    recallRequested,
    currentStep,
    guestDesign,
    product.configuration,
    product.id,
    setProductColor,
    restoreAllCanvasState,
    incrementCanvasVersion,
  ]);

  // Set active side on mount
  useEffect(() => {
    if (product.configuration.length > 0) {
      setActiveSide(product.configuration[0].id);
    }
  }, [setActiveSide, product.configuration]);

  // Set edit mode for special modes and editor step
  useEffect(() => {
    if (isSpecialMode) {
      setEditMode(true);
    }
    return () => setEditMode(false);
  }, [isSpecialMode, setEditMode]);

  // Clean up canvas state on unmount (prevents ghost designs across products)
  useEffect(() => {
    return () => {
      resetCanvasState();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 비로그인 자동저장 ────────────────────────────────────────────
  // 디자인 작업 중간에 페이지 떠나거나 뒤로가기 해도 localStorage에 마지막
  // 상태를 보존해서 GuestDesignRecallModal로 복원 가능하도록.
  //
  // 트리거: canvasVersion 변경(객체 추가/이동/삭제·색상·인쇄방식 등) → 1초 debounce 후 저장
  // 강제 flush: visibilitychange→hidden, beforeunload, unmount cleanup
  //
  // 로그인 사용자는 카트/디자인 DB를 쓰므로 자동저장 X (기존 정책).
  // 카트/단체몰/템플릿 진입(isSpecialMode)도 그쪽 흐름이 별도 관리하므로 제외.
  const autosaverRef = useRef<ReturnType<typeof createGuestDesignAutosaver> | null>(null);
  useEffect(() => {
    if (isAuthenticated || isSpecialMode) {
      // 자동저장 비대상. 이전에 만들어진 autosaver는 정리만.
      autosaverRef.current?.cancel();
      autosaverRef.current = null;
      return;
    }

    if (!autosaverRef.current) {
      autosaverRef.current = createGuestDesignAutosaver(1000);
    }
    const saver = autosaverRef.current;

    // 디자인이 비어 있는 초기 상태에서는 저장 skip (사용자 흔적 0).
    const hasAnyUserObject = product.configuration.some((side) => {
      const c = canvasMap[side.id];
      if (!c) return false;
      return c.getObjects().some((obj) => {
        if (obj.excludeFromExport) return false;
        const d = obj.get('data') as { id?: string } | undefined;
        return d?.id !== 'background-product-image' && d?.id !== 'center-line';
      });
    });

    if (!hasAnyUserObject) {
      // 객체 없으면 이전에 잡혀있는 저장만 cancel (사용자가 모든 객체 삭제한 케이스)
      saver.cancel();
      return;
    }

    saver.schedule(() => {
      try {
        const canvasState = saveAllCanvasState();
        if (!canvasState || Object.keys(canvasState).length === 0) return null;
        return {
          productId: product.id,
          productColor,
          canvasState,
          customFonts: useFontStore.getState().customFonts,
        };
      } catch {
        return null;
      }
    });
  }, [canvasVersion, productColor, isAuthenticated, isSpecialMode, product.id, product.configuration, canvasMap, saveAllCanvasState]);

  // 페이지 떠남 직전 즉시 flush. visibilitychange가 brower back/탭전환/앱전환을
  // 가장 광범위하게 잡고, beforeunload는 새로고침·창닫기 백업.
  useEffect(() => {
    if (isAuthenticated || isSpecialMode) return;

    const flushNow = () => {
      autosaverRef.current?.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };

    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      // 컴포넌트 unmount 시점에도 한 번 더 flush (라우터 navigation 케이스 대비)
      flushNow();
    };
  }, [isAuthenticated, isSpecialMode]);

  // GTM: view_item + editor_open (mount once, StrictMode-safe)
  const gtmMountedRef = useRef(false);
  useEffect(() => {
    if (gtmMountedRef.current) return;
    gtmMountedRef.current = true;
    trackViewItem({
      product_id: product.id,
      product_name: product.title,
      brand: product.manufacturer_name ?? undefined,
      category: product.category ?? undefined,
      base_price: product.base_price,
    });
    trackEditorOpen({ product_id: product.id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile: scroll lock when in editor step
  useEffect(() => {
    if (isMobile && currentStep === 'editor') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isMobile, currentStep]);

  // Listen for canvas selection changes (both mobile and desktop)
  useEffect(() => {
    const activeCanvas = canvasMap[activeSideId];
    if (!activeCanvas) return;

    const handleSelectionCreated = (e: CanvasSelectionEvent) => {
      const selected = e.selected?.[0];
      if (selected) setSelectedObject(selected);
    };
    const handleSelectionUpdated = (e: CanvasSelectionEvent) => {
      setSelectedObject(e.selected?.[0] || null);
    };
    const handleSelectionCleared = () => setSelectedObject(null);

    activeCanvas.on('selection:created', handleSelectionCreated);
    activeCanvas.on('selection:updated', handleSelectionUpdated);
    activeCanvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      activeCanvas.off('selection:created', handleSelectionCreated);
      activeCanvas.off('selection:updated', handleSelectionUpdated);
      activeCanvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [activeSideId, canvasMap]);

  // Pricing
  const [pricingData, setPricingData] = useState<PricingSummary>({
    totalAdditionalPrice: 0,
    sidePricing: [],
    totalObjectCount: 0,
  });

  useEffect(() => {
    const calculatePricing = async () => {
      const pricing = await calculateAllSidesPricing(canvasMap, product.configuration);
      setPricingData(pricing);
    };
    calculatePricing();
  }, [canvasMap, product.configuration, canvasVersion]);

  // 라이브 계산 가격 (캔버스 변화에 따라 실시간 갱신)
  const livePricePerItem = product.base_price + pricingData.totalAdditionalPrice;
  // 재편집 저장은 현재 캔버스 기준 단가를 사용한다.
  // 옛 장바구니 단가를 계속 쓰면 디자인과 금액이 다시 어긋날 수 있다.
  // 단체몰 진열 구매: 영업사원이 정한 판매가를 단가의 바닥값으로 반영(마진 보존).
  // 고객이 더 비싼 디자인을 추가하면 그쪽(base+인쇄가)이 높아져 자동 상향 — 언더차지 방지.
  const mallBuyFloorPrice =
    partnerMallBuy && partnerMallBuyData?.price && partnerMallBuyData.price > 0
      ? partnerMallBuyData.price
      : null;
  const pricePerItem = mallBuyFloorPrice !== null
    ? Math.max(mallBuyFloorPrice, livePricePerItem)
    : livePricePerItem;
  const formattedPrice = product.base_price.toLocaleString('ko-KR');

  // ─── Render ──────────────────────────────────────────────────────

  // Landing step
  if (currentStep === 'landing') {
    return (
      <div>
        <div className="w-full sticky top-0 bg-gray-300 z-50">
          <Header back={true} />
        </div>
        <LandingStep
          product={product}
          allPrintMethods={allPrintMethods}
          enabledPrintMethodIds={enabledPrintMethodIds}
          onNext={goToEditor}
        />
        {/* Canvas mounted but hidden to preserve state */}
        <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
          <ProductDesigner config={productConfig} layout={isMobile ? 'mobile' : 'desktop'} />
        </div>
        <LoginPromptModal
          isOpen={isLoginPromptOpen}
          onClose={() => setIsLoginPromptOpen(false)}
          title="로그인이 필요합니다"
          message="구매를 진행하려면 로그인이 필요합니다. 디자인을 임시 저장해두었습니다."
        />
        <GuestDesignRecallModal
          isOpen={isRecallGuestDesignOpen}
          onRecall={handleBeginRecall}
          onDiscard={() => {
            removeGuestDesign(product.id);
            setGuestDesign(null);
            setIsRecallGuestDesignOpen(false);
            trackDesignDiscard({ product_id: product.id });
          }}
        />
      </div>
    );
  }

  // Check if product has any color options (for showing the color button)
  const hasAnyColorOptions = (() => {
    const firstSide = product.configuration[0];
    const hasLayers = firstSide?.layers && firstSide.layers.length > 0;
    const hasColorOptions = firstSide?.colorOptions && firstSide.colorOptions.length > 0;
    return hasLayers || hasColorOptions || productColors.length > 0;
  })();

  // Get current display color for the color button
  const getDisplayColor = (): string => {
    const { layerColors } = useCanvasStore.getState();
    const firstSide = product.configuration[0];
    if (!firstSide) return productColor || '#FFFFFF';

    // Check layer colors first
    const sideColors = layerColors[firstSide.id];
    if (sideColors) {
      const bodyKeywords = ['몸통', 'body', '바디'];
      if (firstSide.layers && firstSide.layers.length > 0) {
        const bodyLayer = firstSide.layers.find(l =>
          bodyKeywords.some(kw => l.name.toLowerCase().includes(kw))
        ) || firstSide.layers[0];
        if (sideColors[bodyLayer.id]) return sideColors[bodyLayer.id];
      }
      if (sideColors[firstSide.id]) return sideColors[firstSide.id];
    }

    // 칩은 캔버스에 실제 적용된 색을 그대로 비춘다. productColor 기본값은 #FFFFFF(흰색 무지)
    // 이며, 흰색일 때 팔레트 첫 항목(검정)으로 폴백하면 흰 의류에 검정 칩이 뜨는 불일치가 생긴다.
    return productColor || '#FFFFFF';
  };

  const displayColor = getDisplayColor();

  // Editor step (and quantity modal)
  if (isMobile) {
    const goBackToLanding = () => {
      setCurrentStep('landing');
      setEditMode(false);
    };

    return (
      <div>
        {/* Full-screen canvas with toolbar */}
        <ProductDesigner
          config={productConfig}
          layout="mobile"
          onExitEditMode={goBackToLanding}
          onColorPress={() => setIsColorModalOpen(true)}
          displayColor={displayColor}
          hasColorOptions={hasAnyColorOptions}
        />

        {/* Quick replace panel — overrides bottom bar when active */}
        {quickReplaceTemplate && (
          <QuickReplacePanel
            template={quickReplaceTemplate}
            group={quickReplaceGroup}
            product={product}
            onProceed={handleEditorDone}
            onAdvancedEdit={() => { setQuickReplaceTemplate(null); setEditMode(true); }}
            onOpenColorModal={() => setIsColorModalOpen(true)}
            formattedPrice={`${pricePerItem.toLocaleString('ko-KR')}원`}
          />
        )}

        {/* Bottom bar (hidden in quick-replace mode) */}
        {!quickReplaceTemplate && (
        <div ref={mobileBottomBarRef} className="w-full fixed left-0 bottom-0 bg-white pb-6 pt-3 px-4 shadow-2xl shadow-black z-20">
          {/* Background removal checkbox - shown when image object is selected */}
          {selectedObject && selectedObject.type === 'image' && (
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${isBgRemovalRequested ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                {isBgRemovalRequested && <Check className="w-3 h-3 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={isBgRemovalRequested} onChange={toggleBgRemoval} />
              <span className="text-xs text-gray-700">배경제거 요청</span>
              <button type="button" onClick={(e) => { e.preventDefault(); setShowBgRemovalModal(true); }} className="p-0.5">
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </label>
          )}
          {/* Retouch request checkbox */}
          {!partnerMallAddData && (
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${retouchRequested ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                {retouchRequested && <Check className="w-3 h-3 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={retouchRequested} onChange={() => { const newVal = !retouchRequested; setRetouchRequested(newVal); if (newVal) setShowRetouchModal(true); }} />
              <span className="text-xs text-gray-700">담당자 리터치 요청</span>
              <button type="button" onClick={(e) => { e.preventDefault(); setShowRetouchModal(true); }} className="p-0.5 py-2">
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </label>
          )}
          <div className="flex items-center gap-2">
            {partnerMallAddData ? (
              <button
                onClick={handleSaveToMall}
                disabled={isSavingToMall}
                className="w-full bg-black py-3 text-sm rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isSavingToMall ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />저장 중...</>
                ) : '몰에 저장'}
              </button>
            ) : (
              <button
                onClick={handleEditorDone}
                disabled={isSaving}
                className="w-full bg-black py-3 text-sm rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {isSaving ? '처리 중...' : '완료'}
              </button>
            )}
          </div>
        </div>
        )}

        {/* Product info below canvas - scrollable */}
        <div className="pb-24">
          <div className="px-4">
            <ReviewsSection productId={product.id} limit={10} />
          </div>
          <div className="px-4">
            <DescriptionImageSection title="주문상세" imageUrls={product.description_image ?? null} />
          </div>
          {product.sizing_data ? (
            <div className="px-4 mt-4">
              <SizeChartTable variant="inline" sizingData={product.sizing_data} sizingChartImage={product.sizing_chart_image} />
            </div>
          ) : product.sizing_chart_image ? (
            <div className="px-4">
              <DescriptionImageSection
                title="사이즈 차트"
                imageUrls={[product.sizing_chart_image]}
                disableCollapse
              />
            </div>
          ) : null}
        </div>

        <QuantitySelectorModal
          isOpen={isQuantitySelectorOpen}
          onClose={() => { setIsQuantitySelectorOpen(false); setCurrentStep('editor'); }}
          onConfirm={handleSaveToCart}
          sizeOptions={product.size_options || []}
          pricePerItem={pricePerItem}
          isSaving={isSaving}
          sizingChartImage={product.sizing_chart_image}
          sizingData={product.sizing_data}
          productId={product.id}
          directPurchaseOnly={Boolean(partnerMallBuyData)}
        />

        {/* Layers × PrintMethod 패널 (?layers-lab=1, mobile). FAB는 Toolbar 하단 툴 독으로 이동. */}
        {layersLabEnabled && (
          <LayersPrintPanel
            isOpen={layersPanelOpen}
            onClose={() => setLayersPanelOpen(false)}
            sides={product.configuration}
          />
        )}

        <LoginPromptModal
          isOpen={isLoginPromptOpen}
          onClose={() => setIsLoginPromptOpen(false)}
          title="로그인이 필요합니다"
          message="구매를 진행하려면 로그인이 필요합니다. 디자인을 임시 저장해두었습니다."
        />

        <ColorSelectorModal
          isOpen={isColorModalOpen}
          onClose={() => setIsColorModalOpen(false)}
          side={product.configuration[0]}
          productColors={productColors}
        />

        {/* Retouch info modal */}
        {showRetouchModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRetouchModal(false)}>
            <div className="bg-white rounded-lg p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">담당자 리터치 요청</h3>
              <p className="text-sm text-gray-600">체크하시면 담당자가 자주 사용되는 위치로 변경하여 작업을 진행해드립니다.</p>
              <button onClick={() => setShowRetouchModal(false)} className="mt-4 w-full py-2 bg-black text-white text-sm rounded-lg">확인</button>
            </div>
          </div>
        )}

        {/* Background removal info modal */}
        {showBgRemovalModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBgRemovalModal(false)}>
            <div className="bg-white rounded-lg p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">배경제거 요청</h3>
              <p className="text-sm text-gray-600">체크하시면 담당자가 배경 제거 후 안내드립니다.</p>
              <button onClick={() => setShowBgRemovalModal(false)} className="mt-4 w-full py-2 bg-black text-white text-sm rounded-lg">확인</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop editor step
  return (
    <div className="min-h-screen bg-white text-black">
      {quickReplaceTemplate && (
        <QuickReplacePanel
          template={quickReplaceTemplate}
          group={quickReplaceGroup}
          product={product}
          onProceed={handleEditorDone}
          onAdvancedEdit={() => { setQuickReplaceTemplate(null); setEditMode(true); }}
          onOpenColorModal={() => setIsColorModalOpen(true)}
          formattedPrice={`${pricePerItem.toLocaleString('ko-KR')}원`}
        />
      )}
      <div className="w-full sticky top-0 bg-white/95 backdrop-blur z-40">
        <Header back={true} />
      </div>

      <div className="max-w-360 mx-auto px-6 py-4">
        <div className="flex gap-4 h-175">
          {/* Side Thumbnails */}
          {product.configuration.length > 1 && (
            <div className="flex flex-col gap-2 w-16 shrink-0">
              {product.configuration.map(side => (
                <button
                  key={side.id}
                  onClick={() => {
                    setActiveSide(side.id);
                    trackDesignAction({ action_type: 'face_change', product_id: product.id, side_id: side.id });
                  }}
                  className={`rounded-lg overflow-hidden border-2 transition-all ${
                    activeSideId === side.id
                      ? 'border-black'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {side.imageUrl ? (
                    <img
                      src={side.imageUrl}
                      alt={side.name}
                      className="w-full aspect-square object-contain bg-gray-50 p-1"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 flex items-center justify-center text-[10px] text-gray-400">
                      {side.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 relative min-w-0">
            <div className="rounded-lg h-full overflow-hidden">
              <ProductDesigner config={productConfig} layout="desktop" />
            </div>

            {/* Layer Controls */}
            {selectedObject && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-700 mr-1">레이어 조정:</span>
                <button onClick={bringToFront} className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition" title="맨 앞으로">
                  <ChevronsUp className="size-4 text-gray-700" />
                </button>
                <button onClick={bringForward} className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition" title="앞으로">
                  <ArrowUp className="size-4 text-gray-700" />
                </button>
                <button onClick={sendBackward} className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition" title="뒤로">
                  <ArrowDown className="size-4 text-gray-700" />
                </button>
                <button onClick={sendToBack} className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition" title="맨 뒤로">
                  <ChevronsDown className="size-4 text-gray-700" />
                </button>
                <div className="h-6 w-px bg-gray-300 mx-1" />
                <button onClick={handleDeleteObject} className="p-2 rounded-full border border-red-200 bg-white hover:bg-red-50 transition" title="삭제">
                  <Trash2 className="size-4 text-red-600" />
                </button>
                {/* Background removal checkbox - image objects only */}
                {selectedObject.type === 'image' && (
                  <>
                    <div className="h-6 w-px bg-gray-300 mx-1" />
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${isBgRemovalRequested ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                        {isBgRemovalRequested && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <input type="checkbox" className="hidden" checked={isBgRemovalRequested} onChange={toggleBgRemoval} />
                      <span className="text-xs text-gray-700">배경제거</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); setShowBgRemovalModal(true); }} className="p-0.5">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </label>
                  </>
                )}
              </div>
            )}

            {/* Desktop Toolbar */}
            <div className="absolute bottom-6 right-4 z-10">
              <DesktopToolbar sides={productConfig.sides} productId={productConfig.productId} />
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="w-80 shrink-0 border border-gray-200 rounded-lg h-full overflow-hidden flex flex-col bg-white">
            {selectedObject && (selectedObject.type === 'i-text' || selectedObject.type === 'text' || isCurvedText(selectedObject)) ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">텍스트 편집</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const activeCanvas = canvasMap[activeSideId];
                        if (activeCanvas && selectedObject) {
                          activeCanvas.remove(selectedObject);
                          activeCanvas.requestRenderAll();
                          setSelectedObject(null);
                        }
                      }}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 className="size-5" />
                    </button>
                    <button
                      onClick={() => {
                        const activeCanvas = canvasMap[activeSideId];
                        if (activeCanvas) {
                          activeCanvas.discardActiveObject();
                          activeCanvas.requestRenderAll();
                        }
                        setSelectedObject(null);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                      title="닫기"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <TextStylePanel selectedObject={selectedObject as fabric.IText | fabric.Text} layout="sidebar" />
                </div>
              </>
            ) : anchorPanelOpen ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <MapPin className="size-4 text-gray-500" />
                    자주 쓰는 위치
                  </h3>
                  <button
                    onClick={() => setAnchorPanelOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                    title="닫기"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <AnchorPresetPanel
                    open
                    variant="sidebar"
                    anchors={sideAnchorsForPanel}
                    hasSelectedArtwork={!!selectedObject}
                    onPick={handlePickAnchorSidebar}
                    onHoverAnchor={(a) => setHoveredAnchorId(a?.id ?? null)}
                    onClose={() => setAnchorPanelOpen(false)}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Product Info */}
                <div className="p-4 pb-2">
                  {product.manufacturer_name && (
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{product.manufacturer_name}</p>
                  )}
                  <h2 className="text-sm font-bold text-gray-900 leading-snug mt-1">{product.title}</h2>
                  {product.keywords && product.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Color Swatches */}
                <div className="px-4 pb-3">
                  {(() => {
                    const currentSide = product.configuration.find(side => side.id === activeSideId);
                    const hasLayers = currentSide?.layers && currentSide.layers.length > 0;
                    return hasLayers || (currentSide?.colorOptions && currentSide.colorOptions.length > 0) ? (
                      <LayerColorSelector side={currentSide!} />
                    ) : (
                      productColors.length > 0 && (
                        <div>
                          <div className="flex flex-wrap gap-1.5">
                            {productColors.map((color) => (
                              <button
                                key={color.id}
                                onClick={() => handleColorChange(color.manufacturer_colors.hex)}
                                className={`w-8 h-8 rounded-lg border-2 transition ${
                                  productColor === color.manufacturer_colors.hex
                                    ? 'border-black scale-110'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color.manufacturer_colors.hex }}
                                title={color.manufacturer_colors.name}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    );
                  })()}
                </div>

                {/* Price Display */}
                <div className="px-4 py-3 border-t border-gray-100">
                  <p className="text-xl font-bold text-gray-900">{pricePerItem.toLocaleString('ko-KR')}원</p>
                  {pricingData.totalAdditionalPrice > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      기본가 {formattedPrice}원 + 디자인 {pricingData.totalAdditionalPrice.toLocaleString('ko-KR')}원
                    </p>
                  )}
                </div>

                {/* Action Button */}
                <div className="p-4 border-t border-gray-200">
                  {/* Retouch request checkbox */}
                  {!partnerMallAddData && (
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${retouchRequested ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                        {retouchRequested && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input type="checkbox" className="hidden" checked={retouchRequested} onChange={() => { const newVal = !retouchRequested; setRetouchRequested(newVal); if (newVal) setShowRetouchModal(true); }} />
                      <span className="text-xs text-gray-700">담당자 리터치 요청</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); setShowRetouchModal(true); }} className="p-0.5">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </label>
                  )}
                  {partnerMallAddData ? (
                    <button
                      onClick={handleSaveToMall}
                      disabled={isSavingToMall}
                      className="w-full bg-black py-3.5 text-sm font-medium rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      {isSavingToMall ? (<><Loader2 className="w-4 h-4 animate-spin" />저장 중...</>) : '몰에 저장'}
                    </button>
                  ) : (
                    <button
                      onClick={handleEditorDone}
                      disabled={isSaving}
                      className="w-full bg-black py-3.5 text-sm font-medium rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                    >
                      {isSaving ? '처리 중...' : '완료'}
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {/* Product info below editor */}
      <div className="max-w-360 mx-auto px-6 mt-6 pb-12">
        <ReviewsSection productId={product.id} limit={10} />
        <DescriptionImageSection title="주문상세" imageUrls={product.description_image ?? null} />
        {product.sizing_data ? (
          <div className="mt-4">
            <SizeChartTable variant="inline" sizingData={product.sizing_data} sizingChartImage={product.sizing_chart_image} />
          </div>
        ) : product.sizing_chart_image ? (
          <DescriptionImageSection
            title="사이즈 차트"
            imageUrls={[product.sizing_chart_image]}
            disableCollapse
          />
        ) : null}
      </div>

      <QuantitySelectorModal
        isOpen={isQuantitySelectorOpen}
        onClose={() => { setIsQuantitySelectorOpen(false); setCurrentStep('editor'); }}
        onConfirm={handleSaveToCart}
        sizeOptions={product.size_options || []}
        pricePerItem={pricePerItem}
        isSaving={isSaving}
        sizingChartImage={product.sizing_chart_image}
        sizingData={product.sizing_data}
        productId={product.id}
        directPurchaseOnly={Boolean(partnerMallBuyData)}
      />

      {/* 실험 — Layers × PrintMethod 패널 (?layers-lab=1 쿼리 게이트). prod URL엔 안 붙음. */}
      {layersLabEnabled && (
        <>
          <button
            onClick={() => setLayersPanelOpen(true)}
            className="fixed bottom-4 right-4 z-40 bg-brand hover:bg-brand-deep text-white rounded-full shadow-lg p-3 flex items-center gap-2 transition"
            aria-label="레이어 & 인쇄방식 패널 열기"
          >
            <LayersIcon className="w-5 h-5" />
            <span className="text-sm font-semibold pr-1">레이어 & 인쇄</span>
          </button>
          <LayersPrintPanel
            isOpen={layersPanelOpen}
            onClose={() => setLayersPanelOpen(false)}
            sides={product.configuration}
          />
        </>
      )}

      <LoginPromptModal
        isOpen={isLoginPromptOpen}
        onClose={() => setIsLoginPromptOpen(false)}
        title="로그인이 필요합니다"
        message="구매를 진행하려면 로그인이 필요합니다. 디자인을 임시 저장해두었습니다."
      />

      <GuestDesignRecallModal
        isOpen={isRecallGuestDesignOpen}
        onRecall={handleBeginRecall}
        onDiscard={() => {
          removeGuestDesign(product.id);
          setGuestDesign(null);
          setIsRecallGuestDesignOpen(false);
          trackDesignDiscard({ product_id: product.id });
        }}
      />

      {/* Retouch info modal */}
      {showRetouchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRetouchModal(false)}>
          <div className="bg-white rounded-lg p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">담당자 리터치 요청</h3>
            <p className="text-sm text-gray-600">체크하시면 담당자가 자주 사용되는 위치로 변경하여 작업을 진행해드립니다.</p>
            <button onClick={() => setShowRetouchModal(false)} className="mt-4 w-full py-2 bg-black text-white text-sm rounded-lg">확인</button>
          </div>
        </div>
      )}

      {/* Background removal info modal */}
      {showBgRemovalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBgRemovalModal(false)}>
          <div className="bg-white rounded-lg p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">배경제거 요청</h3>
            <p className="text-sm text-gray-600">체크하시면 담당자가 배경 제거 후 안내드립니다.</p>
            <button onClick={() => setShowBgRemovalModal(false)} className="mt-4 w-full py-2 bg-black text-white text-sm rounded-lg">확인</button>
          </div>
        </div>
      )}
    </div>
  );
}
