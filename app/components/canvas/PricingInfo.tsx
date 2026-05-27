'use client'
import { useCanvasStore } from "@/store/useCanvasStore";
import { ProductSide, PrintMethod } from "@/types/types";
import { calculateAllSidesPricing, PricingSummary, ObjectPricing } from "@/app/utils/canvasPricing";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PrintMethodPickerSheet from "./PrintMethodPickerSheet";

interface PricingInfoProps {
  basePrice: number;
  sides: ProductSide[];
}

// Print method display names in Korean
const PRINT_METHOD_NAMES: Record<string, string> = {
  dtf: 'DTF 전사',
  dtg: 'DTG 전사',
  screen_printing: '나염',
  embroidery: '자수',
  applique: '아플리케'
};

// Print size display names in Korean
const PRINT_SIZE_NAMES: Record<string, string> = {
  '10x10': '10cm x 10cm',
  'A4': 'A4',
  'A3': 'A3'
};

export default function PricingInfo({ basePrice, sides }: PricingInfoProps) {
  const { canvasMap, canvasVersion, setObjectPrintMethod } = useCanvasStore();
  const [pricingData, setPricingData] = useState<PricingSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // ?print-picker=1 쿼리 진입 시에만 "변경" 버튼 + sheet 마운트. prod URL엔 안 붙음.
  const searchParams = useSearchParams();
  const pickerEnabled = searchParams?.get('print-picker') === '1';
  const [pickerForObjectId, setPickerForObjectId] = useState<string | null>(null);

  // Calculate pricing dynamically whenever canvases change
  useEffect(() => {
    let isMounted = true;

    const calculatePricing = async () => {
      setIsCalculating(true);
      try {
        const result = await calculateAllSidesPricing(canvasMap, sides);
        if (isMounted) {
          setPricingData(result);
        }
      } catch (error) {
        console.error('Error calculating pricing:', error);
      } finally {
        if (isMounted) {
          setIsCalculating(false);
        }
      }
    };

    calculatePricing();

    return () => {
      isMounted = false;
    };
  }, [canvasMap, sides, canvasVersion]);

  if (!pricingData || pricingData.totalObjectCount === 0) {
    return null;
  }

  const totalPrice = basePrice + pricingData.totalAdditionalPrice;

  // Filter only sides that have objects
  const sidesWithObjects = pricingData.sidePricing.filter(sp => sp.hasObjects);

  return (
    <div className="w-full border-t border-gray-200 pt-3 mt-3">
      <div className="flex flex-col gap-2">
        {/* Price Breakdown Header */}
        <p className="text-sm font-semibold text-gray-700">가격 상세</p>

        {/* Base Price */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">기본 가격</span>
          <span className="text-gray-900">{basePrice.toLocaleString('ko-KR')}원</span>
        </div>

        {/* Per-Side Breakdown with Object Details */}
        {sidesWithObjects.map((sidePricing) => (
          <div key={sidePricing.sideId} className="flex flex-col gap-1.5 border-l-2 border-blue-200 pl-2">
            {/* Side Header */}
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-700">{sidePricing.sideName}</span>
              <span className="text-gray-900">
                +{sidePricing.totalPrice.toLocaleString('ko-KR')}원
              </span>
            </div>

            {/* Object-level Details */}
            {sidePricing.objects.map((objPricing: ObjectPricing, idx: number) => (
              <div key={objPricing.objectId} className="flex flex-col gap-0.5 text-xs pl-2">
                {/* Object Info Line */}
                <div className="flex justify-between items-center">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-600">
                        오브젝트 {idx + 1}: {PRINT_METHOD_NAMES[objPricing.printMethod]} ({PRINT_SIZE_NAMES[objPricing.printSize]})
                      </span>
                      {/* "변경" 버튼은 ?print-picker=1 쿼리 진입 시에만. prod URL엔 안 붙음. */}
                      {pickerEnabled && (
                        <button
                          onClick={() => setPickerForObjectId(objPricing.objectId)}
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                        >
                          변경
                        </button>
                      )}
                    </div>
                    <span className="text-gray-500 text-[10px]">
                      크기: {objPricing.dimensionsMm.width.toFixed(0)}mm × {objPricing.dimensionsMm.height.toFixed(0)}mm
                      {' • '}
                      색상 수: {objPricing.colorCount}개
                      {objPricing.quantity && ` • 수량: ${objPricing.quantity}개`}
                    </span>
                    {/* Show recommendation if auto-selected */}
                    {objPricing.recommendation?.suggested && (
                      <span className="text-blue-600 text-[10px] italic">
                        💡 {objPricing.recommendation.reason}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-700 font-medium ml-2">
                    {objPricing.price.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Divider */}
        <div className="border-t border-gray-200 my-1"></div>

        {/* Total Price */}
        <div className="flex justify-between text-base font-bold">
          <span className="text-gray-900">총 가격</span>
          <span className="text-black">{totalPrice.toLocaleString('ko-KR')}원</span>
        </div>

        {/* Per Item Note */}
        <p className="text-xs text-gray-500">
          * 1개당 가격입니다 ({pricingData.totalObjectCount}개 오브젝트)
          {isCalculating && ' • 계산 중...'}
        </p>
      </div>

      {/* PrintMethodPickerSheet — 쿼리 게이트 뒤에서만 마운트. prod 코드에 포함되지만
          ?print-picker=1 없이는 절대 노출 안 됨. */}
      {pickerEnabled && pickerForObjectId && (() => {
        // 모든 면에서 해당 objectId 찾기
        let target: ObjectPricing | null = null;
        let targetSideName = '';
        for (const sp of pricingData.sidePricing) {
          const found = sp.objects.find(o => o.objectId === pickerForObjectId);
          if (found) { target = found; targetSideName = sp.sideName; break; }
        }
        if (!target) return null;
        return (
          <PrintMethodPickerSheet
            isOpen={true}
            currentMethod={target.printMethod as PrintMethod}
            objectLabel={`오브젝트 · ${targetSideName}`}
            onSelect={(method) => {
              setObjectPrintMethod(pickerForObjectId, method);
              setPickerForObjectId(null);
            }}
            onClose={() => setPickerForObjectId(null)}
          />
        );
      })()}
    </div>
  );
}
