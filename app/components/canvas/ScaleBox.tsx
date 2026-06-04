'use client'
import React from 'react';
import { useShowSize } from '@/lib/useShowSize';

interface ScaleBoxProps {
  x: string;
  y: string;
  width: string;
  height: string;
  position: {
    x: number;
    y: number;
  };
  visible: boolean;
  /** 인쇄영역 실측이 있는 면에서 고객에게도 크기(cm)를 노출. ?show-size 없이도 Size만 표시. */
  forceShow?: boolean;
}

/**
 * ScaleBox component that displays real-world size (cm) below selected objects.
 *
 * 노출 규칙:
 * - `?show-size=1`(개발/관리) → Position + Size 모두 표시.
 * - `forceShow`(인쇄영역 실측이 있는 제품) → 고객에게 Size(cm)만 표시. 환산이
 *   정확한 면에서만 켜져 실측 오차 컴플레인을 피한다.
 * - 둘 다 아니면 숨김. 내부 계산·저장은 항상 유지되어 admin은 그대로 봄.
 */
const ScaleBox: React.FC<ScaleBoxProps> = ({ x, y, width, height, position, visible, forceShow = false }) => {
  const showSize = useShowSize();
  if (!visible || (!showSize && !forceShow)) return null;

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, 0)',
      }}
    >
      <div className="bg-black/80 text-white px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-1 text-xs font-medium whitespace-nowrap">
          {showSize && (
            <div className="flex items-center gap-2">
              <span className="text-white/60">Position:</span>
              <span>X: {x}</span>
              <span className="text-white/40">|</span>
              <span>Y: {y}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-white/60">크기:</span>
            <span>{width}</span>
            <span className="text-white/60">×</span>
            <span>{height}</span>
          </div>
        </div>
      </div>
      {/* Arrow pointing up to object */}
      <div
        className="absolute left-1/2 w-0 h-0"
        style={{
          top: -6,
          transform: 'translateX(-50%)',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: '6px solid rgba(0, 0, 0, 0.8)',
        }}
      />
    </div>
  );
};

export default ScaleBox;
