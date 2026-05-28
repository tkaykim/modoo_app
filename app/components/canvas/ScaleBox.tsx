'use client'
import React from 'react';

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
 * below selected canvas objects
 */
const ScaleBox: React.FC<ScaleBoxProps> = () => {
  // 고객에게 실측 크기/위치(mm) 노출 금지 — 실측 오차로 인한 컴플레인 방지.
  // 내부 치수 계산·저장(__mmPerPxCalibrationNative, dimensionsMm)은 그대로 유지되어
  // admin/제작 단계에서는 정상적으로 확인 가능.
  return null;
};

export default ScaleBox;
