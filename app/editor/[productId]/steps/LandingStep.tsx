'use client'
import { Product, PrintMethodRecord } from '@/types/types'
import ProductImageGallery from './ProductImageGallery'
import PrintMethodsDisplay from '@/app/components/canvas/PrintMethodsDisplay'
import ReviewsSection from '@/app/components/ReviewsSection'
import DescriptionImageSection from '@/app/components/DescriptionImageSection'
import ShareProductButton from '@/app/components/ShareProductButton'

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

        {/* Full-width sections below */}
        <div className="px-4 lg:px-0 lg:mt-8">
          <ReviewsSection productId={product.id} limit={10} />
          <DescriptionImageSection title="주문상세" imageUrls={descriptionImageUrls} />
          <DescriptionImageSection
            title="사이즈 차트"
            imageUrls={sizingChartImageUrl ? [sizingChartImageUrl] : null}
          />
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
