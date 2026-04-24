/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import ProductCard from "@/app/components/ProductCard";
import { Product } from "@/types/types";
import { createClient } from "@/lib/supabase-client";
import Header from "@/app/components/Header";
import { trackSearch, trackViewItemList } from "@/lib/gtm-events";

type SortOption = "default" | "review_count" | "price_low" | "price_high";

const SORT_LABELS: Record<SortOption, string> = {
  default: "기본",
  review_count: "리뷰 많은순",
  price_low: "낮은 가격순",
  price_high: "높은 가격순",
};

interface DBCategory {
  key: string;
  name: string;
  icon: string | null;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get('category');

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryFromUrl || "all");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [dbCategories, setDbCategories] = useState<DBCategory[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [displayCount, setDisplayCount] = useState(12);
  const sortRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const hasActiveFilter = selectedCategory !== "all" || selectedManufacturer !== "all" || priceMin !== priceRange[0] || priceMax !== priceRange[1];

  // Close sort menu when clicking outside
  useEffect(() => {
    if (!showSortMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSortMenu]);

  // Update selected category when URL param changes
  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  // Fetch products and categories on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const supabase = createClient();

      const [productsRes, categoriesRes, reviewsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, manufacturers(name)')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('product_categories')
          .select('key, name, icon')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('reviews')
          .select('product_id'),
      ]);

      if (categoriesRes.data) {
        setDbCategories(categoriesRes.data);
      }

      // Build review count map
      if (reviewsRes.data) {
        const counts: Record<string, number> = {};
        for (const r of reviewsRes.data) {
          counts[r.product_id] = (counts[r.product_id] || 0) + 1;
        }
        setReviewCounts(counts);
      }

      if (productsRes.error) {
        console.error('Error fetching products:', productsRes.error);
      } else {
        const productsWithManufacturer = (productsRes.data ?? []).map(product => ({
          ...product,
          manufacturer_name: product.manufacturers?.name ?? null,
        })) as Product[];
        setProducts(productsWithManufacturer);
        setFilteredProducts(productsWithManufacturer);

        // Extract unique manufacturer names
        const uniqueManufacturers = Array.from(
          new Set(productsWithManufacturer.map(p => p.manufacturer_name).filter((m): m is string => Boolean(m)))
        ).sort();
        setManufacturers(uniqueManufacturers);

        // Compute price range
        if (productsWithManufacturer.length > 0) {
          const prices = productsWithManufacturer.map(p => p.base_price);
          const min = Math.floor(Math.min(...prices) / 1000) * 1000;
          const max = Math.ceil(Math.max(...prices) / 1000) * 1000;
          setPriceRange([min, max]);
          setPriceMin(min);
          setPriceMax(max);
        }
      }
      setIsLoading(false);
    }

    fetchData();
  }, []);

  // Filter and sort products
  useEffect(() => {
    let result = products;

    if (searchQuery.trim()) {
      result = result.filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.product_code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter(product => product.category === selectedCategory);
    }

    if (selectedManufacturer !== "all") {
      result = result.filter(product => product.manufacturer_name === selectedManufacturer);
    }

    // Price range filter
    if (priceRange[1] > 0) {
      result = result.filter(p => p.base_price >= priceMin && p.base_price <= priceMax);
    }

    // Sort
    if (sortBy === "review_count") {
      result = [...result].sort((a, b) => (reviewCounts[b.id] || 0) - (reviewCounts[a.id] || 0));
    } else if (sortBy === "price_low") {
      result = [...result].sort((a, b) => a.base_price - b.base_price);
    } else if (sortBy === "price_high") {
      result = [...result].sort((a, b) => b.base_price - a.base_price);
    }

    setFilteredProducts(result);
    setDisplayCount(12);
  }, [searchQuery, selectedCategory, selectedManufacturer, priceMin, priceMax, priceRange, sortBy, reviewCounts, products]);

  // Infinite scroll: load more when sentinel is visible
  const loadMore = useCallback(() => {
    setDisplayCount(prev => prev + 12);
  }, []);

  const visibleProducts = filteredProducts.slice(0, displayCount);
  const hasMore = displayCount < filteredProducts.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  // GTM: search (debounced, 검색어가 있을 때만)
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const t = setTimeout(() => {
      trackSearch({
        search_term: searchQuery.trim(),
        results_count: filteredProducts.length,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [searchQuery, filteredProducts.length]);

  // GTM: view_item_list (카테고리 변경 시 1회, 결과가 있을 때)
  const lastListTrackRef = useRef<string>("");
  useEffect(() => {
    if (isLoading) return;
    if (filteredProducts.length === 0) return;
    const key = `${selectedCategory}|${selectedManufacturer}`;
    if (lastListTrackRef.current === key) return;
    lastListTrackRef.current = key;
    trackViewItemList({
      list_id: selectedCategory,
      list_name: selectedCategory === 'all' ? '전체' : selectedCategory,
      items: filteredProducts.slice(0, 12).map((p) => ({
        item_id: p.id,
        item_name: p.title,
        item_brand: p.manufacturer_name ?? undefined,
        item_category: p.category ?? undefined,
        price: p.base_price,
      })),
    });
  }, [isLoading, selectedCategory, selectedManufacturer, filteredProducts]);

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
                className={`relative p-1.5 rounded-lg transition-colors ${
                  showFilters || hasActiveFilter ? "bg-blue-50 text-[#3B55A5]" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <SlidersHorizontal size={20} />
                {hasActiveFilter && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#3B55A5] rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-[#3B55A5] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            {dbCategories.map((category) => (
              <button
                key={category.key}
                onClick={() => setSelectedCategory(category.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === category.key
                    ? "bg-[#3B55A5] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Filter Section */}
          {showFilters && (
            <div className="mt-4 pb-2 border-t pt-4 space-y-3">
              {hasActiveFilter && (
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedManufacturer("all");
                    setPriceMin(priceRange[0]);
                    setPriceMax(priceRange[1]);
                  }}
                  className="text-xs text-gray-500 underline hover:text-gray-700"
                >
                  필터 초기화
                </button>
              )}
              {manufacturers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">제조사</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedManufacturer("all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedManufacturer === "all"
                          ? "bg-[#3B55A5] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      전체
                    </button>
                    {manufacturers.map((name) => (
                      <button
                        key={name}
                        onClick={() => setSelectedManufacturer(name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          selectedManufacturer === name
                            ? "bg-[#3B55A5] text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Price Range Filter */}
              {priceRange[1] > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">가격 범위</h3>
                    <span className="text-xs text-gray-500">
                      {priceMin.toLocaleString()}원 ~ {priceMax.toLocaleString()}원
                    </span>
                  </div>
                  <div className="relative h-5 flex items-center">
                    {/* Track background */}
                    <div className="absolute w-full h-1 bg-gray-200 rounded" />
                    {/* Active range */}
                    <div
                      className="absolute h-1 bg-[#3B55A5] rounded"
                      style={{
                        left: `${((priceMin - priceRange[0]) / (priceRange[1] - priceRange[0])) * 100}%`,
                        right: `${100 - ((priceMax - priceRange[0]) / (priceRange[1] - priceRange[0])) * 100}%`,
                      }}
                    />
                    {/* Min slider */}
                    <input
                      type="range"
                      min={priceRange[0]}
                      max={priceRange[1]}
                      step={1000}
                      value={priceMin}
                      onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax))}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3B55A5] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3B55A5] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
                    />
                    {/* Max slider */}
                    <input
                      type="range"
                      min={priceRange[0]}
                      max={priceRange[1]}
                      step={1000}
                      value={priceMax}
                      onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin))}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#3B55A5] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#3B55A5] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Content Container */}
      <div className="px-2 pb-24">
        {/* Results Count & Sort */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isLoading ? (
              <p>로딩 중...</p>
            ) : (
              <p>
                {filteredProducts.length}개의 상품
                {searchQuery && ` "${searchQuery}" 검색 결과`}
              </p>
            )}
          </div>
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
            >
              <ArrowUpDown size={14} />
              {SORT_LABELS[sortBy]}
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-20 min-w-30">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => { setSortBy(option); setShowSortMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                      sortBy === option ? "text-[#3B55A5] font-semibold" : "text-gray-700"
                    }`}
                  >
                    {SORT_LABELS[option]}
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <>
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-[#3B55A5] rounded-full animate-spin" />
                </div>
              )}
            </>
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
