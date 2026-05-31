'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, Loader2 } from 'lucide-react';
import { ProductSide } from '@/types/types';

const DesignEditorViewer = dynamic(
  () => import('@/app/components/cobuy/DesignEditorViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand mb-3" />
        <p className="text-sm text-gray-500">디자인을 불러오는 중...</p>
      </div>
    ),
  }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySide = any;

interface DesignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  designTitle: string | null;
  productId: string;
  sides: AnySide[];
  canvasState: Record<string, string> | null;
  productColor?: string;
  fallbackImageUrl?: string;
}

export default function DesignPreviewModal({
  isOpen,
  onClose,
  productTitle,
  designTitle,
  productId,
  sides,
  canvasState,
  productColor,
  fallbackImageUrl,
}: DesignPreviewModalProps) {
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    if (isOpen && canvasState && sides.length > 0) {
      setShowViewer(true);
    }
    if (!isOpen) {
      setShowViewer(false);
    }
  }, [isOpen, canvasState, sides.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasCanvasData = canvasState && Object.keys(canvasState).length > 0 && sides.length > 0;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-[95vw] max-h-[90vh] w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {productTitle}
            </h3>
            {designTitle && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {designTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {hasCanvasData && showViewer ? (
            <div className="w-full h-full" style={{ minHeight: 400 }}>
              <DesignEditorViewer
                config={{ productId, sides: sides as ProductSide[] }}
                canvasState={canvasState}
                productColor={productColor || '#FFFFFF'}
              />
            </div>
          ) : fallbackImageUrl ? (
            <div className="p-4 bg-gray-100">
              <img
                src={fallbackImageUrl}
                alt={productTitle}
                className="w-full aspect-square object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 bg-gray-100">
              <p className="text-sm text-gray-400">
                미리보기를 불러올 수 없습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
