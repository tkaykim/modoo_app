'use client';

import React from 'react';
import { MapPin, X } from 'lucide-react';
import type { AnchorPreset } from '@/lib/anchorPresets';
import { resolveAnchorLabel } from '@/lib/anchorPresets';
import { useShowSize } from '@/lib/useShowSize';

interface AnchorPresetPanelProps {
  open: boolean;
  onClose: () => void;
  anchors: AnchorPreset[];
  hasSelectedArtwork: boolean;
  onPick: (anchor: AnchorPreset) => void;
  /** 행 호버 시 해당 앵커만 캔버스에 미리보기(라벨 포함). 벗어나면 null. */
  onHoverAnchor?: (anchor: AnchorPreset | null) => void;
  variant?: 'mobile' | 'desktop' | 'sidebar';
}

const AnchorPresetPanel: React.FC<AnchorPresetPanelProps> = ({
  open,
  onClose,
  anchors,
  hasSelectedArtwork,
  onPick,
  onHoverAnchor,
  variant = 'mobile',
}) => {
  // hook은 early return 이전에 (rules of hooks)
  const showSize = useShowSize();
  if (!open) return null;

  const isMobile = variant === 'mobile';

  const list = (
    <>
      {!hasSelectedArtwork && (
        <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-2 mb-2">
          먼저 이미지를 선택하세요. 선택된 이미지가 자동으로 위치와 크기에 맞춰집니다.
        </div>
      )}
      {anchors.length === 0 ? (
        <div className="text-xs text-gray-500 px-2 py-4 text-center">
          이 면에 등록된 위치가 아직 없습니다.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {anchors.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={!hasSelectedArtwork}
                onClick={() => onPick(a)}
                onMouseEnter={() => onHoverAnchor?.(a)}
                onMouseLeave={() => onHoverAnchor?.(null)}
                className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <div className="flex items-center gap-1.5 font-medium text-sm text-gray-900">
                  <MapPin className="size-4 text-gray-400 shrink-0" />
                  {resolveAnchorLabel(a)}
                </div>
                {/* 좌표·권장 크기(mm)는 ?show-size=1 일 때만 노출 — prod 고객은 숨김. */}
                {showSize && (
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    ({a.xMm.toFixed(0)}, {a.yMm.toFixed(0)})mm · 권장 {a.recommendedWidthMm.toFixed(0)}×{a.recommendedHeightMm.toFixed(0)}mm
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // 데스크톱: 우측 사이드바(aside)에 도킹. 헤더/스크롤 컨테이너는 부모가 제공하므로
  // 리스트 본문만 반환한다.
  if (variant === 'sidebar') {
    return list;
  }

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
          aria-hidden
        />
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[60vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-base">자주 쓰는 위치</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition p-1 -mr-1"
              aria-label="닫기"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{list}</div>
        </div>
      </>
    );
  }

  // Desktop: 하단 중앙 플로팅 카드. 제품 패널(우측)과 겹치지 않고, 캔버스 위 앵커
  // 미리보기가 보이도록 배경은 투명 클릭캐처(딤 없음)로 둔다.
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[400px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[60vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-base">자주 쓰는 위치</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition p-1 -mr-1"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{list}</div>
      </div>
    </>
  );
};

export default AnchorPresetPanel;
