'use client';

import dynamic from 'next/dynamic';
import { trySessionSet } from '@/lib/quotaSafeStorage';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Layers3,
  Loader2,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import Header from '@/app/components/Header';
import QuantitySelectorModal from '@/app/components/QuantitySelectorModal';
import { addToCartDB } from '@/lib/cartService';
import { calculateLogoAdditionalPrice } from '@/lib/partnerMallPricing';
import { clearMallAutoCoupon, setMallAutoCoupon, type MallAutoCoupon } from '@/lib/mallSalesmanCoupon';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { CartItem, PartnerMallProductPublic, PartnerMallPublic } from '@/types/types';

const DesignEditorViewer = dynamic(
  () => import('@/app/components/cobuy/DesignEditorViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[410px] items-center justify-center bg-[#f3f1ed]">
        <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
      </div>
    ),
  },
);

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

function getCanvasState(product: PartnerMallProductPublic): Record<string, string> {
  const source = (product.canvas_state || {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => typeof value === 'string'),
  ) as Record<string, string>;
}

export default function PartnerMallPage() {
  const params = useParams();
  const rawShareToken = params.shareToken;
  const shareToken = Array.isArray(rawShareToken)
    ? rawShareToken[0]
    : (rawShareToken as string);

  const [mall, setMall] = useState<PartnerMallPublic | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PartnerMallProductPublic | null>(null);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesmanCoupon, setSalesmanCoupon] = useState<SalesmanCouponPayload | null>(null);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!shareToken) return;
    let alive = true;

    const loadMall = async () => {
      try {
        const res = await fetch(`/api/partner-mall/${encodeURIComponent(shareToken)}`);
        if (!res.ok) throw new Error('찾을 수 없는 페이지입니다.');
        const result = await res.json();
        if (!alive) return;

        setMall(result.data);

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
        if (!alive) return;
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    loadMall();
    return () => {
      alive = false;
    };
  }, [shareToken]);

  useEffect(() => {
    if (!selectedProduct) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedProduct(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedProduct]);

  const products = useMemo(() => mall?.partner_mall_products || [], [mall]);
  const isFranchiseExpoMall = mall?.source_key?.startsWith('franchise-coex:84:') ?? false;

  const getBaseProductPrice = (product: PartnerMallProductPublic): number => {
    if (product.price !== null && product.price !== undefined) return product.price;
    const base = product.product?.base_price ?? 0;
    if (!product.product?.configuration || !product.logo_placements) return base;
    return base + calculateLogoAdditionalPrice(product.product.configuration, product.logo_placements);
  };

  const getProductPrice = (product: PartnerMallProductPublic): number => {
    const basePrice = getBaseProductPrice(product);
    return isFranchiseExpoMall ? Math.round(basePrice * 0.7) : basePrice;
  };

  const applySalesmanDiscount = (price: number): number | null => {
    if (!salesmanCoupon || salesmanCoupon.discount_type !== 'percentage') return null;
    const discounted = Math.floor(price * (1 - salesmanCoupon.discount_value / 100));
    return Math.max(0, discounted);
  };

  const getFinalProductPrice = (product: PartnerMallProductPublic): number => {
    const partnerPrice = getProductPrice(product);
    return applySalesmanDiscount(partnerPrice) ?? partnerPrice;
  };

  const openProductOrder = (product: PartnerMallProductPublic) => {
    setSelectedProduct(product);
    setIsQuantityModalOpen(true);
  };

  const handlePartnerMallOrder = async (
    designName: string,
    selectedItems: CartItem[],
    _purchaseType: 'direct' | 'cart',
    frozenPricePerItem?: number,
  ) => {
    if (!selectedProduct?.product || !mall) {
      throw new Error('주문할 디자인을 찾을 수 없습니다.');
    }

    const product = selectedProduct.product;
    const productTitle = selectedProduct.display_name || product.title;
    const productColor = selectedProduct.color_hex || '#FFFFFF';
    const productColorName = selectedProduct.color_name || '색상';
    const price = typeof frozenPricePerItem === 'number' && frozenPricePerItem > 0
      ? frozenPricePerItem
      : getProductPrice(selectedProduct);
    const canvasState = getCanvasState(selectedProduct);
    const thumbnailUrl = selectedProduct.preview_url || product.thumbnail_image_link?.[0] || undefined;

    setIsOrdering(true);
    try {
      if (!isAuthenticated) {
        const guestDesignId = `guest-${product.id}-partner-mall-${Date.now()}`;
        for (const item of selectedItems) {
          useCartStore.getState().addItem({
            productId: product.id,
            productTitle,
            productColor,
            productColorName,
            productColorCode: selectedProduct.color_code || undefined,
            size: item.size,
            quantity: item.quantity,
            pricePerItem: price,
            canvasState,
            thumbnailUrl,
            savedDesignId: guestDesignId,
            designName,
            previewImage: selectedProduct.preview_url || undefined,
            partnerMallId: mall.id,
          });
        }

        const directItemIds = useCartStore.getState().items
          .filter((item) => item.savedDesignId === guestDesignId)
          .map((item) => item.id);
        trySessionSet('directCheckoutItemIds', JSON.stringify(directItemIds));
        return;
      }

      let savedDesignId: string | undefined;
      const directItemIds: string[] = [];
      for (const item of selectedItems) {
        const dbCartItem = await addToCartDB({
          productId: product.id,
          productTitle,
          productColor,
          productColorName,
          productColorCode: selectedProduct.color_code || undefined,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: price,
          canvasState,
          thumbnailUrl,
          savedDesignId,
          designName,
          previewImage: selectedProduct.preview_url || undefined,
          partnerMallId: mall.id,
        });

        if (!dbCartItem?.id) {
          throw new Error('주문 상품을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
        directItemIds.push(dbCartItem.id);
        savedDesignId = savedDesignId || dbCartItem.saved_design_id;

        useCartStore.getState().addItem({
          productId: product.id,
          productTitle,
          productColor,
          productColorName,
          productColorCode: selectedProduct.color_code || undefined,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: price,
          canvasState,
          thumbnailUrl,
          savedDesignId,
          designName,
          previewImage: selectedProduct.preview_url || undefined,
          partnerMallId: mall.id,
        });
      }

      trySessionSet('directCheckoutItemIds', JSON.stringify(directItemIds));
    } finally {
      setIsOrdering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !mall) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4] px-4">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
          <p className="text-neutral-500">{error || '페이지를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-neutral-950">
      <Header back />

      <main>
        <section className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 pb-9 pt-8 sm:px-8 sm:pb-12 sm:pt-12">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                {mall.logo_url ? (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:h-24 sm:w-24">
                    <img src={mall.logo_url} alt="" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white sm:h-24 sm:w-24">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">Official uniform shop</p>
                  <h1 className="text-2xl font-black tracking-tight sm:text-4xl">{mall.name}</h1>
                  <p className="mt-2 text-sm text-neutral-500 sm:text-base">원하는 디자인을 확인하고 사이즈·수량을 선택해 바로 주문하세요.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <a
                      href="https://pf.kakao.com/_xjSdYG/chat"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f4d33d] bg-[#fee500] px-4 font-bold text-[#3c1e1e] transition hover:brightness-95"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      카카오톡으로 문의하기
                    </a>
                    <a
                      href="tel:01081400621"
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 font-bold text-neutral-800 transition hover:border-neutral-500"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      010-8140-0621
                    </a>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-neutral-500 sm:text-sm">
                    수량에 따라 가격 할인이 가능합니다.<br />
                    기본 의류 외에도 기능성, 앞치마, 모자 등 제작 가능합니다.<br />
                    편히 문의 부탁드립니다.
                  </p>
                  {isFranchiseExpoMall && (
                    <p className="mt-2 text-xs font-semibold leading-5 text-neutral-700 sm:text-sm">
                      할인가에 본사 납품 제공.<br />
                      지점 판매가 조정 가능.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>{products.length}개 디자인 준비됨</span>
              </div>
            </div>
          </div>
        </section>

        {salesmanCoupon && (
          <section className="border-b border-amber-200 bg-[#fff8e7]">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 text-sm sm:px-8">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">%</span>
              <p className="text-amber-950">
                <strong>{salesmanCoupon.discount_type === 'percentage' ? `${salesmanCoupon.discount_value}% 할인` : `${salesmanCoupon.discount_value.toLocaleString()}원 할인`}</strong>
                이 자동 적용됩니다.
                <span className="ml-1 text-xs text-amber-800">{isAuthenticated ? '결제 시 적용' : '로그인 후 결제 시 적용'}</span>
              </p>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Choose your design</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">주문할 디자인을 골라보세요</h2>
            </div>
            <p className="hidden text-sm text-neutral-500 sm:block">카드를 누르면 앞면·뒷면·양옆을 크게 볼 수 있어요.</p>
          </div>

          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
              <p className="font-semibold text-neutral-700">아직 등록된 디자인이 없습니다.</p>
              <p className="mt-1 text-sm text-neutral-500">대표자에게 디자인 등록을 요청해주세요.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const originalPrice = getBaseProductPrice(product);
                const partnerPrice = getProductPrice(product);
                const discountedPrice = applySalesmanDiscount(partnerPrice);
                const finalPrice = discountedPrice ?? partnerPrice;
                const sideNames = product.product?.configuration?.map((side) => side.name).filter(Boolean) || [];

                return (
                  <article key={product.id} className="group overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_30px_rgba(28,25,23,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(28,25,23,0.1)]">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="relative block aspect-[1.08] w-full overflow-hidden bg-[#f1efeb] text-left"
                      aria-label={`${product.display_name || product.product?.title || '디자인'} 상세 보기`}
                    >
                      {product.preview_url ? (
                        <img src={product.preview_url} alt="" className="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-[1.03]" />
                      ) : product.product?.thumbnail_image_link?.[0] ? (
                        <img src={product.product.thumbnail_image_link[0]} alt="" className="h-full w-full object-contain p-5 transition duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-neutral-300" /></div>
                      )}
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-neutral-700 shadow-sm backdrop-blur">
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> 완성 디자인
                      </span>
                      <span className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full bg-neutral-950/85 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                        자세히 보기 <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </button>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-black text-neutral-900">{product.display_name || product.product?.title || '제품'}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                            {product.color_name && <span>{product.color_name}</span>}
                            {sideNames.length > 0 && <span className="inline-flex items-center gap-1"><Layers3 className="h-3.5 w-3.5" /> {sideNames.length}면 디자인</span>}
                          </div>
                        </div>
                        {product.color_hex && <span className="mt-1 h-5 w-5 shrink-0 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundColor: product.color_hex }} aria-label={product.color_name || '상품 색상'} />}
                      </div>

                      <div className="mt-5 flex items-end justify-between gap-3">
                        <div>
                          {finalPrice < originalPrice && <p className="text-xs text-neutral-400 line-through">{formatPrice(originalPrice)}</p>}
                          <p className="text-lg font-black text-neutral-950">{formatPrice(finalPrice)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-700"
                        >
                          디자인 확인 <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {selectedProduct && selectedProduct.product && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 px-0 pb-0 pt-14 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={() => setSelectedProduct(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-design-title"
            className="flex max-h-[calc(100dvh-3.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[28px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Design preview</p>
                <h2 id="partner-design-title" className="truncate text-lg font-black sm:text-xl">{selectedProduct.display_name || selectedProduct.product.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200" aria-label="닫기">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto">
              <div className="bg-[#f3f1ed] px-3 py-4 sm:px-8 sm:py-6">
                {selectedProduct.product.configuration?.length ? (
                  <DesignEditorViewer
                    config={{ productId: selectedProduct.product.id, sides: selectedProduct.product.configuration }}
                    canvasState={getCanvasState(selectedProduct)}
                    productColor={selectedProduct.color_hex || '#FFFFFF'}
                    layout="carousel"
                    fallbackImageUrl={selectedProduct.preview_url}
                  />
                ) : selectedProduct.preview_url ? (
                  <div className="flex h-[410px] items-center justify-center"><img src={selectedProduct.preview_url} alt="" className="max-h-full max-w-full object-contain" /></div>
                ) : (
                  <div className="flex h-[410px] items-center justify-center"><Package className="h-12 w-12 text-neutral-300" /></div>
                )}
              </div>

              <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                    {selectedProduct.color_name && <span>{selectedProduct.color_name}</span>}
                    {selectedProduct.product.configuration?.map((side) => side.name).filter(Boolean).length ? <><span className="text-neutral-300">·</span><span>앞면·뒷면·양옆 확인 가능</span></> : null}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    {getFinalProductPrice(selectedProduct) < getBaseProductPrice(selectedProduct) && <span className="text-sm text-neutral-400 line-through">{formatPrice(getBaseProductPrice(selectedProduct))}</span>}
                    <strong className="text-2xl font-black">{formatPrice(getFinalProductPrice(selectedProduct))}</strong>
                    <span className="text-xs text-neutral-500">/ 1장 기준</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openProductOrder(selectedProduct)}
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-6 text-base font-black text-white transition hover:bg-neutral-700 sm:w-auto sm:min-w-[230px]"
                >
                  사이즈·수량 선택하고 주문하기 <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProduct?.product && (
        <QuantitySelectorModal
          isOpen={isQuantityModalOpen}
          onClose={() => setIsQuantityModalOpen(false)}
          onConfirm={handlePartnerMallOrder}
          sizeOptions={selectedProduct.product.size_options || []}
          pricePerItem={getProductPrice(selectedProduct)}
          isSaving={isOrdering}
          defaultDesignName={selectedProduct.display_name || selectedProduct.product.title}
          hideDesignName
          directPurchaseOnly
          sizingChartImage={selectedProduct.product.sizing_chart_image}
          sizingData={selectedProduct.product.sizing_data}
          productId={selectedProduct.product.id}
          previewSlot={
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <Check className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-emerald-900">완성된 디자인으로 주문합니다</p>
                <p className="mt-0.5 text-xs text-emerald-700">수정 없이 사이즈별 수량만 선택하면 배송지 입력으로 이동합니다.</p>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
