'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { addToCartDB } from '@/lib/cartService';
import { useCartStore } from '@/store/useCartStore';
import QuantitySelectorModal from '@/app/components/QuantitySelectorModal';
import { CartItem, OrderItem, ProductColor, SizeOption } from '@/types/types';

// 주문 상세에서 같은 디자인(최신 확정본)으로 바로 재주문.
// 시안확정 시 write-back(designWriteBack)으로 order_items.design_id가 최신 확정본을
// 가리키므로, 그 디자인을 그대로 재사용해 장바구니/바로구매로 보낸다.
// 단가는 saved_designs.price_per_item을 쓴다 — checkout 서버 검증(orderPricingValidator)이
// 디자인 단가와의 일치를 요구하므로 이것이 유일하게 정합한 값이다.

interface ReorderButtonProps {
  item: OrderItem;
}

interface DesignRow {
  id: string;
  title: string | null;
  canvas_state: Record<string, string>;
  color_selections: { productColor?: string } | null;
  preview_url: string | null;
  price_per_item: number | null;
  last_confirmed_at?: string | null;
}

export default function ReorderButton({ item }: ReorderButtonProps) {
  const { addItem: addToLocalCart } = useCartStore();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [design, setDesign] = useState<DesignRow | null>(null);
  const [productTitle, setProductTitle] = useState('');
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [initialQuantities, setInitialQuantities] = useState<Record<string, number>>({});

  if (!item.design_id) return null;

  const handleClick = async () => {
    if (isPreparing) return;
    setIsPreparing(true);
    try {
      const supabase = createClient();

      const [designResult, productResult] = await Promise.all([
        supabase
          .from('saved_designs')
          .select('id, title, canvas_state, color_selections, preview_url, price_per_item, last_confirmed_at')
          .eq('id', item.design_id)
          .single(),
        supabase
          .from('products')
          .select(`
            id, title, base_price, size_options, is_active,
            product_colors (
              id, product_id, manufacturer_color_id, is_active, sort_order, created_at, updated_at,
              manufacturer_colors ( id, name, hex, color_code )
            )
          `)
          .eq('id', item.product_id)
          .single(),
      ]);

      if (designResult.error || !designResult.data) {
        alert('저장된 디자인을 찾을 수 없어 재주문할 수 없습니다.\n문의하기로 요청해주시면 도와드리겠습니다.');
        return;
      }
      if (productResult.error || !productResult.data) {
        alert('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      if (productResult.data.is_active === false) {
        alert('현재 판매가 중단된 상품이라 재주문할 수 없습니다.\n문의하기로 요청해주시면 도와드리겠습니다.');
        return;
      }

      const designRow = designResult.data as DesignRow;
      const product = productResult.data;

      const colors: ProductColor[] = Array.isArray(product.product_colors)
        ? product.product_colors.map((c: { manufacturer_colors: unknown } & Omit<ProductColor, 'manufacturer_colors'>) => ({
            ...c,
            manufacturer_colors: c.manufacturer_colors as ProductColor['manufacturer_colors'],
          }))
        : [];

      // 이전 주문의 사이즈별 수량 프리필. 디자인 색과 같은 variant만 복원한다
      // (여러 색을 섞어 주문했던 경우, 다른 색 분량은 색 선택 UI가 없어 복원 불가).
      const designColor = designRow.color_selections?.productColor;
      const variants = item.item_options?.variants || [];
      const distinctColors = new Set(variants.map((v) => v.color_hex).filter(Boolean));
      const prefill: Record<string, number> = {};
      for (const v of variants) {
        if (distinctColors.size > 1 && designColor && v.color_hex && v.color_hex !== designColor) continue;
        if (!v.size_name || !v.quantity) continue;
        prefill[v.size_name] = (prefill[v.size_name] || 0) + v.quantity;
      }

      setDesign(designRow);
      setProductTitle(product.title || item.product_title);
      setSizeOptions(product.size_options || []);
      setProductColors(colors);
      setInitialQuantities(prefill);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Reorder preparation failed:', error);
      alert('재주문 준비 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsPreparing(false);
    }
  };

  const effectivePricePerItem =
    design?.price_per_item && design.price_per_item > 0
      ? design.price_per_item
      : item.price_per_item;

  const handleConfirm = async (
    designName: string,
    selectedItems: CartItem[],
    purchaseType: 'direct' | 'cart',
    frozenPricePerItem?: number,
  ) => {
    if (!design) return;

    const pricePerItem =
      typeof frozenPricePerItem === 'number' && frozenPricePerItem > 0
        ? frozenPricePerItem
        : effectivePricePerItem;

    setIsSaving(true);
    try {
      const productColor = design.color_selections?.productColor || '#FFFFFF';
      const colorName =
        productColors.find((c) => c.manufacturer_colors.hex === productColor)?.manufacturer_colors.name || '색상';

      const newCartItemIds: string[] = [];

      for (const selected of selectedItems) {
        const dbCartItem = await addToCartDB({
          productId: item.product_id,
          productTitle,
          productColor,
          productColorName: colorName,
          size: selected.size,
          quantity: selected.quantity,
          pricePerItem,
          canvasState: design.canvas_state,
          thumbnailUrl: design.preview_url || undefined,
          savedDesignId: design.id, // 확정본 디자인 재사용 (새 디자인 생성 안 함)
          designName,
          previewImage: design.preview_url || undefined,
        });

        if (dbCartItem) {
          if (dbCartItem.id) newCartItemIds.push(dbCartItem.id);
          addToLocalCart({
            productId: item.product_id,
            productTitle,
            productColor,
            productColorName: colorName,
            size: selected.size,
            quantity: selected.quantity,
            pricePerItem,
            canvasState: design.canvas_state,
            thumbnailUrl: design.preview_url || undefined,
            savedDesignId: design.id,
            designName,
          });
        }
      }

      if (purchaseType === 'direct' && newCartItemIds.length > 0) {
        sessionStorage.setItem('directCheckoutItemIds', JSON.stringify(newCartItemIds));
      }
    } catch (error) {
      console.error('Reorder add to cart failed:', error);
      alert('재주문 처리 중 오류가 발생했습니다.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPreparing}
        className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium hover:text-emerald-800 transition-colors disabled:opacity-50"
      >
        {isPreparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
        재주문
      </button>

      {isModalOpen && design && (
        <QuantitySelectorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirm}
          sizeOptions={sizeOptions}
          pricePerItem={effectivePricePerItem}
          isSaving={isSaving}
          defaultDesignName={design.title || item.design_title || item.product_title}
          productId={item.product_id}
          initialQuantities={initialQuantities}
          previewSlot={
            design.preview_url ? (
              <div className="flex items-center justify-center py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={design.preview_url}
                  alt="디자인 미리보기"
                  className="max-h-40 rounded-lg border border-gray-200 object-contain"
                />
              </div>
            ) : undefined
          }
        />
      )}
    </>
  );
}
