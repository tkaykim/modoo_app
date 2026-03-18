'use client';

import Header from '@/app/components/Header';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DesignEditModal from '@/app/components/DesignEditModal';
import QuantityChangeModal from '@/app/components/QuantityChangeModal';
import {
  getCartItemsWithDesigns,
  removeCartItem,
  updateCartItemQuantity,
  clearCart as clearCartDB,
  type CartItemWithDesign
} from '@/lib/cartService';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { SizeOption, DiscountTier } from '@/types/types';
import { generateOrderId } from '@/lib/orderIdUtils';

// Group items by saved design ID
interface GroupedCartItem {
  savedDesignId: string;
  thumbnailUrl?: string;
  productTitle: string;
  designName?: string;
  items: CartItemWithDesign[];
  totalQuantity: number;
  totalPrice: number;
}

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const cartStore = useCartStore();
  const [items, setItems] = useState<CartItemWithDesign[]>([]);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [quantityChangeGroup, setQuantityChangeGroup] = useState<GroupedCartItem | null>(null);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);
  const [productSizeOptions, setProductSizeOptions] = useState<Record<string, SizeOption[]>>({});
  const [productDiscountRates, setProductDiscountRates] = useState<Record<string, DiscountTier[]>>({});
  const [isTestModeProcessing, setIsTestModeProcessing] = useState(false);

  // Check if test mode is enabled
  const isTestMode = process.env.NEXT_PUBLIC_TESTMODE === 'true';

  // Transform guest cart store items to CartItemWithDesign format
  const getGuestCartItems = (): CartItemWithDesign[] => {
    return cartStore.items.map(item => ({
      id: item.id,
      product_id: item.productId,
      product_title: item.productTitle,
      product_color: item.productColor,
      product_color_name: item.productColorName,
      product_color_code: item.productColorCode,
      size_id: item.size,
      size_name: item.size,
      quantity: item.quantity,
      price_per_item: item.pricePerItem,
      thumbnail_url: item.thumbnailUrl,
      saved_design_id: item.savedDesignId,
      designName: item.designName,
      canvasState: item.canvasState,
    }));
  };

  // Fetch cart items - from DB for authenticated users, from store for guests
  const fetchCartItems = async () => {
    setIsLoading(true);
    try {
      let cartItems: CartItemWithDesign[];

      if (isAuthenticated) {
        cartItems = await getCartItemsWithDesigns();
      } else {
        cartItems = getGuestCartItems();
      }

      setItems(cartItems);

      // Fetch product details for each unique product
      const uniqueProductIds = [...new Set(cartItems.map(item => item.product_id))];
      const productOptions: Record<string, SizeOption[]> = {};
      const discountRates: Record<string, DiscountTier[]> = {};

      for (const productId of uniqueProductIds) {
        try {
          const { createClient } = await import('@/lib/supabase-client');
          const supabase = createClient();
          const { data: product, error } = await supabase
            .from('products')
            .select('size_options, discount_rates')
            .eq('id', productId)
            .single();

          if (!error && product) {
            if (product.size_options) {
              productOptions[productId] = product.size_options;
            }
            if (product.discount_rates) {
              discountRates[productId] = product.discount_rates;
            }
          }
        } catch (err) {
          console.error(`Error fetching product ${productId}:`, err);
        }
      }

      setProductSizeOptions(productOptions);
      setProductDiscountRates(discountRates);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    } finally {
      setIsLoading(false);
      setIsMounted(true);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCartItems();
  }, [isAuthenticated]);

  // Group items by saved_design_id
  const groupedItems: GroupedCartItem[] = items.reduce((acc: GroupedCartItem[], item: CartItemWithDesign) => {
    const designId = item.saved_design_id || item.id; // Fallback to item.id if no saved_design_id
    const existingGroup = acc.find((g: GroupedCartItem) => g.savedDesignId === designId);

    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.totalQuantity += item.quantity;
      existingGroup.totalPrice += item.price_per_item * item.quantity;
    } else {
      acc.push({
        savedDesignId: designId!,
        thumbnailUrl: item.thumbnail_url,
        productTitle: item.product_title,
        designName: item.designName,
        items: [item],
        totalQuantity: item.quantity,
        totalPrice: item.price_per_item * item.quantity,
      });
    }

    return acc;
  }, [] as GroupedCartItem[]);

  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price_per_item * item.quantity, 0);
  const finalTotal = totalPrice;

  const handleCheckout = () => {
    window.location.href = '/checkout';
  };

  const handleTestModeCheckout = async () => {
    if (items.length === 0) {
      alert('장바구니가 비어있습니다.');
      return;
    }

    setIsTestModeProcessing(true);

    try {
      const orderId = generateOrderId();

      const firstItemName = groupedItems[0]?.designName || groupedItems[0]?.productTitle || '주문 상품';
      const orderName = groupedItems.length > 1
        ? `${firstItemName} 외 ${groupedItems.length - 1}건`
        : firstItemName;

      const orderData = {
        id: orderId,
        name: '테스트 사용자',
        email: 'test@example.com',
        phone_num: '01012345678',
        address: '[12345] 서울시 강남구 테헤란로 123 테스트빌딩 101호',
        country_code: null,
        state: null,
        city: null,
        postal_code: '12345',
        address_line_1: '서울시 강남구 테헤란로 123',
        address_line_2: '테스트빌딩 101호',
        shipping_method: 'domestic' as const,
        delivery_fee: 0,
        total_amount: finalTotal,
      };

      const response = await fetch('/api/checkout/testmode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderData,
          cartItems: items,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('API Error Details:', result);
        throw new Error(result.error || '주문 생성에 실패했습니다.');
      }

      // Clear cart - DB for authenticated, store for guests
      if (isAuthenticated) {
        await clearCartDB();
      }
      cartStore.clearCart();
      await fetchCartItems();

      router.push(`/checkout/success?orderId=${result.orderId}&testMode=true`);
    } catch (error) {
      console.error('Test mode checkout error:', error);
      alert(error instanceof Error ? error.message : '주문 처리 중 오류가 발생했습니다.');
    } finally {
      setIsTestModeProcessing(false);
    }
  };

  const handleEditDesign = (cartItemId: string) => {
    if (!isAuthenticated) return; // Design editing not available for guests
    setSelectedCartItemId(cartItemId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCartItemId(null);
  };

  const handleSaveComplete = () => {
    fetchCartItems();
  };

  // Handle removing an item from cart
  const handleRemoveItem = async (itemId: string) => {
    if (!isAuthenticated) {
      // Guest: remove from store
      cartStore.removeItem(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }
    const success = await removeCartItem(itemId);
    if (success) {
      await fetchCartItems();
    }
  };

  // Handle updating item quantity
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await handleRemoveItem(itemId);
    } else {
      if (!isAuthenticated) {
        // Guest: update in store
        cartStore.updateQuantity(itemId, newQuantity);
        setItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        ));
        return;
      }
      const result = await updateCartItemQuantity(itemId, newQuantity);
      if (result) {
        await fetchCartItems();
      }
    }
  };

  // Handle clearing all cart items
  const handleClearCart = async () => {
    const confirmed = confirm('장바구니를 비우시겠습니까?');
    if (confirmed) {
      if (!isAuthenticated) {
        // Guest: clear store
        cartStore.clearCart();
        setItems([]);
        return;
      }
      const success = await clearCartDB();
      if (success) {
        await fetchCartItems();
      }
    }
  };

  // Handle opening quantity change modal
  const handleOpenQuantityChange = (group: GroupedCartItem) => {
    setQuantityChangeGroup(group);
    setIsQuantityModalOpen(true);
  };

  // Handle quantity changes from modal
  const handleQuantityChanges = async (updates: { itemId?: string; sizeId: string; quantity: number; currentQuantity?: number }[]) => {
    setIsUpdatingQuantity(true);
    try {
      const group = quantityChangeGroup;
      if (!group) return;

      const referenceItem = group.items[0];
      if (!referenceItem) return;

      if (!isAuthenticated) {
        // Guest: update items in store
        for (const update of updates) {
          if (update.itemId) {
            if (update.quantity === 0) {
              cartStore.removeItem(update.itemId);
            } else {
              cartStore.updateQuantity(update.itemId, update.quantity);
            }
          } else if (update.quantity > 0) {
            // Add new item with same design data
            cartStore.addItem({
              productId: referenceItem.product_id,
              productTitle: referenceItem.product_title,
              productColor: referenceItem.product_color,
              productColorName: referenceItem.product_color_name,
              size: update.sizeId,
              quantity: update.quantity,
              pricePerItem: referenceItem.price_per_item,
              canvasState: referenceItem.canvasState || {},
              thumbnailUrl: referenceItem.thumbnail_url,
              designName: referenceItem.designName,
            });
          }
        }
        // Refresh from store
        setItems(getGuestCartItems());
        return;
      }

      // Authenticated: use DB operations
      for (const update of updates) {
        if (update.itemId) {
          if (update.quantity === 0) {
            await handleRemoveItem(update.itemId);
          } else {
            await updateCartItemQuantity(update.itemId, update.quantity);
          }
        } else if (update.quantity > 0) {
          const { createClient } = await import('@/lib/supabase-client');
          const supabase = createClient();

          const sizeOptions = productSizeOptions[referenceItem.product_id] || [];
          const sizeExists = sizeOptions.some((opt) =>
            typeof opt === 'string' ? opt === update.sizeId : opt.label === update.sizeId
          );

          if (!sizeExists) {
            console.error('Size option not found:', update.sizeId);
            continue;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('User must be authenticated');
          }

          const newCartItem = {
            user_id: user.id,
            product_id: referenceItem.product_id,
            saved_design_id: referenceItem.saved_design_id,
            product_title: referenceItem.product_title,
            product_color: referenceItem.product_color,
            product_color_name: referenceItem.product_color_name,
            size_id: update.sizeId,
            size_name: update.sizeId,
            quantity: update.quantity,
            price_per_item: referenceItem.price_per_item,
            thumbnail_url: referenceItem.thumbnail_url,
          };

          const { error } = await supabase
            .from('cart_items')
            .insert(newCartItem);

          if (error) {
            console.error('Error adding new cart item:', error);
            throw error;
          }
        }
      }
      await fetchCartItems();
    } catch (error) {
      console.error('Error updating quantities:', error);
      alert('수량 변경 중 오류가 발생했습니다.');
    } finally {
      setIsUpdatingQuantity(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white z-50 border-b border-gray-200">
        <Header back={true} />
      </div>


      {/* Cart Content */}
      {!isMounted ? (
        // Loading state during hydration
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        // Empty Cart State
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">장바구니가 비어있습니다</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">
            원하는 상품을 담아보세요
          </p>
          <Link
            href="/home"
            className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
          >
            상품 보러가기
          </Link>
        </div>
      ) : (
        <>
          {/* Cart Items List */}
          <div className="bg-white mb-4">
            {/* Clear All Button */}
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-600">전체 {totalQuantity}개 상품</span>
              <button
                onClick={handleClearCart}
                className="text-sm text-gray-500 hover:text-red-600 transition flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                전체삭제
              </button>
            </div>

            {/* Grouped Items */}
            <div className="divide-y divide-gray-100">
              {groupedItems.map((group) => (
                <div key={group.savedDesignId} className="p-4">
                  <div className="flex gap-4">
                    {/* Product Thumbnail */}
                    <div
                      onClick={() => group.items[0]?.id && isAuthenticated && handleEditDesign(group.items[0].id)}
                      className={`w-24 h-24 bg-gray-100 rounded-lg shrink-0 overflow-hidden border border-gray-200 ${isAuthenticated ? 'hover:border-gray-400 transition cursor-pointer' : ''}`}
                    >
                      {group.thumbnailUrl ? (
                        <img
                          src={group.thumbnailUrl}
                          alt={group.productTitle}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div
                            className="w-16 h-16 rounded"
                            style={{ backgroundColor: group.items[0].product_color }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="w-full text-left mb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-black mb-1 truncate">
                              {group.designName || group.productTitle}
                            </h3>
                            {group.designName && (
                              <p className="text-xs text-gray-500 truncate">
                                {group.productTitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Options List */}
                      <div className="space-y-2 mb-2">
                        {group.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-gray-500">
                                {item.product_color_name} / {item.size_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700 font-medium">
                                {item.quantity}개
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveItem(item.id!);
                                }}
                                className="p-0.5 hover:bg-gray-100 rounded transition text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Price and Actions */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">
                            총 {group.totalQuantity}개
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-bold text-black">
                              {group.totalPrice.toLocaleString('ko-KR')}원
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenQuantityChange(group)}
                          className="w-full py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                          수량 변경
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </>
      )}

      {/* Bottom Fixed Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-6">
          {isTestMode && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚠️</span>
                <span className="text-sm font-semibold text-yellow-900">테스트 모드</span>
              </div>
              <button
                onClick={handleTestModeCheckout}
                disabled={isTestModeProcessing}
                className="w-full py-2.5 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                {isTestModeProcessing ? '주문 생성 중...' : '테스트 주문 생성 (더미 데이터)'}
              </button>
            </div>
          )}
          <div className="flex justify-between items-center mb-3">
            <span className="font-medium text-black">총 결제금액</span>
            <span className="text-lg font-bold text-black">
              {finalTotal.toLocaleString('ko-KR')}원
            </span>
          </div>
          <button
            onClick={handleCheckout}
            className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
          >
            주문하기
          </button>
        </div>
      )}

      {/* Design Edit Modal - only for authenticated users */}
      {isAuthenticated && (
        <DesignEditModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          cartItemId={selectedCartItemId}
          onSaveComplete={handleSaveComplete}
        />
      )}

      {/* Quantity Change Modal */}
      {quantityChangeGroup && (
        <QuantityChangeModal
          isOpen={isQuantityModalOpen}
          onClose={() => {
            setIsQuantityModalOpen(false);
            setQuantityChangeGroup(null);
          }}
          onConfirm={handleQuantityChanges}
          items={quantityChangeGroup.items}
          sizeOptions={productSizeOptions[quantityChangeGroup.items[0]?.product_id] || []}
          productColorName={quantityChangeGroup.items[0]?.product_color_name || ''}
          designName={quantityChangeGroup.designName || quantityChangeGroup.productTitle}
          isSaving={isUpdatingQuantity}
          discountRates={productDiscountRates[quantityChangeGroup.items[0]?.product_id]}
        />
      )}
    </div>
  );
}
