'use client'
import ProductDesigner from "@/app/components/canvas/ProductDesigner";
import PricingInfo from "@/app/components/canvas/PricingInfo";
import LayerColorSelector from "@/app/components/canvas/LayerColorSelector";
import DesktopToolbar from "@/app/components/canvas/DesktopToolbar";
import { Product, ProductConfig, CartItem, ProductColor, PrintMethodRecord } from "@/types/types";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useCartStore } from "@/store/useCartStore";
import { useFontStore } from "@/store/useFontStore";
import Header from "@/app/components/Header";
import { X, Trash2, ChevronsUp, ArrowUp, ArrowDown, ChevronsDown, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import * as fabric from 'fabric';
import { isCurvedText } from '@/lib/curvedText';
import TextStylePanel from '@/app/components/canvas/TextStylePanel';
import { calculateAllSidesPricing, type PricingSummary } from "@/app/utils/canvasPricing";
import { saveDesign } from "@/lib/designService";
import { addToCartDB } from "@/lib/cartService";
import { generateProductThumbnail } from "@/lib/thumbnailGenerator";
import QuantitySelectorModal from "@/app/components/QuantitySelectorModal";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useAuthStore } from "@/store/useAuthStore";
import LoginPromptModal from "@/app/components/LoginPromptModal";
import GuestDesignRecallModal from "@/app/components/GuestDesignRecallModal";
import { getGuestDesign, removeGuestDesign, saveGuestDesign, type GuestDesign } from "@/lib/guestDesignStorage";
import { setPrintPricingConfig } from "@/lib/printPricingConfig";
import LandingStep from "./steps/LandingStep";
import ColorSelectorModal from "@/app/components/canvas/ColorSelectorModal";

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
  const isSpecialMode = !!cartItemId || !!partnerMallAdd;

  const [currentStep, setCurrentStep] = useState<EditorStep>(
    isSpecialMode ? 'editor' : 'landing'
  );

  const {
    setEditMode,
    setActiveSide,
    productColor,
    setProductColor,
    saveAllCanvasState,
    restoreAllCanvasState,
    canvasMap,
    canvasVersion,
    incrementCanvasVersion,
    activeSideId,
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
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [isSavingToMall, setIsSavingToMall] = useState(false);

  const productConfig: ProductConfig = {
    productId: product.id,
    sides: product.configuration,
  };

  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  // ─── Step transitions ────────────────────────────────────────────
  const goToEditor = () => {
    setCurrentStep('editor');
    setEditMode(true);
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
  };

  // ─── Color change ────────────────────────────────────────────────
  const handleColorChange = (color: string) => {
    setProductColor(color);
  };

  // ─── Desktop layer manipulation ──────────────────────────────────
  const bringToFront = () => {
    const canvas = canvasMap[activeSideId];
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.renderAll();
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
      }
    }
  };

  const bringForward = () => {
    const canvas = canvasMap[activeSideId];
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.renderAll();
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
    } else if (selected) {
      canvas?.remove(selected);
      canvas?.renderAll();
      incrementCanvasVersion();
    }
  };

  // ─── Save to cart ────────────────────────────────────────────────
  const handleSaveToCart = async (designName: string, selectedItems: CartItem[], purchaseType: 'direct' | 'cart') => {
    if (!isAuthenticated) {
      // Guest flow: save to cart store (localStorage) and navigate
      const canvasState = saveAllCanvasState();
      const thumbnail = generateProductThumbnail(canvasMap, 'front', 200, 200);
      const previewImage = generateProductThumbnail(canvasMap, 'front', 800, 800);
      const selectedColor = productColors.find(c => c.manufacturer_colors.hex === productColor);
      const colorName = selectedColor?.manufacturer_colors.name || '색상';
      const colorCode = selectedColor?.manufacturer_colors.color_code;
      const customFonts = useFontStore.getState().customFonts;

      // Also save guest design as backup
      saveGuestDesign({ productId: product.id, productColor, canvasState, customFonts });

      // Generate a shared design ID so all sizes from this design are grouped together
      const guestDesignId = `guest-${product.id}-${Date.now()}`;

      for (const item of selectedItems) {
        addToCart({
          productId: product.id,
          productTitle: product.title,
          productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem,
          canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: guestDesignId,
          designName,
          customFonts,
          previewImage,
        });
      }

      // Clear canvas
      Object.values(canvasMap).forEach((canvas) => {
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

      if (purchaseType === 'direct') {
        router.push('/checkout?guest=true');
      } else {
        router.push('/cart');
      }
      return;
    }
    setIsSaving(true);
    try {
      const canvasState = saveAllCanvasState();
      const thumbnail = generateProductThumbnail(canvasMap, 'front', 200, 200);
      const previewImage = generateProductThumbnail(canvasMap, 'front', 800, 800);
      const selectedColor = productColors.find(c => c.manufacturer_colors.hex === productColor);
      const colorName = selectedColor?.manufacturer_colors.name || '색상';
      const colorCode = selectedColor?.manufacturer_colors.color_code;
      const customFonts = useFontStore.getState().customFonts;

      let sharedDesignId: string | undefined;
      const newCartItemIds: string[] = [];

      for (const item of selectedItems) {
        const dbCartItem = await addToCartDB({
          productId: product.id,
          productTitle: product.title,
          productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem,
          canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: sharedDesignId,
          designName,
          previewImage,
          customFonts,
          canvasMap,
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
          productTitle: product.title,
          productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem,
          canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: sharedDesignId,
          designName,
          customFonts,
          previewImage,
        });
      }

      // For direct purchase, store the item IDs so checkout only shows these items
      if (purchaseType === 'direct' && newCartItemIds.length > 0) {
        sessionStorage.setItem('directCheckoutItemIds', JSON.stringify(newCartItemIds));
      }

      removeGuestDesign(product.id);

      // Clear canvas state
      Object.values(canvasMap).forEach((canvas) => {
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

  useEffect(() => {
    if (!partnerMallAdd) return;
    const loadPartnerMallAddData = async () => {
      const raw = sessionStorage.getItem('partnerMallAddData');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        setPartnerMallAddData(data);
        sessionStorage.removeItem('partnerMallAddData');

        const checkCanvasesReady = () =>
          product.configuration.every(side => canvasMap[side.id]);
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

  const handleSaveToMall = async () => {
    if (!partnerMallAddData) return;
    setIsSavingToMall(true);
    try {
      const canvasState = saveAllCanvasState();
      const previewUrl = generateProductThumbnail(canvasMap, 'front', 400, 400);
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
    if (cartItemId || partnerMallAdd) return;
    if (productColors.length > 0) {
      setProductColor(productColors[0].manufacturer_colors.hex);
    }
  }, [productColors, cartItemId, partnerMallAdd, setProductColor]);

  // Load cart item design
  useEffect(() => {
    const loadCartItemDesign = async () => {
      if (!cartItemId) return;
      const cartItem = cartStoreItems.find(item => item.id === cartItemId);
      if (!cartItem) { console.error('Cart item not found:', cartItemId); return; }
      setIsLoadingCartItem(true);
      try {
        const checkCanvasesReady = () => product.configuration.every(side => canvasMap[side.id]);
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
    if (cartItemId || partnerMallAdd) return;
    const saved = getGuestDesign(product.id);
    if (!saved) return;
    setGuestDesign(saved);
    setIsRecallGuestDesignOpen(true);
  }, [cartItemId, partnerMallAdd, product.id]);

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

  // Desktop: listen for canvas selection changes
  useEffect(() => {
    if (isMobile) return;
    const activeCanvas = canvasMap[activeSideId];
    if (!activeCanvas) return;

    const handleSelectionCreated = (e: any) => {
      const selected = e.selected?.[0];
      if (selected) setSelectedObject(selected);
    };
    const handleSelectionUpdated = (e: any) => {
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
  }, [isMobile, activeSideId, canvasMap]);

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

  const pricePerItem = product.base_price + pricingData.totalAdditionalPrice;
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
          onRecall={async () => {
            if (!guestDesign) { setIsRecallGuestDesignOpen(false); return; }
            const checkCanvasesReady = () => product.configuration.every(side => canvasMap[side.id]);
            let attempts = 0;
            while (!checkCanvasesReady() && attempts < 50) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
            if (!checkCanvasesReady()) { setIsRecallGuestDesignOpen(false); return; }
            // Load custom fonts before restoring canvas state
            if (guestDesign.customFonts && guestDesign.customFonts.length > 0) {
              const fontStore = useFontStore.getState();
              fontStore.setCustomFonts(guestDesign.customFonts);
              await fontStore.loadAllFonts();
            }
            setProductColor(guestDesign.productColor);
            await new Promise(resolve => setTimeout(resolve, 100));
            await restoreAllCanvasState(guestDesign.canvasState);
            incrementCanvasVersion();
            setIsRecallGuestDesignOpen(false);
            // Go directly to editor since they had a design
            goToEditor();
          }}
          onDiscard={() => {
            removeGuestDesign(product.id);
            setGuestDesign(null);
            setIsRecallGuestDesignOpen(false);
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

    // Fallback to productColor or first available color
    if (productColor && productColor !== '#FFFFFF') return productColor;
    if (firstSide.colorOptions && firstSide.colorOptions.length > 0) return firstSide.colorOptions[0].hex;
    if (productColors.length > 0) return productColors[0].manufacturer_colors.hex;
    return '#FFFFFF';
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

        {/* Bottom bar */}
        <div className="w-full fixed bottom-0 left-0 bg-white pb-6 pt-3 px-4 shadow-2xl shadow-black z-20">
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

        <QuantitySelectorModal
          isOpen={isQuantitySelectorOpen}
          onClose={() => { setIsQuantitySelectorOpen(false); setCurrentStep('editor'); }}
          onConfirm={handleSaveToCart}
          sizeOptions={product.size_options || []}
          pricePerItem={pricePerItem}
          isSaving={isSaving}
        />

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
      </div>
    );
  }

  // Desktop editor step
  return (
    <div className="min-h-screen bg-white text-black">
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
                  onClick={() => setActiveSide(side.id)}
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
            ) : (
              <>
                {/* Product Info */}
                <div className="p-4 pb-2">
                  {product.manufacturer_name && (
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{product.manufacturer_name}</p>
                  )}
                  <h2 className="text-sm font-bold text-gray-900 leading-snug mt-1">{product.title}</h2>
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

      <QuantitySelectorModal
        isOpen={isQuantitySelectorOpen}
        onClose={() => { setIsQuantitySelectorOpen(false); setCurrentStep('editor'); }}
        onConfirm={handleSaveToCart}
        sizeOptions={product.size_options || []}
        pricePerItem={pricePerItem}
        isSaving={isSaving}
      />

      <LoginPromptModal
        isOpen={isLoginPromptOpen}
        onClose={() => setIsLoginPromptOpen(false)}
        title="로그인이 필요합니다"
        message="구매를 진행하려면 로그인이 필요합니다. 디자인을 임시 저장해두었습니다."
      />

      <GuestDesignRecallModal
        isOpen={isRecallGuestDesignOpen}
        onRecall={async () => {
          if (!guestDesign) { setIsRecallGuestDesignOpen(false); return; }
          const checkCanvasesReady = () => product.configuration.every(side => canvasMap[side.id]);
          let attempts = 0;
          while (!checkCanvasesReady() && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          if (!checkCanvasesReady()) { setIsRecallGuestDesignOpen(false); return; }
          // Load custom fonts before restoring canvas state
          if (guestDesign.customFonts && guestDesign.customFonts.length > 0) {
            const fontStore = useFontStore.getState();
            fontStore.setCustomFonts(guestDesign.customFonts);
            await fontStore.loadAllFonts();
          }
          setProductColor(guestDesign.productColor);
          await new Promise(resolve => setTimeout(resolve, 100));
          await restoreAllCanvasState(guestDesign.canvasState);
          incrementCanvasVersion();
          setIsRecallGuestDesignOpen(false);
        }}
        onDiscard={() => {
          removeGuestDesign(product.id);
          setGuestDesign(null);
          setIsRecallGuestDesignOpen(false);
        }}
      />
    </div>
  );
}
