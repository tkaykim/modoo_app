'use client'
import ProductDesigner from "@/app/components/canvas/ProductDesigner";
import PricingInfo from "@/app/components/canvas/PricingInfo";
import ColorInfo from "@/app/components/canvas/ColorInfo";
import PrintMethodsDisplay from "@/app/components/canvas/PrintMethodsDisplay";
import LayerColorSelector from "@/app/components/canvas/LayerColorSelector";
import ObjectPreviewPanel from "@/app/components/canvas/ObjectPreviewPanel";
import DesktopToolbar from "@/app/components/canvas/DesktopToolbar";
import { Product, ProductConfig, CartItem, ProductColor, PrintMethodRecord } from "@/types/types";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useCartStore } from "@/store/useCartStore";
import Header from "@/app/components/Header";
import { X, Trash2, ChevronsUp, ArrowUp, ArrowDown, ChevronsDown, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { calculateAllSidesPricing, type PricingSummary } from "@/app/utils/canvasPricing";
import { saveDesign } from "@/lib/designService";
import * as fabric from 'fabric';
import { isCurvedText } from '@/lib/curvedText';
import TextStylePanel from '@/app/components/canvas/TextStylePanel';
import { addToCartDB } from "@/lib/cartService";
import { generateProductThumbnail } from "@/lib/thumbnailGenerator";
import QuantitySelectorModal from "@/app/components/QuantitySelectorModal";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import ReviewsSection from "@/app/components/ReviewsSection";
import DescriptionImageSection from "@/app/components/DescriptionImageSection";
import { useAuthStore } from "@/store/useAuthStore";
import SaveDesignModal from "@/app/components/SaveDesignModal";
import PurchaseOptionModal from "@/app/components/PurchaseOptionModal";
import LoginPromptModal from "@/app/components/LoginPromptModal";
import GuestDesignRecallModal from "@/app/components/GuestDesignRecallModal";
import { getGuestDesign, removeGuestDesign, saveGuestDesign, type GuestDesign } from "@/lib/guestDesignStorage";
import ShareProductButton from "@/app/components/ShareProductButton";


interface ProductEditorClientDesktopProps {
  product: Product;
  allPrintMethods?: PrintMethodRecord[];
  enabledPrintMethodIds?: Set<string>;
}

export default function ProductEditorClientDesktop({ product, allPrintMethods = [], enabledPrintMethodIds = new Set() }: ProductEditorClientDesktopProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cartItemId = searchParams.get('cartItemId');
  const descriptionImageUrls = product.description_image ?? null;
  const sizingChartImageUrl = product.sizing_chart_image ?? null;

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
  const [isPurchaseOptionOpen, setIsPurchaseOptionOpen] = useState(false);
  const [isSaveDesignOpen, setIsSaveDesignOpen] = useState(false);
  const [, setIsLoadingCartItem] = useState(false);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isRecallGuestDesignOpen, setIsRecallGuestDesignOpen] = useState(false);
  const [guestDesign, setGuestDesign] = useState<GuestDesign | null>(null);
  const [selectedTextObject, setSelectedTextObject] = useState<fabric.IText | fabric.Text | null>(null);
  const [isSavingToMall, setIsSavingToMall] = useState(false);

  // Convert Product to ProductConfig format
  const productConfig: ProductConfig = {
    productId: product.id,
    sides: product.configuration,
  };

  const handleColorChange = (color: string) => {
    setProductColor(color);
  };

  // Layer manipulation functions
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
    const selectedObject = canvas?.getActiveObject();
    const selectedObjects = canvas?.getActiveObjects();

    if (selectedObjects && selectedObjects.length > 0) {
      selectedObjects.forEach(obj => canvas?.remove(obj));
      canvas?.discardActiveObject();
      canvas?.renderAll();
      incrementCanvasVersion();
    } else if (selectedObject) {
      canvas?.remove(selectedObject);
      canvas?.renderAll();
      incrementCanvasVersion();
    }
  };

  const handlePurchaseClick = () => {
    if (!isAuthenticated) {
      const canvasState = saveAllCanvasState();
      saveGuestDesign({
        productId: product.id,
        productColor,
        canvasState,
      });
      setIsLoginPromptOpen(true);
      return;
    }
    setIsPurchaseOptionOpen(true);
  };

  const handleSelectCartPurchase = () => {
    if (!isAuthenticated) {
      setIsPurchaseOptionOpen(false);
      const canvasState = saveAllCanvasState();
      saveGuestDesign({
        productId: product.id,
        productColor,
        canvasState,
      });
      setIsLoginPromptOpen(true);
      return;
    }
    setIsPurchaseOptionOpen(false);
    setIsQuantitySelectorOpen(true);
  };

  const handleSelectCoBuyPurchase = () => {
    if (!isAuthenticated) {
      setIsPurchaseOptionOpen(false);
      const canvasState = saveAllCanvasState();
      saveGuestDesign({
        productId: product.id,
        productColor,
        canvasState,
      });
      setIsLoginPromptOpen(true);
      return;
    }
    setIsPurchaseOptionOpen(false);
    setIsSaveDesignOpen(true);
  };

  const handleSaveDesignForCoBuy = async (designTitle: string) => {
    if (!isAuthenticated) {
      const canvasState = saveAllCanvasState();
      saveGuestDesign({
        productId: product.id,
        productColor,
        canvasState,
      });
      setIsLoginPromptOpen(true);
      return;
    }
    setIsSaving(true);
    try {
      const canvasState = saveAllCanvasState();
      const previewImage = generateProductThumbnail(canvasMap, 'front', 400, 400);

      const savedDesign = await saveDesign({
        productId: product.id,
        title: designTitle.trim(),
        productColor: productColor,
        canvasState: canvasState,
        previewImage: previewImage,
        pricePerItem: pricePerItem,
        canvasMap: canvasMap, // Pass canvas instances for client-side SVG export
      });

      if (!savedDesign) {
        alert('디자인 저장에 실패했습니다.');
        return;
      }

      setIsSaveDesignOpen(false);
      removeGuestDesign(product.id);

      // Navigate to the cobuy creation page
      router.push(`/home/cobuy/create?designId=${savedDesign.id}`);
    } catch (error) {
      console.error('Save design failed:', error);
      alert('디자인 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save design to cart and clear state
  const handleSaveToCart = async (designName: string, selectedItems: CartItem[]) => {
    if (!isAuthenticated) {
      const canvasState = saveAllCanvasState();
      saveGuestDesign({
        productId: product.id,
        productColor,
        canvasState,
      });
      setIsLoginPromptOpen(true);
      return;
    }
    setIsSaving(true);
    try {
      const canvasState = saveAllCanvasState();
      const thumbnail = generateProductThumbnail(canvasMap, 'front', 200, 200);
      const previewImage = generateProductThumbnail(canvasMap, 'front', 400, 400);
      const selectedColor = productColors.find(c => c.manufacturer_colors.hex === productColor);
      const colorName = selectedColor?.manufacturer_colors.name || '색상';
      const colorCode = selectedColor?.manufacturer_colors.color_code;

      // Save design once and reuse for all cart items
      let sharedDesignId: string | undefined;

      // Add all cart items to both Supabase and local storage
      for (const item of selectedItems) {
        // Save to Supabase - first item creates the design, rest reuse it
        const dbCartItem = await addToCartDB({
          productId: product.id,
          productTitle: product.title,
          productColor: productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: pricePerItem,
          canvasState: canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: sharedDesignId, // Reuse design for subsequent items
          designName: designName, // Use the custom design name
          previewImage: previewImage, // Add preview image for the design
        });

        // Store the design ID from the first item
        if (!sharedDesignId && dbCartItem?.saved_design_id) {
          sharedDesignId = dbCartItem.saved_design_id;
        }

        // Also add to local cart store for offline access
        addToCart({
          productId: product.id,
          productTitle: product.title,
          productColor: productColor,
          productColorName: colorName,
          productColorCode: colorCode,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: pricePerItem,
          canvasState: canvasState,
          thumbnailUrl: thumbnail,
          savedDesignId: sharedDesignId, // All items share the same design ID
          designName: designName, // Custom design name
        });
      }

      removeGuestDesign(product.id);

      // Clear canvas state
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

      // Reset product color to default
      setProductColor('#FFFFFF');
    } catch (error) {
      console.error('Add to cart failed:', error);
      alert('장바구니 추가 중 오류가 발생했습니다.');
      throw error; // Re-throw to prevent success modal from showing
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch product colors from database (joined with manufacturer_colors)
  useEffect(() => {
    const fetchColors = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('product_colors')
        .select(`
          id,
          product_id,
          manufacturer_color_id,
          is_active,
          sort_order,
          created_at,
          updated_at,
          manufacturer_colors (
            id,
            name,
            hex,
            color_code
          )
        `)
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch product colors:', error);
        return;
      }

      if (data && data.length > 0) {
        // Transform data to match ProductColor type (Supabase returns single FK as object, not array)
        const colors = data.map((item) => ({
          ...item,
          manufacturer_colors: item.manufacturer_colors as unknown as ProductColor['manufacturer_colors'],
        })) as ProductColor[];
        // Sort by color_code ascending
        colors.sort((a, b) => (a.manufacturer_colors?.color_code || '').localeCompare(b.manufacturer_colors?.color_code || ''));
        setProductColors(colors);
      }
    };

    fetchColors();
  }, [product.id]);

  // Load cart item design on mount if cartItemId is provided
  useEffect(() => {
    const loadCartItemDesign = async () => {
      if (!cartItemId) return;

      // Find the cart item
      const cartItem = cartStoreItems.find(item => item.id === cartItemId);
      if (!cartItem) {
        console.error('Cart item not found:', cartItemId);
        return;
      }

      setIsLoadingCartItem(true);
      try {
        // Wait for canvases to be registered
        // Check if all canvases are ready
        const checkCanvasesReady = () => {
          return product.configuration.every(side => canvasMap[side.id]);
        };

        // Poll until canvases are ready (with timeout)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        while (!checkCanvasesReady() && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!checkCanvasesReady()) {
          console.error('Canvases not ready after timeout');
          return;
        }

        // Restore product color FIRST
        if (cartItem.productColor) {
          setProductColor(cartItem.productColor);
        }

        // Wait for color to be applied
        await new Promise(resolve => setTimeout(resolve, 100));

        // Then restore canvas state
        await restoreAllCanvasState(cartItem.canvasState);

        // Increment canvas version to trigger pricing recalculation
        incrementCanvasVersion();

        console.log('Cart item design loaded successfully');
      } catch (error) {
        console.error('Failed to load cart item design:', error);
      } finally {
        setIsLoadingCartItem(false);
      }
    };

    loadCartItemDesign();
	  }, [cartItemId, cartStoreItems, canvasMap, product.configuration, restoreAllCanvasState, setProductColor, incrementCanvasVersion]);

  // Partner mall mode: new product addition or editing existing product
  const partnerMallAdd = searchParams.get('partnerMallAdd');
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

        // Wait for canvases to be ready
        const checkCanvasesReady = () =>
          product.configuration.every(side => canvasMap[side.id]);

        let attempts = 0;
        while (!checkCanvasesReady() && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (!checkCanvasesReady()) return;

        // Set product color
        if (data.colorHex) {
          setProductColor(data.colorHex);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // If editing existing product, restore its canvas state
        if (data.existingId && data.canvasState && Object.keys(data.canvasState).length > 0) {
          await restoreAllCanvasState(data.canvasState as Record<string, string>);
          incrementCanvasVersion();
        } else if (data.logoUrl) {
          // New product: place the mall logo on the first side canvas
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

  // Save to partner mall (create or update)
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
          ...(isUpdate
            ? { id: partnerMallAddData.existingId }
            : { product_id: product.id }),
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

  useEffect(() => {
    if (cartItemId || partnerMallAdd) return;

    const saved = getGuestDesign(product.id);
    if (!saved) return;

    setGuestDesign(saved);
    setIsRecallGuestDesignOpen(true);
  }, [cartItemId, partnerMallAdd, product.id]);

  useEffect(() => {
    setEditMode(true);
    if (product.configuration.length > 0) {
      setActiveSide(product.configuration[0].id);
    }
    return () => setEditMode(false);
  }, [setEditMode, setActiveSide, product.configuration]);

  // Listen for canvas selection changes
  useEffect(() => {
    const activeCanvas = canvasMap[activeSideId];
    if (!activeCanvas) return;

    const handleSelectionCreated = (e: any) => {
      const selected = e.selected?.[0];
      if (selected && (selected.type === 'i-text' || selected.type === 'text' || isCurvedText(selected))) {
        setSelectedTextObject(selected);
      }
    };

    const handleSelectionUpdated = (e: any) => {
      const selected = e.selected?.[0];
      if (selected && (selected.type === 'i-text' || selected.type === 'text' || isCurvedText(selected))) {
        setSelectedTextObject(selected);
      } else {
        setSelectedTextObject(null);
      }
    };

    const handleSelectionCleared = () => {
      setSelectedTextObject(null);
    };

    activeCanvas.on('selection:created', handleSelectionCreated);
    activeCanvas.on('selection:updated', handleSelectionUpdated);
    activeCanvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      activeCanvas.off('selection:created', handleSelectionCreated);
      activeCanvas.off('selection:updated', handleSelectionUpdated);
      activeCanvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [activeSideId, canvasMap]);

  const formattedPrice = product.base_price.toLocaleString('ko-KR');

  // Calculate price per item including canvas design costs
  const [pricingData, setPricingData] = useState<PricingSummary>({
    totalAdditionalPrice: 0,
    sidePricing: [],
    totalObjectCount: 0
  });

  useEffect(() => {
    const calculatePricing = async () => {
      const pricing = await calculateAllSidesPricing(canvasMap, product.configuration);
      setPricingData(pricing);
    };
    calculatePricing();
  }, [canvasMap, product.configuration, canvasVersion]);

  const pricePerItem = product.base_price + pricingData.totalAdditionalPrice;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="w-full sticky top-0 bg-white/95 backdrop-blur z-40">
        <Header back={true} />
      </div>

      <div className="py-4">
        {/* Editor Container */}
        <div className="grid gap-2 grid-cols-2 h-175">
          {/* Left Side */}
          <div className="flex flex-col gap-2 h-175 relative overflow-hidden">
            <div className="rounded-md bg-white h-175">
              <ProductDesigner config={productConfig} layout="desktop" />
            </div>

            {/* Layer Controls positioned at top left - Only shown when object is selected */}
            {selectedTextObject && (
              <div className="absolute top-16 left-4 z-10 flex items-center gap-2 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-700 mr-1">레이어 조정:</span>
                <button
                  onClick={bringToFront}
                  className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
                  title="맨 앞으로"
                >
                  <ChevronsUp className="size-4 text-gray-700" />
                </button>
                <button
                  onClick={bringForward}
                  className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
                  title="앞으로"
                >
                  <ArrowUp className="size-4 text-gray-700" />
                </button>
                <button
                  onClick={sendBackward}
                  className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
                  title="뒤로"
                >
                  <ArrowDown className="size-4 text-gray-700" />
                </button>
                <button
                  onClick={sendToBack}
                  className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition"
                  title="맨 뒤로"
                >
                  <ChevronsDown className="size-4 text-gray-700" />
                </button>
                <div className="h-6 w-px bg-gray-300 mx-1" />
                <button
                  onClick={handleDeleteObject}
                  className="p-2 rounded-full border border-red-200 bg-white hover:bg-red-50 transition"
                  title="삭제"
                >
                  <Trash2 className="size-4 text-red-600" />
                </button>
              </div>
            )}

            {/* Toolbar positioned at bottom right */}
            <div className="absolute bottom-6 right-4 z-10">
              <DesktopToolbar sides={productConfig.sides} productId={productConfig.productId} />
            </div>
          </div>

          {/* Right Side - Fixed height with sticky pricing */}
          <aside className="rounded-md bg-white p-4 border border-gray-200 h-full overflow-hidden flex flex-col">
            {selectedTextObject ? (
              // Text Editing Panel
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">텍스트 편집</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const activeCanvas = canvasMap[activeSideId];
                        if (activeCanvas && selectedTextObject) {
                          activeCanvas.remove(selectedTextObject);
                          activeCanvas.requestRenderAll();
                          setSelectedTextObject(null);
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
                        setSelectedTextObject(null);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                      title="닫기"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TextStylePanel selectedObject={selectedTextObject} layout="sidebar" />
                </div>
              </>
            ) : (
              // Normal Product Info Panel
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{product.manufacturer_name || '제조사'}</p>
                    <h2 className="text-lg font-semibold text-gray-900 leading-snug mt-1">{product.title}</h2>
                  </div>
                  <ShareProductButton
                  url={`/editor/${product.id}`}
                  />
                </div>

            <div className="mt-4 rounded-md flex flex-col flex-1 min-h-0">
              <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                {(() => {
                  const currentSide = product.configuration.find(side => side.id === activeSideId);
                  const hasLayers = currentSide?.layers && currentSide.layers.length > 0;

                  return hasLayers || (currentSide?.colorOptions && currentSide.colorOptions.length > 0) ? (
                    <LayerColorSelector side={currentSide!} />
                  ) : (
                    productColors.length > 0 && (
                      <div className="overflow-hidden rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 mb-3">색상 선택</p>
                        <div className="flex flex-wrap gap-3">
                          {productColors.map((color) => (
                            <button
                              key={color.id}
                              onClick={() => handleColorChange(color.manufacturer_colors.hex)}
                              className="flex items-center gap-2"
                            >
                              <div
                                className={`w-8 h-8 rounded-full border-2 ${
                                  productColor === color.manufacturer_colors.hex ? 'border-black' : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: color.manufacturer_colors.hex }}
                              ></div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  );
                })()}

                <ObjectPreviewPanel sides={product.configuration} />
                {/* <ColorInfo /> */}
                
                {/* <PricingInfo basePrice={product.base_price} sides={product.configuration} /> */}
              </div>
            </div>

            {/* Fixed bottom pricing section */}
            <div className="mt-auto pt-4 border-t border-gray-200">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">기본가</span>
                  <span className="text-gray-700">{formattedPrice}원</span>
                </div>
                {pricingData.totalAdditionalPrice > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">디자인 추가비용</span>
                    <span className="text-gray-700">+{pricingData.totalAdditionalPrice.toLocaleString('ko-KR')}원</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">배송비</span>
                  <span className="text-gray-700">3,000원</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-semibold">총가격</span>
                    <span className="text-lg text-gray-900 font-bold">{pricePerItem.toLocaleString('ko-KR')}원</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {partnerMallAddData ? (
                  <button
                    onClick={handleSaveToMall}
                    disabled={isSavingToMall}
                    className="w-full bg-black py-3 text-sm rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {isSavingToMall ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        저장 중...
                      </>
                    ) : '몰에 저장'}
                  </button>
                ) : (
                  <button
                    onClick={handlePurchaseClick}
                    disabled={isSaving}
                    className="w-full bg-black py-3 text-sm rounded-lg text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {isSaving ? '처리 중...' : '구매하기'}
                  </button>
                )}
              </div>
            </div>
              </>
            )}
          </aside>
	        </div>

          <PrintMethodsDisplay allPrintMethods={allPrintMethods} enabledPrintMethodIds={enabledPrintMethodIds} className="mt-4" />
          <ReviewsSection productId={product.id} limit={10} />
          <div className="w-full">
            <DescriptionImageSection title="주문상세" imageUrls={descriptionImageUrls} />
          </div>
          <DescriptionImageSection title="사이즈 차트" imageUrls={sizingChartImageUrl ? [sizingChartImageUrl] : null} />
      </div>

      <QuantitySelectorModal
        isOpen={isQuantitySelectorOpen}
        onClose={() => setIsQuantitySelectorOpen(false)}
        onConfirm={handleSaveToCart}
        sizeOptions={product.size_options || []}
        pricePerItem={pricePerItem}
        isSaving={isSaving}
        canvasMap={canvasMap}
        sides={product.configuration}
        basePrice={product.base_price}
        discountRates={product.discount_rates}
      />

      <PurchaseOptionModal
        isOpen={isPurchaseOptionOpen}
        onClose={() => setIsPurchaseOptionOpen(false)}
        onSelectCoBuy={handleSelectCoBuyPurchase}
        onSelectCart={handleSelectCartPurchase}
        isDisabled={isSaving}
      />

      <SaveDesignModal
        isOpen={isSaveDesignOpen}
        onClose={() => setIsSaveDesignOpen(false)}
        onConfirm={handleSaveDesignForCoBuy}
        isSaving={isSaving}
        defaultDesignName={product.title}
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
	          if (!guestDesign) {
	            setIsRecallGuestDesignOpen(false);
	            return;
	          }

	          const checkCanvasesReady = () => {
	            return product.configuration.every(side => canvasMap[side.id]);
	          };

	          let attempts = 0;
	          const maxAttempts = 50; // 5 seconds max
	          while (!checkCanvasesReady() && attempts < maxAttempts) {
	            await new Promise(resolve => setTimeout(resolve, 100));
	            attempts++;
	          }

	          if (!checkCanvasesReady()) {
	            console.error('Canvases not ready after timeout');
	            setIsRecallGuestDesignOpen(false);
	            return;
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
