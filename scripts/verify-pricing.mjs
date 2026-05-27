/**
 * 가격 매칭 로직 단독 검증 스크립트.
 *
 * customerPricingMatcher.ts의 핵심 함수를 inline으로 재구현해서
 * 김미정님 실제 케이스 + 추가 시나리오 8종이 기대값과 일치하는지 확인한다.
 *
 * 이 스크립트의 의도는 "코드 배포 전 회귀 0건 확신"이지, 운영 대체 아님.
 * 실제 운영 코드는 lib/customerPricingMatcher.ts 와 동일한 로직이어야 한다.
 *
 * 실행: node scripts/verify-pricing.mjs
 */

// ===== Inline 매칭 함수 (lib/customerPricingMatcher.ts와 동일 로직) =====

function matchRotationAware(rows, widthCm, heightCm) {
  if (!Number.isFinite(widthCm) || widthCm <= 0) return null;
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  const artShort = Math.min(widthCm, heightCm);
  const artLong = Math.max(widthCm, heightCm);
  const candidates = rows
    .filter((r) => r.is_active !== false)
    .filter((r) => r.max_width_cm !== null && r.max_height_cm !== null)
    .filter((r) => {
      const rowShort = Math.min(r.max_width_cm, r.max_height_cm);
      const rowLong = Math.max(r.max_width_cm, r.max_height_cm);
      return artShort <= rowShort && artLong <= rowLong;
    });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const areaA = a.max_width_cm * a.max_height_cm;
    const areaB = b.max_width_cm * b.max_height_cm;
    if (areaA !== areaB) return areaA - areaB;
    return Math.max(a.max_width_cm, a.max_height_cm) - Math.max(b.max_width_cm, b.max_height_cm);
  });
  return candidates[0];
}

function pickUnitPriceForArtwork(rows, widthCm, heightCm) {
  const matched = matchRotationAware(rows, widthCm, heightCm);
  if (matched && matched.pricing_model === 'flat' && matched.unit_price !== null) {
    return { unitPrice: Math.round(matched.unit_price), size: matched.size, matchType: 'exact' };
  }
  const a3 = rows.find(r => r.is_active !== false && r.size === 'A3' && r.pricing_model === 'flat' && r.unit_price !== null);
  if (a3) {
    return { unitPrice: Math.round(a3.unit_price), size: a3.size, matchType: 'a3_fallback' };
  }
  return null;
}

// ===== DTF 단가표 (DB 실사 결과 — 2026-05-26 기준) =====
const DTF_ROWS = [
  { id: 'r10', size: '10x10', max_width_cm: 10, max_height_cm: 10, pricing_model: 'flat', unit_price: 4000, is_active: true },
  { id: 'rA4', size: 'A4', max_width_cm: 21, max_height_cm: 29.7, pricing_model: 'flat', unit_price: 5000, is_active: true },
  { id: 'rA3', size: 'A3', max_width_cm: 29.7, max_height_cm: 42, pricing_model: 'flat', unit_price: 7000, is_active: true },
];

// ===== 시나리오 =====
const BASE_TSHIRT = 7500;

const scenarios = [
  // 김미정님 실제 케이스 — 회귀 0건 보장 핵심
  {
    name: '김미정 5-19 front (204.7×102.7mm)',
    sides: [{ wMm: 204.7, hMm: 102.7 }],
    expected_per_side: [5000],
    note: '20.47×10.27cm. A4(21×29.7)에 회전 매칭 → A4 5000원',
  },
  {
    name: '김미정 5-19 back (218.6×230.4mm)',
    sides: [{ wMm: 218.6, hMm: 230.4 }],
    expected_per_side: [7000],
    note: '21.86×23.04cm. A4 short(21cm) 초과 → A3 7000원',
  },
  {
    name: '김미정 5-19 전체 — 19,500원 회귀',
    sides: [{ wMm: 204.7, hMm: 102.7 }, { wMm: 218.6, hMm: 230.4 }],
    expected_total: 7500 + 5000 + 7000,
    expected_value: 19500,
  },
  {
    name: '김미정 5-26 전체 — 21,500원 회귀',
    sides: [{ wMm: 360.2, hMm: 157.1 }, { wMm: 329.3, hMm: 324.6 }],
    expected_total: 7500 + 7000 + 7000,
    expected_value: 21500,
    note: '둘 다 A3 초과 → A3 fallback 7000원씩',
  },
  // 추가 회귀
  {
    name: '아주 작은 도안 (5×5cm)',
    sides: [{ wMm: 50, hMm: 50 }],
    expected_per_side: [4000],
  },
  {
    name: '정확히 10×10cm 경계',
    sides: [{ wMm: 100, hMm: 100 }],
    expected_per_side: [4000],
    note: '경계 포함 → 10x10 매칭',
  },
  {
    name: 'A4 경계 (21×29.7cm)',
    sides: [{ wMm: 210, hMm: 297 }],
    expected_per_side: [5000],
  },
  // 회전 매칭 이점 — 가로형 띠
  {
    name: '가로 25×세로 5cm 띠 (개선 기대)',
    sides: [{ wMm: 250, hMm: 50 }],
    expected_per_side: [5000],
    note: '회전 매칭으로 A4 매칭 성공. 기존 로직은 A3였음.',
  },
  // A3 초과 절대 차단 X
  {
    name: '100×100cm 거대 도안 — 차단 안 됨 확인',
    sides: [{ wMm: 1000, hMm: 1000 }],
    expected_per_side: [7000],
    note: 'A3 fallback 7000원. 절대 0이나 null 반환 금지.',
  },
  // 비대칭 거대
  {
    name: '50×5cm 비대칭 — A3 fallback',
    sides: [{ wMm: 500, hMm: 50 }],
    expected_per_side: [7000],
    note: '50cm 긴변이 A3 long(42cm) 초과 → fallback',
  },
];

// ===== 검증 실행 =====
let passCount = 0;
let failCount = 0;

console.log('\n=== modoo_app 가격 매칭 회귀 검증 ===\n');

for (const sc of scenarios) {
  const perSide = sc.sides.map(s => {
    const r = pickUnitPriceForArtwork(DTF_ROWS, s.wMm / 10, s.hMm / 10);
    return r ? r.unitPrice : 0;
  });
  const totalAdd = perSide.reduce((a, b) => a + b, 0);
  const totalValue = BASE_TSHIRT + totalAdd;

  let pass = true;
  if (sc.expected_per_side) {
    pass = JSON.stringify(perSide) === JSON.stringify(sc.expected_per_side);
  }
  if (sc.expected_value !== undefined) {
    pass = pass && totalValue === sc.expected_value;
  }

  const sideDesc = sc.sides.map(s => `${s.wMm}×${s.hMm}mm`).join(', ');
  const result = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${result}  ${sc.name}`);
  console.log(`         도안: ${sideDesc}`);
  console.log(`         계산: 면별 [${perSide.join(', ')}] → 부가 ${totalAdd}, 단가 ${totalValue}`);
  if (sc.expected_per_side) console.log(`         기대 면별: [${sc.expected_per_side.join(', ')}]`);
  if (sc.expected_value !== undefined) console.log(`         기대 단가: ${sc.expected_value}`);
  if (sc.note) console.log(`         메모: ${sc.note}`);
  console.log('');

  if (pass) passCount++; else failCount++;
}

console.log(`\n결과: ${passCount}/${scenarios.length} 통과, ${failCount} 실패\n`);
process.exit(failCount === 0 ? 0 : 1);
