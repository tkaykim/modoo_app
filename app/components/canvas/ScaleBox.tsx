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
}

/**
 * ScaleBox component that displays real-world dimensions and position (in mm)
 * below selected canvas objects.
 *
 * 크기/위치(mm)는 ?show-size=1 일 때만 노출. 기본(고객)은 숨김 — 실측 오차
 * 컴플레인 방지. 내부 계산·저장(dimensionsMm 등)은 항상 유지되어 admin은 그대로 봄.
 */
const ScaleBox: React.FC<ScaleBoxProps> = ({ x, y, width, height, position, visible }) => {
  const showSize = useShowSize();
  if (!visible || !showSize) return null;

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
          <div className="flex items-center gap-2">
            <span className="text-white/60">Position:</span>
            <span>X: {x}</span>
            <span className="text-white/40">|</span>
            <span>Y: {y}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/60">Size:</span>
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
