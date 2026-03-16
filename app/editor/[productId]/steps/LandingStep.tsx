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
    <div className="text-black bg-white pb-24">
      {/* Product Image Gallery */}
      <ProductImageGallery images={thumbnailImages} />

      {/* Product Info */}
      <div className="p-4 flex flex-col gap-1">
        {/* Title Section */}
        <div className="w-full flex justify-between">
          <div>
            <h2 className="text-xs font-bold">{product.manufacturer_name || '제조사'}</h2>
            <p className="text-black font-normal">{product.title}</p>
          </div>
          <ShareProductButton url={`/editor/${product.id}`} />
        </div>

        {/* Price and Delivery */}
        <div className="w-full flex justify-between">
          <p className="text-sm text-black">
            1개당 <span className="font-bold">{formattedPrice}원</span>
          </p>
          <p className="text-sm text-black/80">배송비 3,000원</p>
        </div>

        {/* Print Methods */}
        <PrintMethodsDisplay
          allPrintMethods={allPrintMethods}
          enabledPrintMethodIds={enabledPrintMethodIds}
          className="mt-4"
        />

        {/* Reviews */}
        <ReviewsSection productId={product.id} limit={10} />

        {/* Description Images */}
        <DescriptionImageSection title="주문상세" imageUrls={descriptionImageUrls} />

        {/* Sizing Chart */}
        <DescriptionImageSection
          title="사이즈 차트"
          imageUrls={sizingChartImageUrl ? [sizingChartImageUrl] : null}
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="w-full fixed bottom-0 left-0 bg-white pb-6 pt-3 px-4 shadow-2xl shadow-black z-50">
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
