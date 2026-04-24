'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, LayoutTemplate } from 'lucide-react';
import { TemplatePickerItem } from '@/types/types';
import { getProductTemplates, getTemplate } from '@/lib/templateService';
import { useCanvasStore } from '@/store/useCanvasStore';
import TemplateCard from './TemplateCard';
import { trackDesignAction } from '@/lib/gtm-events';

interface TemplatePickerProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({ productId, isOpen, onClose }) => {
  const [templates, setTemplates] = useState<TemplatePickerItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { restoreAllCanvasState, incrementCanvasVersion, setLayerColor } = useCanvasStore();

  // Fetch templates when modal opens
  useEffect(() => {
    if (isOpen && productId) {
      fetchTemplates();
    }
  }, [isOpen, productId]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplateId(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProductTemplates(productId);
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError('템플릿을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;

    setIsApplying(true);
    try {
      const template = await getTemplate(selectedTemplateId);

      if (!template) {
        setError('템플릿을 불러오는데 실패했습니다.');
        return;
      }

      // Apply template canvas state
      restoreAllCanvasState(template.canvas_state);

      // Apply layer colors if present
      if (template.layer_colors && Object.keys(template.layer_colors).length > 0) {
        // Iterate through each side's layer colors
        for (const [sideId, layerColorMap] of Object.entries(template.layer_colors)) {
          if (layerColorMap && typeof layerColorMap === 'object') {
            for (const [layerId, hexColor] of Object.entries(layerColorMap)) {
              setLayerColor(sideId, layerId, hexColor as string);
            }
          }
        }
      }

      // Trigger pricing recalculation
      incrementCanvasVersion();

      trackDesignAction({ action_type: 'template_apply', product_id: productId });

      onClose();
    } catch (err) {
      console.error('Failed to apply template:', err);
      setError('템플릿 적용에 실패했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Center Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="size-5" />
              <h2 className="text-lg font-semibold">템플릿 선택</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                <p className="text-sm">{error}</p>
                <button
                  onClick={fetchTemplates}
                  className="mt-2 text-sm text-black underline"
                >
                  다시 시도
                </button>
              </div>
            ) : templates.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                <LayoutTemplate className="size-12 text-gray-300 mb-2" />
                <p className="text-sm">사용 가능한 템플릿이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplateId === template.id}
                    onSelect={() => setSelectedTemplateId(template.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer with Apply button */}
          <div className="shrink-0 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              취소
            </button>
            <button
              onClick={handleApplyTemplate}
              disabled={!selectedTemplateId || isApplying}
              className={`px-6 py-2.5 rounded-lg font-medium transition ${
                selectedTemplateId && !isApplying
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isApplying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  적용 중...
                </span>
              ) : (
                '템플릿 적용'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TemplatePicker;
