'use client'

import { useState, useEffect } from 'react';
import { Product } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import { maybeHealOnError } from '@/lib/supabase-resilient';
import { Search, X } from 'lucide-react';
import Image from 'next/image';

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedProducts: Product[]) => void;
  initialSelectedProducts?: Product[];
}

export default function ProductSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedProducts = []
}: ProductSelectionModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(initialSelectedProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data as Product[]);
      setFilteredProducts(data as Product[]);
    } else if (error) {
      if (maybeHealOnError(error)) return;
      console.error('Error fetching products:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setSelectedProducts(initialSelectedProducts);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);



  const toggleProductSelection = (product: Product) => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedProducts);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const getProductImageUrl = (product: Product) => {
    if (product.configuration && product.configuration.length > 0) {
      return product.configuration[0].imageUrl ?? '/placeholder-product.png';
    }
    return '/placeholder-product.png';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg w-full max-w-2xl max-h-[80vh] mx-4 shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">제품 선택</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제품 이름으로 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black transition"
            />
          </div>

          {/* Selected Products Count */}
          {selectedProducts.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              {selectedProducts.length}개 제품 선택됨
            </div>
          )}
        </div>

        {/* Products List */}
        <div className="h-[300px] overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">로딩 중...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {searchQuery ? '검색 결과가 없습니다.' : '제품이 없습니다.'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredProducts.map((product) => {
                const isSelected = selectedProducts.some(p => p.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProductSelection(product)}
                    className={`
                      flex items-center gap-2 cursor-pointer rounded-full border-2 px-2 py-1 transition
                      ${isSelected
                        ? 'border-black bg-gray-100'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    {/* Product Image */}
                    <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden relative flex-shrink-0">
                      <Image
                        src={(product.thumbnail_image_link?.[0] ?? '') as string}
                        alt={product.title}
                        fill
                        className="object-contain"
                      />
                    </div>

                    {/* Product Name */}
                    <span className="text-sm font-medium max-w-[150px] truncate">
                      {product.title}
                    </span>

                    {/* Checkbox */}
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
            >
              선택 완료 ({selectedProducts.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
