/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import ProductCard from "@/app/components/ProductCard";
import CategoryButton from "@/app/components/CategoryButton";
import { Product } from "@/types/types";
import { createClient } from "@/lib/supabase-client";
import { CATEGORIES } from "@/lib/categories";
import Header from "@/app/components/Header";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category');

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryFromUrl || "all");
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique categories from products
  // const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter((c): c is string => Boolean(c))));
  // const categories: string[] = ["전체", ...uniqueCategories];

  // Update selected category when URL param changes
  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  // Fetch products on mount
  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('products')
        .select('*, manufacturers(name)')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        const productsWithManufacturer = (data ?? []).map(product => ({
          ...product,
          manufacturer_name: product.manufacturers?.name ?? null,
        })) as Product[];
        setProducts(productsWithManufacturer);
        setFilteredProducts(productsWithManufacturer);
      }
      setIsLoading(false);
    }

    fetchProducts();
  }, []);

  // Filter products based on search query and category
  useEffect(() => {
    let result = products;

    // Filter by search query
    if (searchQuery.trim()) {
      result = result.filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      result = result.filter(product => product.category === selectedCategory);
    }

    setFilteredProducts(result);
  }, [searchQuery, selectedCategory, products]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      

      {/* Search Section */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        {/* Desktop Header */}
        <div className="hidden md:block">
          <Header showHomeNav />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="상품 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B55A5] focus:border-transparent"
            />
            <div className="absolute inset-y-0 right-3 flex items-center gap-2">
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showFilters ? "bg-blue-50 text-[#3B55A5]" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <SlidersHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* Filter Section */}
          {showFilters && (
            <div className="mt-4 pb-2 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">카테고리</h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.key}
                    onClick={() => setSelectedCategory(category.key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === category.key
                        ? "bg-[#3B55A5] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        {/* Categories Section */}
        <section className="max-w-7xl py-2">
          <div className="flex gap-2 overflow-x-auto p-1">
            {CATEGORIES.map((category) => (
              <CategoryButton
                key={category.key}
                name={category.name}
                icon={category.icon}
                onClick={() => setSelectedCategory(category.key)}
                isActive={selectedCategory === category.key}
              />
            ))}
          </div>
        </section>

        </div>
      </div>

      {/* Content Container */}
      <div className="px-2">
        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          {isLoading ? (
            <p>로딩 중...</p>
          ) : (
            <p>
              {filteredProducts.length}개의 상품
              {searchQuery && ` "${searchQuery}" 검색 결과`}
            </p>
          )}
        </div>
        {/* Products Grid */}
        <section className="max-w-7xl mx-auto py-2">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white rounded-sm overflow-hidden shadow-sm">
                  <div className="aspect-4/5 bg-gray-200 animate-pulse" />
                  <div className="p-2 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Search size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-gray-500">
                다른 검색어를 시도하거나 필터를 조정해보세요
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
