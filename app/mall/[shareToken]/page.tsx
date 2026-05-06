'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Plus,
  Package,
} from 'lucide-react';
import {
  PartnerMallPublic,
  PartnerMallProductPublic,
  CartItem,
} from '@/types/types';
import { addToCartDB } from '@/lib/cartService';
import { createClient } from '@/lib/supabase-client';
import { calculateLogoAdditionalPrice } from '@/lib/partnerMallPricing';
import { setMallAutoCoupon, clearMallAutoCoupon, type MallAutoCoupon } from '@/lib/mallSalesmanCoupon';
import { renderPartnerMallSidePreviews, type SidePreview } from '@/lib/partnerMallSidePreviews';
import Header from '@/app/components/Header';
import QuantitySelectorModal from '@/app/components/QuantitySelectorModal';
import AddProductModal from './AddProductModal';

// API에서 내려오는 자동 적용 할인코드 형태 (영업사원 mall 전용)
interface SalesmanCouponPayload {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  salesman_profile_id: string;
}

const formatPrice = (price: number) => `${price.toLocaleString('ko-KR')}원`;

export default function PartnerMallPage() {
  const params = useParams();
  const router = useRouter();
  const rawShareToken = params.shareToken;
  const shareToken = Array.isArray(rawShareToken)
    ? rawShareToken[0]
    : (rawShareToken as string);

  const [mall, setMall] = useState<PartnerMallPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesmanCoupon, setSalesmanCoupon] = useState<SalesmanCouponPayload | null>(null);

  // Product detail sheet state
  const [selectedProduct, setSelectedProduct] = useState<PartnerMallProductPublic | null>(null);
  const [isSavingCart, setIsSavingCart] = useState(false);

  // 다중 side 미리보기(앞/뒤/옆 등). selectedProduct 변경 시 클라이언트에서 fabric으로 합성
  const [sidePreviews, setSidePreviews] = useState<SidePreview[]>([]);
  const [previewsLoading, setPreviewsLoading] = useState(false);

  // Add product modal state
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Check auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  const fetchMall = async () => {
    if (!shareToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/partner-mall/${shareToken}`);
      if (!res.ok) {
        throw new Error('찾을 수 없는 페이지입니다.');
      }
      const result = await res.json();
      setMall(result.data);

      // 영업사원 owner mall이면 그 영업사원의 활성 할인코드를 sessionStorage에 저장 → checkout에서 자동 적용
      const auto = result.data?.salesman_coupon as SalesmanCouponPayload | null | undefined;
      if (auto) {
        setSalesmanCoupon(auto);
        const payload: MallAutoCoupon = {
          code: auto.code,
          discount_type: auto.discount_type,
          discount_value: auto.discount_value,
          min_order_amount: auto.min_order_amount,
          max_discount_amount: auto.max_discount_amount,
          source_mall_id: result.data.id,
          source_mall_name: result.data.name,
          applied_at: new Date().toISOString(),
        };
        setMallAutoCoupon(payload);
      } else {
        setSalesmanCoupon(null);
        clearMallAutoCoupon();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch partner mall data
  useEffect(() => {
    fetchMall();
  }, [shareToken]);

  const products = useMemo(
    () => mall?.partner_mall_products || [],
    [mall]
  );

  const basePrice = selectedProduct?.product?.base_price ?? 0;

  // Calculate additional printing cost from logo placements
  const additionalPrice = useMemo(() => {
    if (!selectedProduct?.product?.configuration || !selectedProduct?.logo_placements) return 0;
    return calculateLogoAdditionalPrice(
      selectedProduct.product.configuration,
      selectedProduct.logo_placements
    );
  }, [selectedProduct]);

  // Use set price if available, otherwise calculate from base + additional
  const pricePerItem = selectedProduct?.price ?? (basePrice + additionalPrice);

  // Get product price - use set price if available, otherwise calculate
  const getProductPrice = (mp: PartnerMallProductPublic): number => {
    // If custom price is set, use it
    if (mp.price !== null && mp.price !== undefined) {
      return mp.price;
    }
    // Otherwise calculate from base price + logo additional price
    const base = mp.product?.base_price ?? 0;
    if (!mp.product?.configuration || !mp.logo_placements) return base;
    return base + calculateLogoAdditionalPrice(mp.product.configuration, mp.logo_placements);
  };

  // 영업사원 할인코드 적용 후 가격 (percentage 만 per-item 표시 가능)
  const applySalesmanDiscount = (price: number): number | null => {
    if (!salesmanCoupon || salesmanCoupon.discount_type !== 'percentage') return null;
    const discounted = Math.floor(price * (1 - salesmanCoupon.discount_value / 100));
    return Math.max(0, discounted);
  };

  const openProductSheet = (product: PartnerMallProductPublic) => {
    setSelectedProduct(product);
    setSidePreviews([]);
  };

  const closeProductSheet = () => {
    setSelectedProduct(null);
    setSidePreviews([]);
  };

  // 선택된 제품이 바뀌면 sideId별 합성 미리보기 생성 (클라이언트 사이드 fabric)
  useEffect(() => {
    let cancelled = false;
    if (!selectedProduct?.product) {
      setSidePreviews([]);
      return;
    }
    setPreviewsLoading(true);
    renderPartnerMallSidePreviews(selectedProduct.product, selectedProduct)
      .then((results) => {
        if (!cancelled) setSidePreviews(results);
      })
      .catch((err) => {
        console.warn('[mall] side previews failed:', err);
        if (!cancelled) setSidePreviews([]);
      })
      .finally(() => {
        if (!cancelled) setPreviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProduct]);

  // 사이즈별 다중 수량을 한 번에 처리. 첫 호출에서 만들어진 saved_design을 후속 호출이 재사용.
  const handleConfirmCart = async (
    designName: string,
    selectedItems: CartItem[],
    purchaseType: 'direct' | 'cart',
  ) => {
    if (!selectedProduct?.product) return;

    if (!isLoggedIn) {
      router.push(`/login?redirect=/mall/${shareToken}`);
      return;
    }

    setIsSavingCart(true);
    try {
      const product = selectedProduct.product;
      let sharedDesignId: string | undefined;
      const newCartItemIds: string[] = [];

      for (const item of selectedItems) {
        const dbCartItem = await addToCartDB({
          productId: product.id,
          productTitle: selectedProduct.display_name || product.title,
          productColor: selectedProduct.color_hex || '',
          productColorName: selectedProduct.color_name || '',
          productColorCode: selectedProduct.color_code || '',
          size: item.size,
          quantity: item.quantity,
          pricePerItem,
          canvasState: (selectedProduct.canvas_state || {}) as Record<string, string>,
          thumbnailUrl: selectedProduct.preview_url || product.thumbnail_image_link?.[0] || '',
          previewImage: selectedProduct.preview_url || undefined,
          designName,
          savedDesignId: sharedDesignId,
          partnerMallId: mall?.id ?? null,
        });

        if (dbCartItem?.id) {
          newCartItemIds.push(dbCartItem.id);
        }
        if (!sharedDesignId && dbCartItem?.saved_design_id) {
          sharedDesignId = dbCartItem.saved_design_id;
        }
      }

      if (purchaseType === 'direct' && newCartItemIds.length > 0) {
        sessionStorage.setItem(
          'directCheckoutItemIds',
          JSON.stringify(newCartItemIds),
        );
      }
    } catch (err) {
      console.error('[mall/shareToken] handleConfirmCart error:', err);
      throw err;
    } finally {
      setIsSavingCart(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error || !mall) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error || '페이지를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header back />

      {/* Mall header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 flex flex-col items-center gap-3">
          {mall.logo_url && (
            <img
              src={mall.logo_url}
              alt={mall.name}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg"
            />
          )}
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">{mall.name}</h1>
        </div>
      </div>

      {/* 영업사원 할인코드 자동 적용 배너 */}
      {salesmanCoupon && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">🎟️</span>
              <div className="min-w-0">
                <div className="text-[12px] sm:text-sm font-bold text-blue-900 truncate">
                  {salesmanCoupon.discount_type === 'percentage'
                    ? `${salesmanCoupon.discount_value}% 할인 자동 적용`
                    : `${salesmanCoupon.discount_value.toLocaleString()}원 할인 자동 적용`}
                </div>
                <div className="text-[10px] sm:text-[11px] text-blue-700">
                  결제 시 코드 <span className="font-mono font-bold">{salesmanCoupon.code}</span>가 자동 입력됩니다
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {products.map((mp) => (
            <button
              key={mp.id}
              onClick={() => openProductSheet(mp)}
              className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="aspect-square bg-gray-100 relative">
                {mp.preview_url ? (
                  <img
                    src={mp.preview_url}
                    alt={mp.display_name || mp.product?.title || ''}
                    className="w-full h-full object-contain p-2"
                  />
                ) : mp.product?.thumbnail_image_link?.[0] ? (
                  <img
                    src={mp.product.thumbnail_image_link[0]}
                    alt={mp.display_name || mp.product?.title || ''}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-300" />
                  </div>
                )}
                {mp.color_hex && (
                  <span
                    className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: mp.color_hex }}
                  />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-800 line-clamp-2">
                  {mp.display_name || mp.product?.title || '제품'}
                </p>
                {mp.product && (() => {
                  const original = getProductPrice(mp);
                  const discounted = applySalesmanDiscount(original);
                  if (discounted !== null && discounted < original) {
                    return (
                      <div className="mt-1">
                        <p className="text-[11px] text-gray-400 line-through">{formatPrice(original)}</p>
                        <p className="text-sm font-bold text-blue-700">{formatPrice(discounted)}</p>
                      </div>
                    );
                  }
                  return (
                    <p className="text-sm font-semibold text-gray-900 mt-1">{formatPrice(original)}</p>
                  );
                })()}
              </div>
            </button>
          ))}

          {/* Add product card */}
          <button
            onClick={() => setShowAddProduct(true)}
            className="rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-2 aspect-3/4"
          >
            <Plus className="w-8 h-8 text-gray-400" />
            <span className="text-xs text-gray-400">제품 추가</span>
          </button>
        </div>
      </div>

      {/* Product purchase modal — 사이즈별 수량 입력 + 사이즈표 + 다중 side 미리보기 */}
      {selectedProduct && (
        <QuantitySelectorModal
          isOpen={!!selectedProduct}
          onClose={closeProductSheet}
          onConfirm={handleConfirmCart}
          sizeOptions={selectedProduct.product?.size_options ?? []}
          pricePerItem={applySalesmanDiscount(pricePerItem) ?? pricePerItem}
          isSaving={isSavingCart}
          defaultDesignName={
            selectedProduct.display_name ||
            selectedProduct.product?.title ||
            ''
          }
          sizingChartImage={selectedProduct.product?.sizing_chart_image ?? null}
          productId={selectedProduct.product?.id}
          previewSlot={
            <SidePreviewCarousel
              fallbackUrl={
                selectedProduct.preview_url ||
                selectedProduct.product?.thumbnail_image_link?.[0] ||
                null
              }
              previews={sidePreviews}
              loading={previewsLoading}
            />
          }
        />
      )}

      {/* (definition below) Add product modal */}
      {showAddProduct && mall && (
        <AddProductModal
          shareToken={shareToken}
          mallName={mall.name}
          logoUrl={mall.logo_url}
          onClose={() => setShowAddProduct(false)}
          onProductAdded={() => {
            setShowAddProduct(false);
            fetchMall();
          }}
        />
      )}
    </div>
  );
}

/**
 * 다중 side 가로 캐러셀. fabric 합성 결과(SidePreview[])를 받아 표시.
 * 합성 실패 또는 로딩 중일 때는 fallback 이미지(partner_mall_products.preview_url 등)로.
 */
function SidePreviewCarousel({
  previews,
  loading,
  fallbackUrl,
}: {
  previews: SidePreview[];
  loading: boolean;
  fallbackUrl: string | null;
}) {
  if (loading && previews.length === 0) {
    return (
      <div className="aspect-square w-full max-w-[320px] mx-auto bg-gray-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (previews.length === 0) {
    return (
      <div className="aspect-square w-full max-w-[320px] mx-auto bg-gray-100 rounded-xl overflow-hidden">
        {fallbackUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fallbackUrl}
            alt=""
            className="w-full h-full object-contain p-3"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
        )}
      </div>
    );
  }

  if (previews.length === 1) {
    return (
      <div className="aspect-square w-full max-w-[320px] mx-auto bg-gray-100 rounded-xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previews[0].dataUrl}
          alt={previews[0].sideName}
          className="w-full h-full object-contain p-3"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {previews.map((p) => (
          <figure
            key={p.sideId}
            className="snap-center shrink-0 w-[260px] sm:w-[300px]"
          >
            <div className="aspect-square w-full bg-gray-100 rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt={p.sideName}
                className="w-full h-full object-contain p-3"
              />
            </div>
            <figcaption className="mt-1.5 text-center text-[11px] text-gray-500">
              {p.sideName}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] text-gray-400">
        좌우로 넘기면서 앞·뒤·옆면 확인
      </p>
    </div>
  );
}
