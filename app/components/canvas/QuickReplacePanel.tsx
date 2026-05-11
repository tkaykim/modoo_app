'use client';

import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Image as ImageIcon, Type, Edit3 } from 'lucide-react';
import type {
  DesignTemplate,
  TemplateGroup,
  ImageSlot,
  Product,
  CompositionSlot,
  CompositionImageSlot,
  PlacementMap,
} from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { replaceImageSlot, replaceTextSlot } from '@/lib/slotReplacement';
import SlotImageCropper from './SlotImageCropper';
import { trackDesignAction } from '@/lib/gtm-events';

interface Props {
  template: DesignTemplate;
  /** Optional — group meta when this template is group-bound. */
  group?: TemplateGroup | null;
  product: Product;
  onProceed: () => void;
  onAdvancedEdit: () => void;
  onOpenColorModal: () => void;
  formattedPrice: string;
}

/**
 * Unified internal row used by the panel — collapses both the legacy
 * (image_slots/text_slots) and the new group composition (CompositionSlot +
 * placement_map) shapes into one render-friendly structure.
 */
type SlotRow =
  | {
      kind: 'image';
      slot_id: string;
      side_id: string;
      label: string;
      thumbnail_url: string | null;
      // Adapter to drive SlotImageCropper from either source
      cropperSlot: ImageSlot;
    }
  | {
      kind: 'text';
      slot_id: string;
      side_id: string;
      label: string;
      placeholder?: string;
      max_length?: number;
    };

const QuickReplacePanel: React.FC<Props> = ({
  template,
  group,
  product,
  onProceed,
  onAdvancedEdit,
  onOpenColorModal,
  formattedPrice,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeImageSlot, setActiveImageSlot] = useState<ImageSlot | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const incrementCanvasVersion = useCanvasStore((s) => s.incrementCanvasVersion);

  /** Produce unified rows from either composition or legacy slot manifests. */
  const rows = useMemo<SlotRow[]>(() => {
    const out: SlotRow[] = [];

    // Group composition path (preferred when present)
    const compSlots: CompositionSlot[] = group?.design_composition?.slots ?? [];
    const placement = (template.placement_map ?? {}) as PlacementMap;
    if (compSlots.length > 0) {
      for (const s of compSlots) {
        const place = placement[s.slot_id];
        if (!place) continue; // unplaced — hide from customer
        if (s.kind === 'text') {
          out.push({
            kind: 'text',
            slot_id: s.slot_id,
            side_id: place.side_id,
            label: s.label,
            placeholder: s.placeholder ?? s.default_text,
            max_length: s.max_length,
          });
        } else {
          const im = s as CompositionImageSlot;
          out.push({
            kind: 'image',
            slot_id: im.slot_id,
            side_id: place.side_id,
            label: im.label,
            thumbnail_url: im.default_image_url || null,
            // Adapt to legacy ImageSlot shape so SlotImageCropper can reuse
            cropperSlot: {
              slot_id: im.slot_id,
              side_id: place.side_id,
              label: im.label,
              default_image_url: im.default_image_url,
              aspect_ratio: im.aspect_ratio,
              print_method_id: place.print_method_id ?? im.print_method_id ?? '',
              accepts: im.accepts,
              bg_removal_default: im.bg_removal_default,
            },
          });
        }
      }
      return out;
    }

    // Legacy single-template path
    for (const s of template.image_slots ?? []) {
      out.push({
        kind: 'image',
        slot_id: s.slot_id,
        side_id: s.side_id,
        label: s.label,
        thumbnail_url: s.default_image_url || null,
        cropperSlot: s,
      });
    }
    for (const s of template.text_slots ?? []) {
      out.push({
        kind: 'text',
        slot_id: s.slot_id,
        side_id: s.side_id,
        label: s.label,
        placeholder: s.placeholder,
        max_length: s.max_length,
      });
    }
    return out;
  }, [group, template.image_slots, template.text_slots, template.placement_map]);

  const groupedRows = useMemo(() => {
    const map: Record<string, SlotRow[]> = {};
    for (const r of rows) {
      if (!map[r.side_id]) map[r.side_id] = [];
      map[r.side_id].push(r);
    }
    return map;
  }, [rows]);

  const sideName = (sideId: string): string =>
    product.configuration.find((s) => s.id === sideId)?.name || sideId;

  const handleImageReplaced = async (row: Extract<SlotRow, { kind: 'image' }>, url: string) => {
    const ok = await replaceImageSlot(row.side_id, row.slot_id, url);
    if (ok) {
      trackDesignAction({
        action_type: 'slot_image_replace',
        product_id: product.id,
        side_id: row.side_id,
      });
    }
  };

  const handleTextChange = (slotId: string, value: string) => {
    setTextValues((prev) => ({ ...prev, [slotId]: value }));
  };
  const commitText = (row: Extract<SlotRow, { kind: 'text' }>) => {
    const value = textValues[row.slot_id];
    if (value === undefined) return;
    const ok = replaceTextSlot(row.side_id, row.slot_id, value);
    if (ok) {
      trackDesignAction({
        action_type: 'slot_text_replace',
        product_id: product.id,
        side_id: row.side_id,
      });
    }
  };

  const handleProceed = () => {
    trackDesignAction({ action_type: 'template_to_quantity', product_id: product.id });
    onProceed();
  };

  const sides = Object.keys(groupedRows);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] rounded-t-2xl
                   lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto lg:top-0 lg:w-96 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-xl
                   transition-[max-height] duration-200"
        style={{ maxHeight: collapsed ? '64px' : '70vh' }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="lg:hidden w-full flex flex-col items-center pt-2 pb-1"
          aria-label="패널 접기/펼치기"
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </button>

        <div className="px-4 pt-2 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">
              {group ? '디자인 그룹' : '템플릿'}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[60vw]">
              {group?.title ?? template.title}
            </p>
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

                  {(groupedRows[sideId] ?? []).map((row) =>
                    row.kind === 'image' ? (
                      <div
                        key={row.slot_id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200"
                      >
                        <div className="size-14 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                          {row.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.thumbnail_url} alt={row.label} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="size-6 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{row.label}</p>
                          <p className="text-[11px] text-gray-400">
                            {row.cropperSlot.accepts === 'logo' ? '로고' : '사진'} · 비율 {row.cropperSlot.aspect_ratio.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveImageSlot(row.cropperSlot)}
                          className="px-3 py-1.5 rounded-md bg-black text-white text-xs font-medium hover:bg-gray-800"
                        >
                          교체
                        </button>
                      </div>
                    ) : (
                      <div key={row.slot_id} className="p-3 rounded-lg border border-gray-200">
                        <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                          <Type className="size-3.5" />
                          {row.label}
                        </label>
                        <input
                          type="text"
                          defaultValue=""
                          placeholder={row.placeholder ?? ''}
                          maxLength={row.max_length}
                          onChange={(e) => handleTextChange(row.slot_id, e.target.value)}
                          onBlur={() => commitText(row)}
                          className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-black"
                        />
                      </div>
                    ),
                  )}
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

      {activeImageSlot && (
        <SlotImageCropper
          slot={activeImageSlot}
          isOpen={!!activeImageSlot}
          onClose={() => setActiveImageSlot(null)}
          onUploaded={(url) => {
            const slot = activeImageSlot;
            setActiveImageSlot(null);
            const matchingRow = rows.find(
              (r) => r.kind === 'image' && r.slot_id === slot.slot_id,
            );
            if (matchingRow && matchingRow.kind === 'image') {
              void handleImageReplaced(matchingRow, url);
            }
            void incrementCanvasVersion;
          }}
        />
      )}
    </>
  );
};

export default QuickReplacePanel;
