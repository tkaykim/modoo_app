'use client';

/**
 * Lab — Layers × PrintMethod 통합 패널 디자인 검토 페이지.
 *
 * 두 가지 검증 트랙을 한 페이지에서 제공:
 *  1) Mock 모드: 패널 디자인을 mock LayerInfo로 렌더. fabric canvas 없이도 시각 확인 가능.
 *  2) 실 인터랙션 안내: 메인 에디터 `?layers-lab=1`로 진입해서 실 fabric + DB 단가표
 *     연결 검증하는 링크.
 *
 * prod 영향: 0. 게이트 없는 별도 라우트로, 누가 봐도 손님 결제 흐름에 영향 없음.
 */

import { useState } from 'react';
import Link from 'next/link';
import LayersPrintPanel, { type LayerInfo } from '@/app/components/canvas/LayersPrintPanel';
import type { ProductSide } from '@/types/types';

const MOCK_SIDES: ProductSide[] = [
  {
    id: 'front',
    name: '앞면',
    layers: [],
    imageUrl: '',
    printArea: { x: 0, y: 0, width: 100, height: 100 },
    realLifeDimensions: { productWidthMm: 540, printAreaWidthMm: 280, printAreaHeightMm: 360 },
  },
  {
    id: 'back',
    name: '뒷면',
    layers: [],
    imageUrl: '',
    printArea: { x: 0, y: 0, width: 100, height: 100 },
    realLifeDimensions: { productWidthMm: 540, printAreaWidthMm: 280, printAreaHeightMm: 360 },
  },
];

const MOCK_LAYERS: LayerInfo[] = [
  {
    objectId: 'mock-1',
    type: 'i-text',
    sideId: 'front',
    sideName: '앞면',
    widthMm: 152,
    heightMm: 48,
    preview: '',
    printMethod: 'dtf',
    displayName: "SEOIL '26",
    subInfo: 'Pretendard Bold 92pt · 15.2×4.8cm',
  },
  {
    objectId: 'mock-2',
    type: 'image',
    sideId: 'front',
    sideName: '앞면',
    widthMm: 82,
    heightMm: 82,
    preview: '',
    printMethod: 'dtf',
    displayName: '학교 로고.png',
    subInfo: 'PNG · 240×240px · 8.2×8.2cm',
  },
  {
    objectId: 'mock-3',
    type: 'rect',
    sideId: 'front',
    sideName: '앞면',
    widthMm: 100,
    heightMm: 60,
    preview: '',
    printMethod: 'dtf',
    displayName: '둥근 사각형',
    subInfo: '#FFD25C · 채움 · 10×6cm',
  },
  {
    objectId: 'mock-4',
    type: 'image',
    sideId: 'back',
    sideName: '뒷면',
    widthMm: 320,
    heightMm: 280,
    preview: '',
    printMethod: 'dtf',
    displayName: '백 그래픽.png',
    subInfo: 'PNG · 1.2MB · 32×28cm',
  },
];

// 메인 에디터 ?layers-lab=1 진입용 샘플 제품 (관리자 페이지에서 가져온 활성 제품 일부)
const SAMPLE_PRODUCTS: Array<{ id: string; title: string; manufacturer: string }> = [
  {
    id: 'aba4684a-bf26-4b50-9def-d26756b537bb',
    title: '스탠다드 라운드 티셔츠 (면20수)',
    manufacturer: 'Printstar',
  },
  {
    id: 'c399d04e-50f9-490a-b0f6-7b509605c1d5',
    title: '라이트 라운드 티셔츠 (면32수)',
    manufacturer: 'Printstar',
  },
  {
    id: 'ef7e70da-fb76-4938-bb85-cd10466c5379',
    title: '헤비웨이트 빅실루엣 티셔츠 9.1oz',
    manufacturer: 'United Athletes',
  },
];

export default function LayersPrintLabPage() {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
          modoo LAB · Phase 2.1
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Layers × PrintMethod 통합 패널</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          v2 EditorLayers + PrintMethod 두 디자인을 한 패널에 인라인 expand 패턴으로 통합한
          시안입니다. prod 영향 0(별도 라우트, 가격 흐름 비건드림).
        </p>
      </header>

      {/* Section 1: Mock 디자인 검토 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">1. Mock 디자인 검토</h2>
        <p className="text-sm text-gray-600 mb-4">
          패널이 어떻게 보일지 mock 4개 레이어로 즉시 확인. fabric canvas 없이도 시각·인터랙션
          확인 가능.
        </p>
        <button
          onClick={() => setPanelOpen(true)}
          className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition"
        >
          Mock 패널 열기
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-gray-700 mb-1">레이어 카드</div>
            <div className="text-gray-500">
              아이콘 · 이름 · 부제(사이즈/폰트) · 면(앞/뒤) · 인쇄방식 chip
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-gray-700 mb-1">인라인 expand</div>
            <div className="text-gray-500">
              chip 클릭 → 그 레이어만 5종 카드 펼침 (모달 아님)
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-gray-700 mb-1">DTF만 active</div>
            <div className="text-gray-500">
              나머지 4종은 회색 + 잠금 배지. 클릭 시 toast 안내.
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-semibold text-gray-700 mb-1">Mock 상태 보존</div>
            <div className="text-gray-500">
              DTF로의 변경은 in-memory만 (실 데이터 X)
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 실 인터랙션 안내 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">2. 실 fabric canvas 인터랙션</h2>
        <p className="text-sm text-gray-600 mb-4">
          메인 에디터에 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">?layers-lab=1</code>{' '}
          쿼리 붙여 진입하면 실 fabric 객체 + DB 단가표 룩업과 연결된 패널이 우측 하단에 떠 있습니다.
          이미지·텍스트 추가 후 패널 열어보세요.
        </p>
        <div className="space-y-2">
          {SAMPLE_PRODUCTS.map((p) => (
            <Link
              key={p.id}
              href={`/editor/${p.id}?layers-lab=1`}
              className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition rounded-lg p-3 border border-gray-200"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{p.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.manufacturer}</div>
              </div>
              <div className="text-xs font-mono text-blue-600">에디터 열기 →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Section 3: 회귀 검증 안내 */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">3. 회귀 검증</h2>
        <p className="text-sm text-gray-600 mb-3">
          이 브랜치는 prod 흐름을 건드리지 않습니다. 검증 포인트:
        </p>
        <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
          <li>
            쿼리 <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">?layers-lab=1</code>{' '}
            없이 메인 에디터 진입 → 기존 흐름과 동일 (패널 미마운트)
          </li>
          <li>
            가격 산정 흐름 변경 0 — 모든 객체 DTF로 책정 유지
          </li>
          <li>
            기존 ObjectPreviewPanel · PricingInfo · QuantitySelectorModal 모두 그대로
          </li>
          <li>
            사용자가 mock으로 다른 방식 클릭해도 가격 변동 0 (UI 시연만)
          </li>
        </ul>
      </section>

      {/* Mock panel */}
      <LayersPrintPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        sides={MOCK_SIDES}
        mockLayers={MOCK_LAYERS}
      />
    </div>
  );
}
