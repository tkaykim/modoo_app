'use client'

import React, { useMemo, useState } from 'react';
import * as fabric from 'fabric';
import { useSearchParams } from 'next/navigation';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ProductSide, PrintMethod } from '@/types/types';
import { Image as ImageIcon, Type, Square, Printer } from 'lucide-react';
import { getPrintMethodLabel } from '@/lib/printPricingConfig';
import PrintMethodPickerSheet from './PrintMethodPickerSheet';

interface ObjectPreviewPanelProps {
  sides: ProductSide[];
}

interface CanvasObjectInfo {
  objectId: string;
  type: string;
  sideId: string;
  sideName: string;
  widthMm: number;
  heightMm: number;
  preview: string;
  printMethod: PrintMethod;
}

const ObjectPreviewPanel: React.FC<ObjectPreviewPanelProps> = ({ sides }) => {
  const { canvasMap, canvasVersion, setObjectPrintMethod } = useCanvasStore();

  // ?print-picker=1 진입 시에만 sheet UI 노출. prod URL엔 안 붙음 → 손님은 라벨만 봄.
  // Phase 2에서 쿼리 게이트 제거 시 자연스럽게 prod 공개.
  const searchParams = useSearchParams();
  const pickerEnabled = searchParams?.get('print-picker') === '1';

  const [pickerForObjectId, setPickerForObjectId] = useState<string | null>(null);

  // Extract all user objects from all canvases
  const allObjects = useMemo(() => {
    const objects: CanvasObjectInfo[] = [];

    sides.forEach((side) => {
      const canvas = canvasMap[side.id];
      if (!canvas) return;

      const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
      // @ts-expect-error - Custom property
      const scaledImageWidth = canvas.scaledImageWidth;
      // @ts-expect-error - Custom property
      const calibrationNative = (canvas.calibrationNativeMmPerPx as number | undefined) ?? 0;
      // @ts-expect-error - Custom property
      const originalImageWidth = canvas.originalImageWidth as number | undefined;
      const calibratedRatio =
        calibrationNative > 0 && originalImageWidth && scaledImageWidth
          ? calibrationNative / (scaledImageWidth / originalImageWidth)
          : 0;
      const pixelToMmRatio = calibratedRatio > 0
        ? calibratedRatio
        : (scaledImageWidth ? realWorldProductWidth / scaledImageWidth : 0.25);

      const userObjects = canvas.getObjects().filter(obj => {
        if (obj.excludeFromExport) return false;
        // @ts-expect-error - Checking custom data property
        if (obj.data?.id === 'background-product-image') return false;
        return true;
      });

      userObjects.forEach((obj) => {
        // @ts-expect-error - Accessing custom data property
        const objectId = obj.data?.objectId;
        if (!objectId) return;

        const boundingRect = obj.getBoundingRect();
        const widthMm = boundingRect.width * pixelToMmRatio;
        const heightMm = boundingRect.height * pixelToMmRatio;

        let preview = '';
        try {
          const bounds = obj.getBoundingRect();
          const padding = 20;
          const left = Math.max(0, bounds.left - padding);
          const top = Math.max(0, bounds.top - padding);
          const width = bounds.width + (padding * 2);
          const height = bounds.height + (padding * 2);

          preview = canvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 1,
            left,
            top,
            width,
            height,
          });
        } catch {
          // Preview generation failed
        }

        // @ts-expect-error - Accessing custom data property
        const rawMethod = obj.data?.printMethod as string | undefined;
        // 기존 객체에 printMethod 없으면 dtf 폴백 (prod 카트/주문 호환).
        const printMethod: PrintMethod = (rawMethod === 'dtf' || rawMethod === 'dtg' ||
          rawMethod === 'screen_printing' || rawMethod === 'embroidery' ||
          rawMethod === 'applique') ? rawMethod : 'dtf';

        objects.push({
          objectId,
          type: obj.type || 'unknown',
          sideId: side.id,
          sideName: side.name,
          widthMm,
          heightMm,
          preview,
          printMethod,
        });
      });
    });

    return objects;
  }, [canvasMap, sides, canvasVersion]);

  const getObjectIcon = (type: string) => {
    if (type === 'image') return <ImageIcon className="size-4" />;
    if (type === 'i-text' || type === 'text') return <Type className="size-4" />;
    return <Square className="size-4" />;
  };

  const getObjectTypeName = (type: string) => {
    if (type === 'image') return '이미지';
    if (type === 'i-text' || type === 'text') return '텍스트';
    if (type === 'rect') return '사각형';
    if (type === 'circle') return '원형';
    return '오브젝트';
  };

  if (allObjects.length === 0) {
    return null;
  }

  return (
    <div className="bg-white mb-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">인쇄 요소</h3>

      <div className="space-y-3">
        {allObjects.map((objInfo) => (
          <div
            key={objInfo.objectId}
            className="border border-gray-200 rounded-lg bg-gray-50 p-3 flex items-start gap-3"
          >
            {/* Preview Thumbnail */}
            <div className="w-16 h-16 bg-white border border-gray-200 rounded flex items-center justify-center shrink-0 overflow-hidden">
              {objInfo.preview ? (
                <img
                  src={objInfo.preview}
                  alt={getObjectTypeName(objInfo.type)}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-gray-400">
                  {getObjectIcon(objInfo.type)}
                </div>
              )}
            </div>

            {/* Object Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getObjectIcon(objInfo.type)}
                <span className="text-sm font-semibold text-gray-700">
                  {getObjectTypeName(objInfo.type)}
                </span>
                <span className="text-xs text-gray-500">
                  ({objInfo.sideName})
                </span>
              </div>

              <div className="text-xs text-gray-600 space-y-0.5">
                {/* 실측 크기(너비/높이 mm)는 고객에게 노출하지 않음 — 실측 오차 컴플레인 방지. */}
                {/* 인쇄방식 라벨 — prod 손님에게 항상 보이는 정보성 표시. */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Printer className="w-3 h-3 text-gray-500" />
                  <span className="font-medium">인쇄:</span>
                  <span className="text-gray-800 font-medium">
                    {getPrintMethodLabel(objInfo.printMethod)}
                  </span>
                  {/* "변경" 버튼은 ?print-picker=1 쿼리 진입 시에만. prod URL엔 안 붙어서 손님 미노출. */}
                  {pickerEnabled && (
                    <button
                      onClick={() => setPickerForObjectId(objInfo.objectId)}
                      className="ml-auto text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                    >
                      변경
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          총 <span className="font-semibold text-gray-800">{allObjects.length}개</span>의 인쇄 요소
        </p>
      </div>

      {/* PrintMethodPickerSheet — 쿼리 게이트 뒤에서만 마운트. prod 코드에 포함되지만
          ?print-picker=1 없이는 절대 노출 안 됨. */}
      {pickerEnabled && pickerForObjectId && (() => {
        const target = allObjects.find(o => o.objectId === pickerForObjectId);
        if (!target) return null;
        return (
          <PrintMethodPickerSheet
            isOpen={true}
            currentMethod={target.printMethod}
            objectLabel={`${getObjectTypeName(target.type)} · ${target.sideName}`}
            onSelect={(method) => {
              setObjectPrintMethod(target.objectId, method);
              setPickerForObjectId(null);
            }}
            onClose={() => setPickerForObjectId(null)}
          />
        );
      })()}
    </div>
  );
};

export default ObjectPreviewPanel;
