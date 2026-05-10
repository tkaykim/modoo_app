'use client';

import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Image as ImageIcon, Type, Edit3 } from 'lucide-react';
import type { DesignTemplate, ImageSlot, TextSlot, Product } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { replaceImageSlot, replaceTextSlot } from '@/lib/slotReplacement';
import SlotImageCropper from './SlotImageCropper';
import { trackDesignAction } from '@/lib/gtm-events';

interface Props {
  template: DesignTemplate;
  product: Product;
  onProceed: () => void;          // → quantity step
  onAdvancedEdit: () => void;     // → switch to full editor
  onOpenColorModal: () => void;   // open existing ColorSelectorModal
  formattedPrice: string;         // current per-unit price (string, "12,000원")
}

const QuickReplacePanel: React.FC<Props> = ({
  template,
  product,
  onProceed,
  onAdvancedEdit,
  onOpenColorModal,
  formattedPrice,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSlot, setActiveSlot] = useState<ImageSlot | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const incrementCanvasVersion = useCanvasStore((s) => s.incrementCanvasVersion);

  // Group slots by side for clearer UX on multi-side products.
  const groupedImage = useMemo(() => groupBySide(template.image_slots), [template.image_slots]);
  const groupedText = useMemo(() => groupBySide(template.text_slots), [template.text_slots]);

  const sideName = (sideId: string): string => {
    const side = product.configuration.find((s) => s.id === sideId);
    return side?.name || sideId;
  };

  const handleImageReplaced = async (slot: ImageSlot, url: string) => {
    const ok = await replaceImageSlot(slot.side_id, slot.slot_id, url);
    if (ok) {
      trackDesignAction({
        action_type: 'slot_image_replace',
        product_id: product.id,
        side_id: slot.side_id,
      });
    }
  };

  const handleTextChange = (slot: TextSlot, value: string) => {
    setTextValues((prev) => ({ ...prev, [slot.slot_id]: value }));
  };
  const commitText = (slot: TextSlot) => {
    const value = textValues[slot.slot_id];
    if (value === undefined) return;
    const ok = replaceTextSlot(slot.side_id, slot.slot_id, value);
    if (ok) {
      trackDesignAction({
        action_type: 'slot_text_replace',
        product_id: product.id,
        side_id: slot.side_id,
      });
    }
  };

  const handleProceed = () => {
    trackDesignAction({ action_type: 'template_to_quantity', product_id: product.id });
    onProceed();
  };

  const sides = Array.from(new Set([
    ...Object.keys(groupedImage),
    ...Object.keys(groupedText),
  ]));

  return (
    <>
      {/* Mobile: bottom sheet. Desktop: right side panel. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] rounded-t-2xl
                   lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto lg:top-0 lg:w-96 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-xl
                   transition-[max-height] duration-200"
        style={{ maxHeight: collapsed ? '64px' : '70vh' }}
      >
        {/* Drag handle / collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="lg:hidden w-full flex flex-col items-center pt-2 pb-1"
          aria-label="패널 접기/펼치기"
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </button>

        <div className="px-4 pt-2 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">템플릿</p>
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[60vw]">{template.title}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">개당</p>
            <p className="text-base font-bold text-gray-900">{formattedPrice}</p>
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:inline-flex p-1.5 ml-2 rounded-full hover:bg-gray-100"
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="overflow-y-auto p-4 space-y-5" style={{ maxHeight: 'calc(70vh - 160px)' }}>
            {/* Color picker shortcut */}
            <button
              onClick={onOpenColorModal}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm flex items-center justify-between hover:bg-gray-50"
            >
              <span>의류 색상 선택</span>
              <span className="text-xs text-gray-400">자유 변경 가능</span>
            </button>

            {sides.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                이 템플릿은 교체 가능한 영역이 지정되어 있지 않습니다.
              </p>
            ) : (
              sides.map((sideId) => (
                <section key={sideId} className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {sideName(sideId)}
                  </h4>

                  {(groupedImage[sideId] ?? []).map((slot) => (
                    <div
                      key={slot.slot_id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200"
                    >
                      <div className="size-14 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                        {slot.default_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={slot.default_image_url} alt={slot.label} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="size-6 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{slot.label}</p>
                        <p className="text-[11px] text-gray-400">
                          {slot.accepts === 'logo' ? '로고' : '사진'} · 비율 {slot.aspect_ratio.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveSlot(slot)}
                        className="px-3 py-1.5 rounded-md bg-black text-white text-xs font-medium hover:bg-gray-800"
                      >
                        교체
                      </button>
                    </div>
                  ))}

                  {(groupedText[sideId] ?? []).map((slot) => (
                    <div key={slot.slot_id} className="p-3 rounded-lg border border-gray-200">
                      <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                        <Type className="size-3.5" />
                        {slot.label}
                      </label>
                      <input
                        type="text"
                        defaultValue=""
                        placeholder={slot.placeholder ?? ''}
                        maxLength={slot.max_length}
                        onChange={(e) => handleTextChange(slot, e.target.value)}
                        onBlur={() => commitText(slot)}
                        className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                  ))}
                </section>
              ))
            )}

            <button
              onClick={onAdvancedEdit}
              className="w-full text-xs text-gray-500 underline flex items-center justify-center gap-1.5 py-2"
            >
              <Edit3 className="size-3.5" />
              고급 편집으로 자유롭게 수정
            </button>
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleProceed}
            className="w-full py-3 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800"
          >
            수량 선택 →
          </button>
        </div>
      </div>

      {activeSlot && (
        <SlotImageCropper
          slot={activeSlot}
          isOpen={!!activeSlot}
          onClose={() => setActiveSlot(null)}
          onUploaded={(url) => {
            const slot = activeSlot;
            setActiveSlot(null);
            void handleImageReplaced(slot, url);
            // store version bump already handled inside replaceImageSlot
            void incrementCanvasVersion;
          }}
        />
      )}
    </>
  );
};

function groupBySide<T extends { side_id: string }>(arr: T[] | undefined | null): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  (arr ?? []).forEach((item) => {
    if (!map[item.side_id]) map[item.side_id] = [];
    map[item.side_id].push(item);
  });
  return map;
}

export default QuickReplacePanel;
