'use client';

/**
 * Lab — 인쇄방식별 가격 (방식+수량 인식) 검토 페이지.
 *
 * prod 영향 0: 게이트 없는 별도 라우트(/lab/print-pricing). 손님 결제 흐름·기존
 * PricingInfo(DTF 전용 prod 경로)와 완전히 분리됨. customer_print_method_pricing
 * 실데이터를 읽어 방식 선택·수량 변경 시 가격이 정확히 반영되는지 확인하는 용도.
 */

import { useState } from 'react';
import PricingLabSection from '@/app/components/canvas/PricingLabSection';

const SIZE_PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: '10×10', w: 10, h: 10 },
  { label: 'A4 (21×29.7)', w: 21, h: 29.7 },
  { label: 'A3 (29.7×42)', w: 29.7, h: 42 },
  { label: '가로띠 25×5', w: 25, h: 5 },
  { label: 'A3 초과 50×50', w: 50, h: 50 },
];

export default function PrintPricingLabPage() {
  const [w, setW] = useState(21);
  const [h, setH] = useState(29.7);

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8 max-w-xl mx-auto">
      <header className="mb-6">
        <p className="text-xs font-semibold text-[#0052CC] uppercase tracking-wider mb-1">
          modoo LAB · Phase 2
        </p>
        <h1 className="text-2xl font-bold text-gray-900">인쇄방식별 가격</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          방식을 바꾸거나 수량을 조절하면 고객가가 실시간 반영됩니다. flat(DTF·DTG) /
          bulk(나염·자수·아플리케) 모두 실데이터(customer_print_method_pricing) 기준.
          prod 영향 0.
        </p>
      </header>

      {/* 도안 크기 컨트롤 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <p className="text-sm font-bold text-gray-900 mb-2">도안 크기</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SIZE_PRESETS.map((p) => {
            const active = p.w === w && p.h === h;
            return (
              <button
                key={p.label}
                onClick={() => {
                  setW(p.w);
                  setH(p.h);
                }}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${
                  active
                    ? 'bg-[#0052CC] text-white border-[#0052CC]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            가로
            <input
              type="number"
              min={1}
              step={0.5}
              value={w}
              onChange={(e) => setW(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
            />
            cm
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            세로
            <input
              type="number"
              min={1}
              step={0.5}
              value={h}
              onChange={(e) => setH(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
            />
            cm
          </label>
        </div>
      </section>

      {/* 가격 섹션 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <PricingLabSection artworkWidthCm={w} artworkHeightCm={h} />
      </section>

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        분기점("N벌 이상 유리")은 같은 도안에서 해당 방식 총액이 DTF 총액 이하가 되는 최소 수량을
        실시간 계산한 값입니다. prod 고객 화면은 여전히 DTF 단가만 사용합니다.
      </p>
    </div>
  );
}
