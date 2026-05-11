'use client';

import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Image as ImageIcon, Type, Edit3 } from 'lucide-react';
import type {
  DesignTemplate,
  TemplateGroup,
  ImageSlot,
  Product,
  SlotManifestEntry,
  SlotManifestImageEntry,
} from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { replaceImageSlot, replaceTextSlot } from '@/lib/slotReplacement';
import {
  findTemplateGroup,
  findSlotObjectInGroup,
  replaceGroupTextSlot,
  replaceGroupImageSlot,
} from '@/lib/templateGroupComposer';
import SlotImageCropper from './SlotImageCropper';
import { trackDesignAction } from '@/lib/gtm-events';

interface Props {
  template: DesignTemplate;
  /** Optional — group meta when this template is group-bound (new model). */
  group?: TemplateGroup | null;
  product: Product;
  onProceed: () => void;
  onAdvancedEdit: () => void;
  onOpenColorModal: () => void;
  formattedPrice: string;
}

/**
 * Internal row: collapses both the new group slot_manifest and the legacy
 * image_slots/text_slots into one render-friendly structure.
 */
type SlotRow =
  | {
      kind: 'image';
      slot_id: string;        // for legacy = slot_id, for group = object_id
      side_id: string;
      label: string;
      thumbnail_url: string | null;
      cropperSlot: ImageSlot;  // adapted shape for SlotImageCropper
      source: 'group' | 'legacy';
    }
  | {
      kind: 'text';
      slot_id: string;
      side_id: string;
      label: string;
      placeholder?: string;
      max_length?: number;
      source: 'group' | 'legacy';
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
  const [activeImageSlot, setActiveImageSlot] = useState<{ slot: ImageSlot; source: 'group' | 'legacy' } | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const incrementCanvasVersion = useCanvasStore((s) => s.incrementCanvasVersion);
  const canvasMap = useCanvasStore((s) => s.canvasMap);

  /** Helper: resolve current image src for a group slot from the live canvas. */
  const groupSlotThumbnail = (objectId: string): string | null => {
    if (!group || !template.side_id) return null;
    const canvas = canvasMap[template.side_id];
    if (!canvas) return null;
    const fGroup = findTemplateGroup(canvas);
    if (!fGroup) return null;
    const obj = findSlotObjectInGroup(fGroup, objectId);
    if (obj && obj.type === 'image') {
      try {
        return (obj as import('fabric').FabricImage).getSrc?.() ?? null;
      } catch {
        return null;
      }
    }
    return null;
  };

  /** Produce unified rows from either new group manifest or legacy slot manifests. */
  const rows = useMemo<SlotRow[]>(() => {
    const out: SlotRow[] = [];

    // NEW: group slot_manifest path
    if (group && Array.isArray(group.slot_manifest) && group.slot_manifest.length > 0 && template.side_id) {
      for (const entry of group.slot_manifest as SlotManifestEntry[]) {
        if (entry.kind === 'text') {
          out.push({
            kind: 'text',
            slot_id: entry.object_id,
            side_id: template.side_id,
            label: entry.label,
            placeholder: entry.placeholder,
            max_length: entry.max_length,
            source: 'group',
          });
        } else {
          const im = entry as SlotManifestImageEntry;
          const liveThumb = groupSlotThumbnail(im.object_id);
          out.push({
            kind: 'image',
            slot_id: im.object_id,
            side_id: template.side_id,
            label: im.label,
            thumbnail_url: liveThumb,
            cropperSlot: {
              slot_id: im.object_id,
              side_id: template.side_id,
              label: im.label,
              default_image_url: liveThumb ?? '',
              aspect_ratio: im.aspect_ratio ?? 1,
              print_method_id: im.print_method_id ?? '',
              accepts: im.accepts,
              bg_removal_default: im.bg_removal_default,
            },
            source: 'group',
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
        source: 'legacy',
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
        source: 'legacy',
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, template.image_slots, template.text_slots, template.side_id, canvasMap]);

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
    let ok = false;
    if (row.source === 'group' && template.side_id) {
      const canvas = canvasMap[template.side_id];
      const fGroup = canvas ? findTemplateGroup(canvas) : null;
      if (fGroup) {
        ok = await replaceGroupImageSlot(fGroup, row.slot_id, url);
        if (ok) incrementCanvasVersion();
      }
    } else {
      ok = await replaceImageSlot(row.side_id, row.slot_id, url);
    }
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
    let ok = false;
    if (row.source === 'group' && template.side_id) {
      const canvas = canvasMap[template.side_id];
      const fGroup = canvas ? findTemplateGroup(canvas) : null;
      if (fGroup) {
        ok = replaceGroupTextSlot(fGroup, row.slot_id, value);
        if (ok) incrementCanvasVersion();
      }
    } else {
      ok = replaceTextSlot(row.side_id, row.slot_id, value);
    }
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
                            {row.cropperSlot.accepts === 'logo' ? '로고' : '사진'}
                            {row.cropperSlot.aspect_ratio
                              ? ` · 비율 ${row.cropperSlot.aspect_ratio.toFixed(2)}`
                              : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveImageSlot({ slot: row.cropperSlot, source: row.source })}
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
          slot={activeImageSlot.slot}
          isOpen={!!activeImageSlot}
          onClose={() => setActiveImageSlot(null)}
          onUploaded={(url) => {
            const slot = activeImageSlot.slot;
            const source = activeImageSlot.source;
            setActiveImageSlot(null);
            const matchingRow = rows.find((r) => r.kind === 'image' && r.slot_id === slot.slot_id);
            if (matchingRow && matchingRow.kind === 'image') {
              void handleImageReplaced({ ...matchingRow, source }, url);
            }
          }}
        />
      )}
    </>
  );
};

export default QuickReplacePanel;
