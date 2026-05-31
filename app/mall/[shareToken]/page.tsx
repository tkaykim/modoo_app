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
} from '@/types/types';
import { calculateLogoAdditionalPrice } from '@/lib/partnerMallPricing';
import { setMallAutoCoupon, clearMallAutoCoupon, type MallAutoCoupon } from '@/lib/mallSalesmanCoupon';
import Header from '@/app/components/Header';
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

  // Add product modal state
  const [showAddProduct, setShowAddProduct] = useState(false);

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

  // Get product price - use set price if available, otherwise calculate
  const getProductPrice = (mp: PartnerMallProductPublic): number => {
    if (mp.price !== null && mp.price !== undefined) return mp.price;
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

  // 카드 클릭 → 에디터로 이동. 에디터가 단체몰 디자인을 실제 캔버스에 restore해서
  // 사용자가 그대로 또는 약간 수정해서 주문할 수 있게 한다. 미리보기/장바구니/게스트 처리
  // 모두 에디터 흐름을 그대로 재사용 (modoo_app의 단일 주문 흐름).
  const openProductInEditor = (mp: PartnerMallProductPublic) => {
    if (!mp.product || !mall) return;
    try {
      sessionStorage.setItem(
        'partnerMallBuyData',
        JSON.stringify({
          shareToken,
          partnerMallId: mall.id,
          displayName: mp.display_name || mp.product.title,
          colorHex: mp.color_hex || null,
          colorName: mp.color_name || null,
          colorCode: mp.color_code || null,
          // 영업사원이 정한 진열 판매가 — 에디터/결제 단가의 바닥값으로 사용(마진 보존).
          price: (mp.price !== null && mp.price !== undefined) ? mp.price : null,
          canvasState: mp.canvas_state || {},
        }),
      );
    } catch (err) {
      console.warn('[mall] failed to persist partnerMallBuyData', err);
    }
    router.push(`/editor/${mp.product.id}?partnerMallBuy=1`);
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
              onClick={() => openProductInEditor(mp)}
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

      {/* Add product modal */}
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
