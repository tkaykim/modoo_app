'use client'
import { useState, useRef } from 'react'
import { Product, PrintMethodRecord } from '@/types/types'
import ProductImageGallery from './ProductImageGallery'
import PrintMethodsDisplay from '@/app/components/canvas/PrintMethodsDisplay'
import ReviewsSection from '@/app/components/ReviewsSection'
import DescriptionImageSection from '@/app/components/DescriptionImageSection'
import ShareProductButton from '@/app/components/ShareProductButton'
import SimilarProducts from '@/app/components/SimilarProducts'

interface LandingStepProps {
  product: Product
  allPrintMethods: PrintMethodRecord[]
  enabledPrintMethodIds: Set<string>
  onNext: () => void
}

export default function LandingStep({
  product,
  allPrintMethods,
  enabledPrintMethodIds,
  onNext,
}: LandingStepProps) {
  const formattedPrice = product.base_price.toLocaleString('ko-KR')
  const descriptionImageUrls = product.description_image ?? null
  const sizingChartImageUrl = product.sizing_chart_image ?? null
  const thumbnailImages = product.thumbnail_image_link ?? []

  const tabs = [
    { id: 'info', label: '정보' },
    ...(sizingChartImageUrl ? [{ id: 'size', label: '사이즈' }] : []),
  ] as const

  type TabId = (typeof tabs)[number]['id']
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const sectionRef = useRef<HTMLDivElement>(null)

  const handleTabClick = (tabId: TabId) => {
    setActiveTab(tabId)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="text-black bg-white pb-24 lg:pb-0">
      <div className="lg:max-w-360 lg:mx-auto lg:px-6 lg:py-6">
        {/* Desktop: side-by-side / Mobile: stacked */}
        <div className="lg:flex lg:gap-8">
          {/* Image Gallery */}
          <div className="lg:flex-1 lg:min-w-0">
            <ProductImageGallery images={thumbnailImages} />
          </div>

          {/* Product Details Sidebar */}
          <div className="p-4 lg:p-0 lg:w-96 lg:shrink-0 flex flex-col gap-1 border-b border-gray-200">
            {/* Title Section */}
            <div className="w-full flex justify-between items-start">
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                  {product.manufacturer_name || '제조사'}
                </p>
                <h2 className="text-base font-bold text-gray-900 leading-snug mt-1">{product.title}</h2>
              </div>
              <ShareProductButton url={`/editor/${product.id}`} />
            </div>

            {/* Price */}
            <div>
              <p className="text-lg font-bold text-gray-900">{formattedPrice}원</p>
            </div>

            {/* Print Methods */}
            {/* <PrintMethodsDisplay
              allPrintMethods={allPrintMethods}
              enabledPrintMethodIds={enabledPrintMethodIds}
              className=""
            /> */}

            {/* Desktop action button */}
            <button
              onClick={onNext}
              className="hidden lg:block mt-6 w-full bg-black py-3.5 text-sm font-medium rounded-lg text-white transition hover:bg-gray-800"
            >
              디자인하기
            </button>
          </div>
        </div>

        {/* Reviews */}
        <div className="px-4 lg:px-0">
          <ReviewsSection productId={product.id} limit={10} />
        </div>

        {/* Tabs */}
        <div ref={sectionRef} className="sticky top-11 sm:top-14 lg:top-16 z-30 bg-white border-b border-gray-200">
          <div className="flex px-4 lg:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex-1 py-2.5 text-xs font-medium text-center transition ${
                  activeTab === tab.id
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 lg:px-0 lg:mt-4">
          {activeTab === 'info' && (
            <DescriptionImageSection title="주문상세" imageUrls={descriptionImageUrls} />
          )}
          {activeTab === 'size' && (
            <DescriptionImageSection
              title="사이즈 차트"
              imageUrls={sizingChartImageUrl ? [sizingChartImageUrl] : null}
            />
          )}
        </div>

        {/* Similar Products */}
        <div className="px-4 lg:px-0">
          <SimilarProducts productId={product.id} manufacturerName={product.manufacturer_name} />
        </div>
      </div>

      {/* Bottom Action Bar - mobile only */}
      <div className="lg:hidden w-full fixed bottom-0 left-0 bg-white pb-6 pt-3 px-4 shadow-2xl shadow-black z-50">
        <button
          onClick={onNext}
          className="w-full bg-black py-3 text-sm rounded-lg text-white transition"
        >
          디자인하기
        </button>
      </div>
    </div>
  )
}
