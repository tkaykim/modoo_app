'use client';

import React, { useMemo, useState } from 'react';
import * as fabric from 'fabric';
import {
  X,
  Layers as LayersIcon,
  Image as ImageIcon,
  Type,
  Square,
  Printer,
  Check,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ProductSide, PrintMethod } from '@/types/types';
import { PRINT_METHOD_META, getPrintMethodLabel } from '@/lib/printPricingConfig';
import { useShowSize } from '@/lib/useShowSize';

export interface LayerInfo {
  objectId: string;
  type: string;
  sideId: string;
  sideName: string;
  widthMm: number;
  heightMm: number;
  preview: string;
  printMethod: PrintMethod;
  /** 객체 식별용 디스플레이 라벨 ("로고.png", "SEOIL '26" 등). 없으면 type 기본. */
  displayName: string;
  /** 부제 정보 (font size·color·dimensions 등 v2 EditorLayers 패턴) */
  subInfo: string;
}

interface LayersPrintPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sides: ProductSide[];
  /**
   * mock 데이터로 디자인 검토만 할 때 (e.g. /lab/layers-print).
   * 주면 fabric canvas 구독을 건너뛰고 이 배열을 그대로 보여준다.
   * setObjectPrintMethod도 실행 안 함(UI만 변경되는 시연 용도).
   */
  mockLayers?: LayerInfo[];
}

// 표시 순서. Phase 1: DTF만 active. 나머진 데이터 모델 자리만.
const METHOD_ORDER: PrintMethod[] = ['dtf', 'dtg', 'screen_printing', 'embroidery', 'applique'];

/**
 * Layers × PrintMethod 통합 패널 (실험 / 메인 에디터 게이트 마운트).
 *
 * v2 EditorLayers 디자인 베이스 + 각 레이어 row 안에 인쇄방식 inline expand.
 * - useCanvasStore에 구독해서 실 fabric 객체 + 객체별 printMethod 표시
 * - row 클릭 → 인쇄방식 카드 expand (모달 X — 컨텍스트 유지)
 * - DTF만 active. 나머지 4종은 "준비 중" 배지 + 클릭 시 inline toast
 *
 * 가격 산정 흐름 미관여 (canvasPricing.ts는 모두 dtf 하드코드 유지).
 * Phase 2 시점에 setObjectPrintMethod가 가격에도 반영되도록 canvasPricing 수정.
 */
export default function LayersPrintPanel({ isOpen, onClose, sides, mockLayers }: LayersPrintPanelProps) {
  const { canvasMap, canvasVersion, setObjectPrintMethod } = useCanvasStore();
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // mock 모드에서 사용자 선택을 시연하기 위한 in-memory state.
  // 실제 fabric data는 안 건드림 (canvasMap 비어있을 수 있음).
  const [mockOverrides, setMockOverrides] = useState<Record<string, PrintMethod>>({});

  // Toast 자동 해제
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const showSize = useShowSize();

  const allLayers: LayerInfo[] = useMemo(() => {
    // mock 모드: 입력 그대로 + override 적용
    if (mockLayers) {
      return mockLayers.map((l) => ({
        ...l,
        printMethod: mockOverrides[l.objectId] ?? l.printMethod,
      }));
    }

    const layers: LayerInfo[] = [];

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

      const userObjects = canvas.getObjects().filter((obj) => {
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

        // Preview 썸네일
        let preview = '';
        try {
          const padding = 20;
          const left = Math.max(0, boundingRect.left - padding);
          const top = Math.max(0, boundingRect.top - padding);
          const width = boundingRect.width + padding * 2;
          const height = boundingRect.height + padding * 2;
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
          // 무시
        }

        // printMethod 안전 타입가드
        // @ts-expect-error - Accessing custom data property
        const rawMethod = obj.data?.printMethod as string | undefined;
        const printMethod: PrintMethod =
          rawMethod === 'dtf' || rawMethod === 'dtg' || rawMethod === 'screen_printing' ||
          rawMethod === 'embroidery' || rawMethod === 'applique'
            ? rawMethod
            : 'dtf';

        // 객체 type별 디스플레이 정보 (v2 EditorLayers 패턴)
        let displayName = '오브젝트';
        let subInfo = '';
        const objType = obj.type || 'unknown';
        if (objType === 'image') {
          displayName = '이미지';
          // @ts-expect-error - Fabric Image src
          const src = obj.getSrc?.() || obj.src || '';
          if (src) {
            const filename = String(src).split('/').pop()?.split('?')[0]?.slice(0, 24);
            if (filename) displayName = filename;
          }
          // 실측 크기는 ?show-size=1 일 때만 노출 — prod 고객은 숨김.
          // widthMm/heightMm는 mm 단위 → cm 표기 시 ÷10 (기존 라벨 버그 수정).
          subInfo = showSize
            ? `${Math.round(boundingRect.width)}×${Math.round(boundingRect.height)}px · ${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)}cm`
            : '';
        } else if (objType === 'i-text' || objType === 'text' || objType === 'textbox') {
          const textObj = obj as fabric.IText;
          const text = textObj.text || '';
          displayName = text.length > 20 ? text.slice(0, 20) + '…' : (text || '텍스트');
          const fontFamily = textObj.fontFamily || 'Default';
          const fontSize = textObj.fontSize || 0;
          subInfo = showSize
            ? `${fontFamily} ${Math.round(fontSize)}pt · ${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)}cm`
            : `${fontFamily} ${Math.round(fontSize)}pt`;
        } else if (objType === 'rect') {
          displayName = '사각형';
          subInfo = showSize ? `${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)}cm` : '';
        } else if (objType === 'circle') {
          displayName = '원형';
          subInfo = showSize ? `${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)}cm` : '';
        } else {
          subInfo = showSize ? `${(widthMm / 10).toFixed(1)}×${(heightMm / 10).toFixed(1)}cm` : '';
        }

        layers.push({
          objectId,
          type: objType,
          sideId: side.id,
          sideName: side.name,
          widthMm,
          heightMm,
          preview,
          printMethod,
          displayName,
          subInfo,
        });
      });
    });

    return layers;
  }, [canvasMap, sides, canvasVersion, mockLayers, mockOverrides, showSize]);

  if (!isOpen) return null;

  const getLayerIcon = (type: string) => {
    if (type === 'image') return <ImageIcon className="w-4 h-4" />;
    if (type === 'i-text' || type === 'text' || type === 'textbox') return <Type className="w-4 h-4" />;
    return <Square className="w-4 h-4" />;
  };

  const handleMethodPick = (objectId: string, method: PrintMethod) => {
    const meta = PRINT_METHOD_META[method];
    if (!meta.active) {
      setToast(`${meta.label}은(는) 곧 추가될 예정입니다.`);
      return;
    }
    if (mockLayers) {
      // mock 모드: in-memory만 변경, fabric data 비건드림.
      setMockOverrides((prev) => ({ ...prev, [objectId]: method }));
    } else {
      setObjectPrintMethod(objectId, method);
    }
    setExpandedLayerId(null);
    setToast(`${meta.label}(으)로 변경되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white pt-3 pb-3 border-b border-gray-200 z-10 rounded-t-2xl">
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <LayersIcon className="w-5 h-5 text-gray-800" />
              <h2 className="text-lg font-bold text-gray-900">레이어 & 인쇄방식</h2>
              <span className="text-sm font-semibold text-gray-500 ml-1">({allLayers.length})</span>
            </div>
            <button
              onClick={onClose}
              className="text-sm font-semibold text-[#0052CC] px-3 py-1 hover:bg-blue-50 rounded-lg transition"
              aria-label="닫기"
            >
              완료
            </button>
          </div>
        </div>

        {/* Layers */}
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
          {allLayers.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              아직 추가된 디자인 요소가 없습니다.
              <br />
              에디터에서 이미지·텍스트·도형을 추가해보세요.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                각 디자인 요소마다 인쇄방식을 다르게 적용할 수 있습니다. 현재는 DTF 전사만 운영 중이며,
                다른 방식은 단가 정책이 준비되는 대로 차례로 열립니다.
              </p>

              {allLayers.map((layer) => {
                const isExpanded = expandedLayerId === layer.objectId;
                const methodMeta = PRINT_METHOD_META[layer.printMethod];

                return (
                  <div
                    key={layer.objectId}
                    className={`border rounded-xl bg-white transition ${
                      isExpanded ? 'border-black' : 'border-gray-200'
                    }`}
                  >
                    {/* Layer row */}
                    <div className="flex items-start gap-3 p-3">
                      {/* Preview thumbnail */}
                      <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                        {layer.preview ? (
                          <img
                            src={layer.preview}
                            alt={layer.displayName}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-gray-400">{getLayerIcon(layer.type)}</span>
                        )}
                      </div>

                      {/* Layer info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-gray-500">{getLayerIcon(layer.type)}</span>
                          <span className="text-sm font-bold text-gray-900 truncate">
                            {layer.displayName}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-1 shrink-0">
                            · {layer.sideName}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{layer.subInfo}</p>

                        {/* Print method chip */}
                        <button
                          onClick={() => setExpandedLayerId(isExpanded ? null : layer.objectId)}
                          aria-expanded={isExpanded}
                          aria-controls={`method-options-${layer.objectId}`}
                          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition px-2 py-1 rounded-md"
                        >
                          <Printer className="w-3 h-3" />
                          {getPrintMethodLabel(layer.printMethod)}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Inline method picker (expand) */}
                    {isExpanded && (
                      <div
                        id={`method-options-${layer.objectId}`}
                        className="border-t border-gray-100 px-3 py-3 bg-gray-50 rounded-b-xl space-y-1.5"
                      >
                        {METHOD_ORDER.map((method) => {
                          const meta = PRINT_METHOD_META[method];
                          const isSelected = layer.printMethod === method;
                          const isDisabled = !meta.active;

                          return (
                            <button
                              key={method}
                              onClick={() => handleMethodPick(layer.objectId, method)}
                              aria-disabled={isDisabled}
                              className={`w-full text-left rounded-lg border p-2.5 transition flex items-start gap-2.5 ${
                                isSelected && !isDisabled
                                  ? 'border-black bg-white'
                                  : 'border-gray-200 bg-white hover:border-gray-400'
                              } ${isDisabled ? 'opacity-55' : ''}`}
                            >
                              {/* Radio */}
                              <div
                                className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                                  isSelected && !isDisabled
                                    ? 'border-black bg-black'
                                    : 'border-gray-300'
                                }`}
                              >
                                {isSelected && !isDisabled && (
                                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                )}
                              </div>

                              {/* Method info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-gray-900">{meta.label}</span>
                                  <span className="text-[10px] text-gray-500">· {meta.subLabel}</span>
                                  {isDisabled && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded">
                                      <Lock className="w-2.5 h-2.5" />
                                      준비 중
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">
                                  {meta.description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {meta.pros.slice(0, 3).map((p) => (
                                    <span
                                      key={p}
                                      className="text-[9px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded"
                                    >
                                      + {p}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Best-for chip */}
                              <div className="text-right shrink-0">
                                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                  추천
                                </div>
                                <div className="text-[10px] text-gray-700 font-medium">{meta.best}</div>
                              </div>
                            </button>
                          );
                        })}

                        {/* Foot note */}
                        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                          현재 선택: <span className="font-semibold text-gray-700">{methodMeta.label}</span>
                          {' · '}
                          가격 산정 흐름은 Phase 2에서 객체별로 분리됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-20 pointer-events-none"
            role="status"
            aria-live="polite"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
