'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Trash2, ChevronsUp, ArrowUp, ArrowDown, ChevronsDown } from 'lucide-react';
import ProductDesigner from './canvas/ProductDesigner';
import EditButton from './canvas/EditButton';
import PricingInfo from './canvas/PricingInfo';
import ColorInfo from './canvas/ColorInfo';
import ObjectPreviewPanel from './canvas/ObjectPreviewPanel';
import LayerColorSelector from './canvas/LayerColorSelector';
import DesktopToolbar from './canvas/DesktopToolbar';
import TextStylePanel from './canvas/TextStylePanel';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useFontStore } from '@/store/useFontStore';
import { ProductConfig, ProductColor } from '@/types/types';
import { generateProductThumbnail } from '@/lib/thumbnailGenerator';
import { createClient } from '@/lib/supabase-client';
import { calculateAllSidesPricing, type PricingSummary } from '@/app/utils/canvasPricing';
import { FontMetadata } from '@/lib/fontUtils';
import * as fabric from 'fabric';
import { isCurvedText } from '@/lib/curvedText';

interface DesignEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItemId?: string | null;
  designId?: string | null;
  onSaveComplete?: () => void;
}

export default function DesignEditModal({
  isOpen,
  onClose,
  cartItemId,
  designId,
  onSaveComplete,
}: DesignEditModalProps) {
  const {
    productColor,
    setProductColor,
    saveAllCanvasState,
    restoreAllCanvasState,
    canvasMap,
    setEditMode,
    isEditMode,
    canvasVersion,
    incrementCanvasVersion,
    activeSideId,
  } = useCanvasStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productConfig, setProductConfig] = useState<ProductConfig | null>(null);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [hasRestoredDesign, setHasRestoredDesign] = useState(false);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [pricingData, setPricingData] = useState<PricingSummary>({
    totalAdditionalPrice: 0,
    sidePricing: [],
    totalObjectCount: 0
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedTextObject, setSelectedTextObject] = useState<fabric.IText | fabric.Text | null>(null);

  // Calculate pricing data asynchronously
  useEffect(() => {
    const calculatePricing = async () => {
      if (!productConfig) return;
      const pricing = await calculateAllSidesPricing(canvasMap, productConfig.sides);
      setPricingData(pricing);
    };
    calculatePricing();
  }, [canvasMap, productConfig, canvasVersion]);

  const handleColorChange = (color: string) => {
    setProductColor(color);
  };

  // Load the cart item design or saved design when modal opens
  useEffect(() => {
    const loadDesign = async () => {
      if (!isOpen || (!cartItemId && !designId)) return;

      setIsLoading(true);
      setHasRestoredDesign(false); // Reset restoration flag
      try {
        const supabase = createClient();
        let design;
        let productId;
        let productColor;

        if (cartItemId) {
          // Loading from cart item
          const { data: cartItem, error: cartError } = await supabase
            .from('cart_items')
            .select('*')
            .eq('id', cartItemId)
            .single();

          if (cartError || !cartItem) {
            console.error('Failed to fetch cart item:', cartError);
            alert('디자인을 불러올 수 없습니다.');
            onClose();
            return;
          }

          if (!cartItem.saved_design_id) {
            console.error('Cart item has no saved_design_id');
            alert('디자인을 불러올 수 없습니다.');
            onClose();
            return;
          }

          // Fetch the design from Supabase using saved_design_id
          const { data: designData, error: designError } = await supabase
            .from('saved_designs')
            .select('*')
            .eq('id', cartItem.saved_design_id)
            .single();

          if (designError || !designData) {
            console.error('Failed to fetch design:', designError);
            alert('디자인을 불러올 수 없습니다.');
            onClose();
            return;
          }

          design = designData;
          productId = cartItem.product_id;
          productColor = cartItem.product_color;

          // Store cart item for save operation
          (window as unknown as Record<string, unknown>).__cartItemId = cartItemId;
        } else if (designId) {
          // Loading from saved design directly
          const { data: designData, error: designError } = await supabase
            .from('saved_designs')
            .select('*')
            .eq('id', designId)
            .single();

          if (designError || !designData) {
            console.error('Failed to fetch design:', designError);
            alert('디자인을 불러올 수 없습니다.');
            onClose();
            return;
          }

          design = designData;
          productId = designData.product_id;
          productColor = (designData.color_selections as { productColor?: string })?.productColor || '#FFFFFF';

          // Store design ID for save operation
          (window as unknown as Record<string, unknown>).__designId = designId;
        }

        // Fetch product configuration from Supabase
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (productError || !product) {
          console.error('Failed to fetch product:', productError);
          alert('상품 정보를 불러올 수 없습니다.');
          onClose();
          return;
        }

        // Store base price
        setBasePrice(product.base_price || 0);

        // Set product config - this will trigger ProductDesigner to render
        const config: ProductConfig = {
          productId: product.id,
          sides: product.configuration,
        };

        console.log('Setting product config with sides:', config.sides.map(s => s.id));
        setProductConfig(config);

        // Load custom fonts if available
        const customFonts = (design.custom_fonts as FontMetadata[]) || [];
        if (customFonts.length > 0) {
          console.log(`Loading ${customFonts.length} custom fonts...`);
          const fontStore = useFontStore.getState();
          fontStore.setCustomFonts(customFonts);
          await fontStore.loadAllFonts();
        }

        // Store the design data for later restoration
        // We'll restore after the component renders
        (window as unknown as Record<string, unknown>).__pendingDesignRestore = {
          design,
          productColor,
          config,
        };
      } catch (error) {
        console.error('Failed to load design:', error);
        alert('디자인 불러오기에 실패했습니다.');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    loadDesign();
  }, [isOpen, cartItemId, designId, onClose]);

  // Separate effect to restore canvas state after ProductDesigner renders
  useEffect(() => {
    const restoreDesign = async () => {
      if (!productConfig || !isOpen || (!cartItemId && !designId) || hasRestoredDesign) return;

      const pendingData = (window as unknown as { __pendingDesignRestore?: { design: { canvas_state: Record<string, string> }, productColor: string, config: { sides: { id: string }[] } } }).__pendingDesignRestore;
      if (!pendingData) return;

      console.log('Starting canvas restoration process...');

      try {
        // Wait for canvases to be registered
        // Get fresh canvasMap from the store each time we check
        const checkCanvasesReady = () => {
          const currentCanvasMap = useCanvasStore.getState().canvasMap;
          return pendingData.config.sides.every((side: { id: string }) => currentCanvasMap[side.id]);
        };

        // Poll until canvases are ready with longer timeout and better error handling
        let attempts = 0;
        const maxAttempts = 150; // 15 seconds - longer timeout for dynamic imports
        const pollInterval = 100;

        while (!checkCanvasesReady() && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          attempts++;

          // Log progress every 2 seconds
          if (attempts % 20 === 0) {
            const currentCanvasMap = useCanvasStore.getState().canvasMap;
            console.log(`Waiting for canvases... (${attempts * pollInterval / 1000}s)`);
            console.log('Registered canvases:', Object.keys(currentCanvasMap));
            console.log('Expected sides:', pendingData.config.sides.map((s: { id: string }) => s.id));
          }
        }

        if (!checkCanvasesReady()) {
          const currentCanvasMap = useCanvasStore.getState().canvasMap;
          const registeredIds = Object.keys(currentCanvasMap);
          const expectedIds = pendingData.config.sides.map((s: { id: string }) => s.id);
          console.error('Canvas initialization timeout:', {
            registered: registeredIds,
            expected: expectedIds,
            missing: expectedIds.filter((id: string) => !registeredIds.includes(id)),
          });
          alert('캔버스를 초기화할 수 없습니다.\n페이지를 새로고침한 후 다시 시도해주세요.');
          onClose();
          return;
        }

        console.log('All canvases ready, restoring design...');

        // Restore product color
        if (pendingData.productColor) {
          setProductColor(pendingData.productColor);
        }

        // Wait for color to be applied
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Restore canvas state from the design
        const canvasState = pendingData.design.canvas_state as Record<string, string>;
        await restoreAllCanvasState(canvasState);

        // Start in view mode (edit mode will be enabled when user clicks the Edit button)
        setEditMode(false);

        // Wait for canvas to fully render all objects before generating previews
        // This ensures obj.toDataURL() works properly in ObjectPreviewPanel
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Force render all canvases to ensure objects are fully rendered
        const currentCanvasMap = useCanvasStore.getState().canvasMap;
        Object.values(currentCanvasMap).forEach(canvas => {
          canvas.requestRenderAll();
        });

        // Wait a bit more for render to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Trigger canvas version update to refresh ObjectPreviewPanel
        incrementCanvasVersion();

        console.log('Design restored successfully');

        // Mark as restored to prevent re-running
        setHasRestoredDesign(true);

        // Clear pending data
        delete (window as unknown as Record<string, unknown>).__pendingDesignRestore;
      } catch (error) {
        console.error('Failed to restore design:', error);
        alert('디자인 복원 중 오류가 발생했습니다.');
      }
    };

    restoreDesign();
    // Only depend on productConfig and hasRestoredDesign - NOT canvasMap
    // We read canvasMap directly from the store to avoid re-triggering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productConfig, isOpen, cartItemId, designId, hasRestoredDesign]);

  // Fetch product colors from database
  useEffect(() => {
    const fetchColors = async () => {
      if (!productConfig) return;

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
        .eq('product_id', productConfig.productId)
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
  }, [productConfig]);

  // Scroll to top and prevent scrolling when entering edit mode
  useEffect(() => {
    if (isEditMode) {
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
  }, [isEditMode]);

  // Desktop detection
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // On desktop, always enable edit mode after design is restored
  useEffect(() => {
    if (isDesktop && hasRestoredDesign && isOpen) {
      setEditMode(true);
    }
  }, [isDesktop, hasRestoredDesign, isOpen, setEditMode]);

  // Listen for canvas selection changes (desktop text editing)
  useEffect(() => {
    if (!isDesktop) return;
    const activeCanvas = canvasMap[activeSideId];
    if (!activeCanvas) return;

    const handleSelectionCreated = (e: { selected?: fabric.FabricObject[] }) => {
      const selected = e.selected?.[0];
      if (selected && (selected.type === 'i-text' || selected.type === 'text' || isCurvedText(selected))) {
        setSelectedTextObject(selected as fabric.IText | fabric.Text);
      }
    };

    const handleSelectionUpdated = (e: { selected?: fabric.FabricObject[] }) => {
      const selected = e.selected?.[0];
      if (selected && (selected.type === 'i-text' || selected.type === 'text' || isCurvedText(selected))) {
        setSelectedTextObject(selected as fabric.IText | fabric.Text);
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
  }, [isDesktop, activeSideId, canvasMap]);

  // Layer manipulation functions (desktop)
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
    const selectedObjects = canvas?.getActiveObjects();
    const selectedObject = canvas?.getActiveObject();

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

  // Handle close - exit edit mode and reset
  const handleClose = useCallback(() => {
    console.log('Closing modal, cleaning up...');
    setEditMode(false);
    setHasRestoredDesign(false);

    // Clear pending restoration data
    delete (window as unknown as Record<string, unknown>).__pendingDesignRestore;

    // Delay clearing product config to ensure cleanup happens properly
    setTimeout(() => {
      setProductConfig(null);
    }, 100);

    onClose();
  }, [setEditMode, onClose]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!cartItemId && !designId) return;

    setIsSaving(true);
    try {
      const supabase = createClient();

      // Get current canvas state
      const canvasState = saveAllCanvasState();

      // Generate new thumbnail and preview image
      const thumbnail = generateProductThumbnail(canvasMap, 'front', 200, 200);
      const previewImage = generateProductThumbnail(canvasMap, 'front', 400, 400);

      // Get color name from productColors
      const selectedColor = productColors.find(c => c.manufacturer_colors.hex === productColor);
      const colorName = selectedColor?.manufacturer_colors.name || '색상';

      // Recalculate pricing based on updated design
      const pricing = productConfig
        ? await calculateAllSidesPricing(canvasMap, productConfig.sides)
        : { totalAdditionalPrice: 0, sidePricing: [] };

      const newPricePerItem = basePrice + pricing.totalAdditionalPrice;

      if (cartItemId) {
        // Saving from cart item - update design and all associated cart items
        const { data: cartItem, error: cartError } = await supabase
          .from('cart_items')
          .select('*')
          .eq('id', cartItemId)
          .single();

        if (cartError || !cartItem || !cartItem.saved_design_id) {
          console.error('Error fetching cart item:', cartError);
          alert('장바구니 항목을 찾을 수 없습니다.');
          return;
        }

        // Update the design in Supabase
        const { error: updateError } = await supabase
          .from('saved_designs')
          .update({
            canvas_state: canvasState,
            color_selections: { productColor },
            preview_url: previewImage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cartItem.saved_design_id);

        if (updateError) {
          console.error('Error updating design:', updateError);
          alert('디자인 저장에 실패했습니다.');
          return;
        }

        // Find all cart items with the same saved_design_id
        const { data: itemsToUpdate, error: fetchError } = await supabase
          .from('cart_items')
          .select('*')
          .eq('saved_design_id', cartItem.saved_design_id);

        if (fetchError) {
          console.error('Error fetching items to update:', fetchError);
        }

        // Update all cart items with the same design
        if (itemsToUpdate && itemsToUpdate.length > 0) {
          for (const item of itemsToUpdate) {
            const { error: updateItemError } = await supabase
              .from('cart_items')
              .update({
                product_color: productColor,
                product_color_name: colorName,
                thumbnail_url: thumbnail,
                price_per_item: newPricePerItem,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            if (updateItemError) {
              console.error('Error updating cart item:', updateItemError);
            }
          }
        }
      } else if (designId) {
        // Saving from saved design - update the design AND all cart items that reference it
        const { error: updateError } = await supabase
          .from('saved_designs')
          .update({
            canvas_state: canvasState,
            color_selections: { productColor },
            preview_url: previewImage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', designId);

        if (updateError) {
          console.error('Error updating design:', updateError);
          alert('디자인 저장에 실패했습니다.');
          return;
        }

        // Find all cart items with this saved_design_id and update them
        const { data: itemsToUpdate, error: fetchError } = await supabase
          .from('cart_items')
          .select('*')
          .eq('saved_design_id', designId);

        if (fetchError) {
          console.error('Error fetching cart items to update:', fetchError);
        }

        // Update all cart items with the same design
        if (itemsToUpdate && itemsToUpdate.length > 0) {
          for (const item of itemsToUpdate) {
            const { error: updateItemError } = await supabase
              .from('cart_items')
              .update({
                product_color: productColor,
                product_color_name: colorName,
                thumbnail_url: thumbnail,
                price_per_item: newPricePerItem,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            if (updateItemError) {
              console.error('Error updating cart item:', updateItemError);
            }
          }
        }
      }

      alert('디자인이 성공적으로 저장되었습니다!');
      if (onSaveComplete) {
        onSaveComplete();
      }
      handleClose();
    } catch (error) {
      console.error('Failed to save design:', error);
      alert('디자인 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [cartItemId, designId, saveAllCanvasState, canvasMap, productColor, productColors, onSaveComplete, handleClose, productConfig, basePrice]);

  if (!isOpen) return null;

  // Color selector renderer shared between desktop and mobile
  const renderColorSelector = (layout: 'desktop' | 'mobile') => {
    const currentSide = productConfig?.sides.find(side => side.id === activeSideId);
    const hasLayers = currentSide?.layers && currentSide.layers.length > 0;

    if (hasLayers || (currentSide?.colorOptions && currentSide.colorOptions.length > 0)) {
      return layout === 'desktop' ? (
        <LayerColorSelector side={currentSide!} />
      ) : (
        <div className="mb-4">
          <LayerColorSelector side={currentSide!} />
        </div>
      );
    }

    if (productColors.length === 0) return null;

    return layout === 'desktop' ? (
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
    ) : (
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 pb-2">
          {productColors.map((color) => (
            <button
              key={color.id}
              onClick={() => handleColorChange(color.manufacturer_colors.hex)}
              className="shrink-0 flex flex-col items-center gap-2"
            >
              <div
                className={`w-12 h-12 rounded-full border-2 ${
                  productColor === color.manufacturer_colors.hex ? 'border-black' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color.manufacturer_colors.hex }}
              ></div>
              <span className="text-xs">{color.manufacturer_colors.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-200 bg-white flex flex-col">
      {/* Header - desktop: always visible, mobile: only when NOT in edit mode */}
      {(isDesktop || !isEditMode) && (
        <div className="shrink-0 bg-white z-50 border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              disabled={isSaving}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold">디자인 편집</h2>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:bg-gray-400"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">디자인 불러오는 중...</p>
          </div>
        </div>
      ) : productConfig ? (
        isDesktop ? (
          /* ===== Desktop two-column layout ===== */
          <div className="flex-1 grid grid-cols-2 gap-2 p-4 overflow-hidden">
            {/* Left: Canvas */}
            <div className="relative overflow-hidden rounded-md bg-white">
              <ProductDesigner config={productConfig as ProductConfig} layout="desktop" />

              {/* Layer Controls - shown when text object is selected */}
              {selectedTextObject && (
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

            {/* Right: Sidebar */}
            <aside className="rounded-md bg-white p-4 border border-gray-200 overflow-hidden flex flex-col">
              {selectedTextObject ? (
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
                <>
                  <div className="flex-1 overflow-y-auto space-y-4">
                    {renderColorSelector('desktop')}
                    <ObjectPreviewPanel sides={productConfig.sides} />
                    <ColorInfo />
                    <PricingInfo basePrice={basePrice} sides={productConfig.sides} />
                  </div>

                  {/* Bottom pricing summary */}
                  <div className="mt-auto pt-4 border-t border-gray-200">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">기본가</span>
                        <span className="text-gray-700">{basePrice.toLocaleString('ko-KR')}원</span>
                      </div>
                      {pricingData.totalAdditionalPrice > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">디자인 추가비용</span>
                          <span className="text-gray-700">+{pricingData.totalAdditionalPrice.toLocaleString('ko-KR')}원</span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 font-semibold">총가격</span>
                          <span className="text-lg text-gray-900 font-bold">{(basePrice + pricingData.totalAdditionalPrice).toLocaleString('ko-KR')}원</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
        ) : (
          /* ===== Mobile layout ===== */
          <div className={isEditMode ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto'}>
            <ProductDesigner config={productConfig as ProductConfig} />

            {!isEditMode && (
              <div className="bg-white p-4 pb-24">
                {renderColorSelector('mobile')}
                <PricingInfo basePrice={basePrice} sides={productConfig.sides} />
                <ColorInfo className="mt-4" />
                <ObjectPreviewPanel sides={productConfig.sides} />
                <div className="mt-4">
                  <EditButton />
                </div>
              </div>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}