'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Package,
  Pencil,
} from 'lucide-react';
import { PartnerMallPublic, PartnerMallProductPublic, SizeOption } from '@/types/types';
import { addToCartDB } from '@/lib/cartService';
import { createClient } from '@/lib/supabase-client';
import { calculateLogoAdditionalPrice } from '@/lib/partnerMallPricing';
import Header from '@/app/components/Header';
import AddProductModal from './AddProductModal';

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

  // Product detail sheet state
  const [selectedProduct, setSelectedProduct] = useState<PartnerMallProductPublic | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

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

  // Get size options for selected product
  const sizeOptions: SizeOption[] = useMemo(() => {
    if (!selectedProduct?.product?.size_options) return [];
    return selectedProduct.product.size_options;
  }, [selectedProduct]);

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

  const openProductSheet = (product: PartnerMallProductPublic) => {
    setSelectedProduct(product);
    setSelectedSize('');
    setQuantity(1);
    setCartError(null);
    setAddedToCart(false);
  };

  const closeProductSheet = () => {
    setSelectedProduct(null);
    setCartError(null);
    setAddedToCart(false);
  };

  // Navigate to the editor with the partner mall product's canvas state
  const handleEditDesign = () => {
    if (!selectedProduct?.product || !mall) return;

    sessionStorage.setItem('partnerMallAddData', JSON.stringify({
      shareToken,
      mallName: mall.name,
      logoUrl: mall.logo_url,
      displayName: selectedProduct.display_name || selectedProduct.product.title,
      manufacturerColorId: null,
      colorHex: selectedProduct.color_hex || null,
      colorName: selectedProduct.color_name || null,
      colorCode: selectedProduct.color_code || null,
      // Existing product: include ID + canvas state for update
      existingId: selectedProduct.id,
      canvasState: selectedProduct.canvas_state || {},
    }));

    router.push(`/editor/${selectedProduct.product.id}?partnerMallAdd=true`);
  };

  const handleAddToCart = async () => {
    if (!selectedProduct || !selectedSize) return;

    if (!isLoggedIn) {
      router.push(`/login?redirect=/mall/${shareToken}`);
      return;
    }

    setIsAddingToCart(true);
    setCartError(null);

    try {
      const product = selectedProduct.product;
      if (!product) throw new Error('제품 정보를 찾을 수 없습니다.');

      const result = await addToCartDB({
        productId: product.id,
        productTitle: selectedProduct.display_name || product.title,
        productColor: selectedProduct.color_hex || '',
        productColorName: selectedProduct.color_name || '',
        productColorCode: selectedProduct.color_code || '',
        size: selectedSize,
        quantity,
        pricePerItem,
        canvasState: (selectedProduct.canvas_state || {}) as Record<string, string>,
        thumbnailUrl: selectedProduct.preview_url || product.thumbnail_image_link?.[0] || '',
        previewImage: selectedProduct.preview_url || undefined,
        designName: selectedProduct.display_name || product.title,
      });

      if (!result) {
        throw new Error('장바구니 추가에 실패했습니다.');
      }

      setAddedToCart(true);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsAddingToCart(false);
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
                {mp.product && (
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {formatPrice(getProductPrice(mp))}
                  </p>
                )}
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

      {/* Product detail bottom sheet */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeProductSheet}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col sm:relative sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:rounded-2xl sm:max-h-[80vh] sm:bottom-auto">
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={closeProductSheet}
              className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-full z-10"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-5">
              {/* Product image */}
              <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4 max-w-[280px] mx-auto">
                {selectedProduct.preview_url ? (
                  <img
                    src={selectedProduct.preview_url}
                    alt={selectedProduct.display_name || ''}
                    className="w-full h-full object-contain p-3"
                  />
                ) : selectedProduct.product?.thumbnail_image_link?.[0] ? (
                  <img
                    src={selectedProduct.product.thumbnail_image_link[0]}
                    alt={selectedProduct.display_name || ''}
                    className="w-full h-full object-contain p-3"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Product info */}
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {selectedProduct.display_name || selectedProduct.product?.title || '제품'}
              </h2>
              {selectedProduct.color_name && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-gray-200"
                    style={{ backgroundColor: selectedProduct.color_hex || undefined }}
                  />
                  <span className="text-xs text-gray-500">{selectedProduct.color_name}</span>
                </div>
              )}

              {/* Price breakdown */}
              <div className="mt-2">
                <p className="text-lg font-bold text-gray-900">
                  {formatPrice(pricePerItem)}
                </p>
                {/* Only show breakdown if using calculated price (not set price) */}
                {!selectedProduct.price && additionalPrice > 0 && (
                  <p className="text-xs text-gray-500">
                    제품 {formatPrice(basePrice)} + 인쇄비 {formatPrice(additionalPrice)}
                  </p>
                )}
              </div>

              {/* Edit design button */}
              <button
                onClick={handleEditDesign}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                디자인 편집하기
              </button>

              {/* Size selector */}
              {sizeOptions.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사이즈 선택
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((size) => (
                      <button
                        key={size.label}
                        onClick={() => setSelectedSize(size.label)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          selectedSize === size.label
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity selector */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  수량
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-base font-medium w-10 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Total price */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-600">총 금액</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatPrice(pricePerItem * quantity)}
                </span>
              </div>

              {cartError && (
                <p className="mt-3 text-sm text-red-600">{cartError}</p>
              )}
            </div>

            {/* Footer - Add to cart button */}
            <div className="p-4 border-t border-gray-200 pb-safe">
              {addedToCart ? (
                <div className="flex gap-3">
                  <button
                    onClick={closeProductSheet}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    계속 쇼핑하기
                  </button>
                  <button
                    onClick={() => router.push('/cart')}
                    className="flex-1 py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    장바구니 보기
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={
                    isAddingToCart || (!selectedSize && sizeOptions.length > 0)
                  }
                  className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAddingToCart ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      추가 중...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      장바구니에 담기
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
