'use client'

import React, { useMemo } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ProductSide } from '@/types/types';
import { Image as ImageIcon, Type, Square } from 'lucide-react';

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
}

const ObjectPreviewPanel: React.FC<ObjectPreviewPanelProps> = ({ sides }) => {
  const { canvasMap, canvasVersion } = useCanvasStore();

  // Extract all user objects from all canvases
  const allObjects = useMemo(() => {
    const objects: CanvasObjectInfo[] = [];

    sides.forEach((side) => {
      const canvas = canvasMap[side.id];
      if (!canvas) return;

      const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;
      // @ts-expect-error - Custom property
      const scaledImageWidth = canvas.scaledImageWidth;
      const pixelToMmRatio = scaledImageWidth ? realWorldProductWidth / scaledImageWidth : 0.25;

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

        objects.push({
          objectId,
          type: obj.type || 'unknown',
          sideId: side.id,
          sideName: side.name,
          widthMm,
          heightMm,
          preview,
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
                <div className="flex items-center gap-2">
                  <span className="font-medium">너비:</span>
                  <span>{objInfo.widthMm.toFixed(1)}mm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">높이:</span>
                  <span>{objInfo.heightMm.toFixed(1)}mm</span>
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
    </div>
  );
};

export default ObjectPreviewPanel;
