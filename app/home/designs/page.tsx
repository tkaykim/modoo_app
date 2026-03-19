'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import DesignEditModal from '@/app/components/DesignEditModal';
import FavoritesList from '@/app/components/FavoritesList';
import Image from 'next/image';
import { createClient } from '@/lib/supabase-client';
import QuantitySelectorModal from '@/app/components/QuantitySelectorModal';
import { addToCartDB } from '@/lib/cartService';
import { useCartStore } from '@/store/useCartStore';
import { deleteDesign } from '@/lib/designService';
import { SizeOption, CartItem, ProductColor } from '@/types/types';
import { ShoppingCart, Search, Trash2, Plus } from 'lucide-react';
import Header from '@/app/components/Header';
import ProductSelectionForDesignModal from '@/app/components/ProductSelectionForDesignModal';

type TabType = 'designs' | 'favorites';

interface SavedDesign {
  id: string;
  title: string | null;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
  price_per_item: number;
  product: {
    id: string;
    title: string;
  };
  color_selections: Record<string, Record<string, string>>;
}

// Raw type from Supabase (product is returned as array)
interface RawSavedDesign {
  id: string;
  title: string | null;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
  price_per_item: number;
  product: {
    id: string;
    title: string;
  }[];
  color_selections: Record<string, Record<string, string>>;
}

export default function DesignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const { addItem: addToCart } = useCartStore();
  const [activeTab, setActiveTab] = useState<TabType>('designs');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Add to cart modal state
  const [isQuantitySelectorOpen, setIsQuantitySelectorOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [productSizeOptions, setProductSizeOptions] = useState<SizeOption[]>([]);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deletingDesignId, setDeletingDesignId] = useState<string | null>(null);

  // Product selection modal state
  const [isProductSelectionModalOpen, setIsProductSelectionModalOpen] = useState(false);

  // Fetch designs from database
  useEffect(() => {
    async function fetchDesigns() {
      if (!isAuthenticated || !user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const supabase = createClient();

        const { data, error: fetchError } = await supabase
          .from('saved_designs')
          .select(`
            id,
            title,
            preview_url,
            created_at,
            updated_at,
            color_selections,
            price_per_item,
            product:products (
              id,
              title
            )
          `)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        // Transform data to match SavedDesign type (product is returned as array)
        const transformedData = (data as RawSavedDesign[])?.map((design) => ({
          ...design,
          product: Array.isArray(design.product) ? design.product[0] : design.product
        })) || [];

        setDesigns(transformedData);
      } catch (err) {
        console.error('Error fetching designs:', err);
        setError('디자인을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDesigns();
  }, [isAuthenticated, user]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'favorites' || tab === 'designs') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('tab', tab);
    router.replace(`/home/designs?${params.toString()}`);
  };

  const handleDesignClick = (itemId: string) => {
    setSelectedItemId(itemId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItemId(null);
  };

  // Handle delete button click
  const handleDeleteClick = async (design: SavedDesign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the edit modal

    const confirmDelete = window.confirm(
      `"${design.title || design.product.title}" 디자인을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmDelete) return;

    try {
      setDeletingDesignId(design.id);

      // Use deleteDesign from designService to delete the design and all associated files
      const success = await deleteDesign(design.id);

      if (!success) {
        throw new Error('Failed to delete design');
      }

      // Remove from local state
      setDesigns((prev) => prev.filter((d) => d.id !== design.id));
    } catch (err) {
      console.error('Error deleting design:', err);
      alert('디자인 삭제에 실패했습니다.');
    } finally {
      setDeletingDesignId(null);
    }
  };

  // Handle add to cart button click
  const handleAddToCartClick = async (design: SavedDesign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the edit modal

    try {
      // Fetch product details including size options and colors
      const supabase = createClient();
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          product_colors (
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
          )
        `)
        .eq('id', design.product.id)
        .single();

      if (productError || !product) {
        throw new Error('Failed to fetch product details');
      }

      // Set product data and open modal
      setSelectedDesign(design);
      setProductSizeOptions(product.size_options || []);
      // Transform product_colors to match ProductColor type
      const colors = Array.isArray(product.product_colors)
        ? product.product_colors.map((item: { manufacturer_colors: unknown } & Omit<ProductColor, 'manufacturer_colors'>) => ({
            ...item,
            manufacturer_colors: item.manufacturer_colors as ProductColor['manufacturer_colors'],
          }))
        : [];
      setProductColors(colors);
      setIsQuantitySelectorOpen(true);
    } catch (error) {
      console.error('Error fetching product details:', error);
      alert('상품 정보를 불러오는데 실패했습니다.');
    }
  };

  // Handle adding to cart with selected sizes/quantities
  // Filter designs based on search query
  const filteredDesigns = designs.filter((design) => {
    const designTitle = design.title || design.product.title;
    return designTitle.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSaveToCart = async (designName: string, selectedItems: CartItem[], purchaseType: 'direct' | 'cart') => {
    if (!selectedDesign) return;

    setIsSaving(true);
    try {
      const colorSelections = selectedDesign.color_selections as { productColor?: string } | null;
      const productColor = colorSelections?.productColor || '#FFFFFF';
      const colorName = productColors.find(c => c.manufacturer_colors.hex === productColor)?.manufacturer_colors.name || '색상';

      // Fetch the full design data including canvas state
      const supabase = createClient();
      const { data: fullDesign, error: designError } = await supabase
        .from('saved_designs')
        .select('*')
        .eq('id', selectedDesign.id)
        .single();

      if (designError || !fullDesign) {
        throw new Error('Failed to fetch design data');
      }

      const newCartItemIds: string[] = [];

      // Add all cart items using the existing design ID
      for (const item of selectedItems) {
        // Save to Supabase - reuse the existing design
        const dbCartItem = await addToCartDB({
          productId: selectedDesign.product.id,
          productTitle: selectedDesign.product.title,
          productColor: productColor,
          productColorName: colorName,
          size: item.size,
          quantity: item.quantity,
          pricePerItem: selectedDesign.price_per_item, // Use base price for now
          canvasState: fullDesign.canvas_state,
          thumbnailUrl: selectedDesign.preview_url || undefined,
          savedDesignId: selectedDesign.id, // Reuse existing design
          designName: designName,
          previewImage: selectedDesign.preview_url || undefined,
        });

        // Also add to local cart store
        if (dbCartItem) {
          if (dbCartItem.id) {
            newCartItemIds.push(dbCartItem.id);
          }
          addToCart({
            productId: selectedDesign.product.id,
            productTitle: selectedDesign.product.title,
            productColor: productColor,
            productColorName: colorName,
            size: item.size,
            quantity: item.quantity,
            pricePerItem: selectedDesign.price_per_item,
            canvasState: fullDesign.canvas_state,
            thumbnailUrl: selectedDesign.preview_url || undefined,
            savedDesignId: selectedDesign.id,
            designName: designName,
          });
        }
      }

      // For direct purchase, store item IDs so checkout filters to these only
      if (purchaseType === 'direct' && newCartItemIds.length > 0) {
        sessionStorage.setItem('directCheckoutItemIds', JSON.stringify(newCartItemIds));
      }
    } catch (error) {
      console.error('Add to cart failed:', error);
      alert('장바구니 추가 중 오류가 발생했습니다.');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Desktop Header */}

      {/* Page Header */}
      <div className="sticky top-0 bg-white z-40 border-b border-gray-200">
        <div className="hidden lg:block">
          <Header showHomeNav />
        </div>
        <div className="px-3 py-2 sm:px-4 sm:py-4">
          <h1 className="text-sm sm:text-xl font-bold">나의 디자인</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabChange('designs')}
            className={`flex-1 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'designs'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-500'
            }`}
          >
            나의 디자인
          </button>
          <button
            onClick={() => handleTabChange('favorites')}
            className={`flex-1 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'favorites'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-500'
            }`}
          >
            찜한 상품
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'designs' ? (
        <div className="p-2 sm:p-4">
          {/* Create Design Button & Search Field */}
          {isAuthenticated && !isLoading && !error && (
            <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setIsProductSelectionModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-3 bg-black text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-800 transition-colors sm:shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>디자인 만들기</span>
              </button>
              {designs.length > 0 && (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="디자인 이름으로 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 sm:py-3 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          {!isAuthenticated ? (
            <div className="text-center py-16">
              <p className="text-xs sm:text-sm text-gray-500 mb-3">로그인이 필요합니다</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mb-5">나의 디자인을 확인하려면 로그인해주세요</p>
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2.5 bg-black text-white text-xs sm:text-sm rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                로그인하기
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-current border-r-transparent" />
              <p className="text-xs sm:text-sm text-gray-500 mt-3">디자인을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-xs sm:text-sm text-red-500 mb-3">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-black text-white text-xs sm:text-sm rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xs sm:text-sm text-gray-500 mb-3">저장된 디자인이 없습니다</p>
              <p className="text-[10px] sm:text-xs text-gray-400">제품을 커스터마이징하고 장바구니에 담아보세요!</p>
            </div>
          ) : filteredDesigns.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xs sm:text-sm text-gray-500 mb-3">검색 결과가 없습니다</p>
              <p className="text-[10px] sm:text-xs text-gray-400">다른 검색어로 시도해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-3">
              {filteredDesigns.map((design) => {
                return (
                  <div
                    key={design.id}
                    className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Thumbnail - Clickable to edit */}
                    <div className="relative">
                      <button
                        onClick={() => handleDesignClick(design.id)}
                        className="w-full aspect-square bg-gray-100 relative"
                      >
                        {design.preview_url ? (
                          <Image
                            src={design.preview_url}
                            alt={design.title || design.product.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400">No Image</span>
                          </div>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteClick(design, e)}
                        disabled={deletingDesignId === design.id}
                        className="absolute top-1 right-1 p-1 bg-white/90 hover:bg-red-500 hover:text-white text-gray-600 rounded-full shadow-sm transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        {deletingDesignId === design.id ? (
                          <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        )}
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-1.5 sm:p-2 lg:p-3 flex flex-col gap-1 sm:gap-1.5">
                      <button
                        onClick={() => handleDesignClick(design.id)}
                        className="text-left"
                      >
                        {design.title && (
                          <p className="text-[8px] sm:text-[10px] lg:text-xs text-gray-500 truncate">
                            {design.product.title}
                          </p>
                        )}
                        <h3 className="text-[10px] sm:text-xs lg:text-sm font-bold truncate mb-0.5">
                          {design.title || design.product.title}
                        </h3>

                        {/* Price */}
                        <p className="text-xs sm:text-sm lg:text-base font-bold">
                          ₩{design.price_per_item.toLocaleString()}
                        </p>
                      </button>

                      {/* Add to Cart Button */}
                      <button
                        onClick={(e) => handleAddToCartClick(design, e)}
                        className="w-full py-1 px-1.5 sm:py-1.5 sm:px-2 bg-black text-white text-[10px] sm:text-xs rounded-md sm:rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-0.5 sm:gap-1"
                      >
                        <ShoppingCart className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>장바구니에 담기</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <FavoritesList />
      )}

      {/* Design Edit Modal */}
      <DesignEditModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        designId={selectedItemId}
        onSaveComplete={() => {
          // Refresh the page to show updated design
          window.location.reload();
        }}
      />

      {/* Quantity Selector Modal */}
      <QuantitySelectorModal
        isOpen={isQuantitySelectorOpen}
        onClose={() => setIsQuantitySelectorOpen(false)}
        onConfirm={handleSaveToCart}
        sizeOptions={productSizeOptions}
        pricePerItem={selectedDesign?.price_per_item || 0}
        isSaving={isSaving}
        defaultDesignName={selectedDesign?.title || selectedDesign?.product.title || ''}
      />

      {/* Product Selection Modal for Creating New Design */}
      <ProductSelectionForDesignModal
        isOpen={isProductSelectionModalOpen}
        onClose={() => setIsProductSelectionModalOpen(false)}
      />
    </div>
  );
}
