/**
 * 방식+수량 가격 로직 검증 (Phase 2 lab).
 *
 * lib/printMethodPricing.ts 의 핵심 공식을 inline으로 재현해 기대값과 대조한다.
 * DB 실사값(2026-05-29 기준): DTF flat 4000/5000/7000,
 * 나염=자수=아플리케 bulk base 60000/80000/100000 (base_qty 100, 추가 600/800/1000).
 *
 * 실행: node scripts/verify-method-pricing.mjs
 */

const SIZES = {
  '10x10': { w: 10, h: 10 },
  A4: { w: 21, h: 29.7 },
  A3: { w: 29.7, h: 42 },
};

const DTF = {
  '10x10': { model: 'flat', unit: 4000 },
  A4: { model: 'flat', unit: 5000 },
  A3: { model: 'flat', unit: 7000 },
};

// 나염/자수/아플리케 동일
const BULK = {
  '10x10': { model: 'bulk', base: 60000, baseQty: 100, add: 600 },
  A4: { model: 'bulk', base: 80000, baseQty: 100, add: 800 },
  A3: { model: 'bulk', base: 100000, baseQty: 100, add: 1000 },
};

function amount(row, qty) {
  if (row.model === 'flat') return Math.round(row.unit * qty);
  const extra = Math.max(0, qty - row.baseQty);
  return Math.round(row.base + extra * row.add);
}

function crossover(bulkRow, dtfRow, maxQ = 1000) {
  for (let q = 1; q <= maxQ; q += 1) {
    if (amount(bulkRow, q) <= amount(dtfRow, q)) return q;
  }
  return null;
}

const cases = [
  // [라벨, row, qty, 기대 총액]
  ['DTF A4 ×1', DTF.A4, 1, 5000],
  ['DTF A4 ×30', DTF.A4, 30, 150000],
  ['DTF A4 ×100', DTF.A4, 100, 500000],
  ['나염 A4 ×10 (100벌 미만=base)', BULK.A4, 10, 80000],
  ['나염 A4 ×100', BULK.A4, 100, 80000],
  ['나염 A4 ×200', BULK.A4, 200, 160000],
  ['나염 10x10 ×50', BULK['10x10'], 50, 60000],
  ['나염 A3 ×150', BULK.A3, 150, 150000],
];

let pass = 0;
let fail = 0;
console.log('\n=== 방식+수량 가격 검증 ===\n');
for (const [label, row, qty, expected] of cases) {
  const got = amount(row, qty);
  const ok = got === expected;
  console.log(`${ok ? '✅' : '❌'} ${label} → ${got.toLocaleString()}원 (기대 ${expected.toLocaleString()})`);
  ok ? pass++ : fail++;
}

console.log('\n--- 나염 vs DTF 분기점(이 수량부터 나염 ≤ DTF) ---');
const crossExpect = { '10x10': 15, A4: 16, A3: 15 };
for (const size of ['10x10', 'A4', 'A3']) {
  const q = crossover(BULK[size], DTF[size]);
  const ok = q === crossExpect[size];
  console.log(`${ok ? '✅' : '❌'} ${size}: ${q}벌 이상 유리 (기대 ${crossExpect[size]})`);
  ok ? pass++ : fail++;
}

console.log(`\n결과: ${pass} 통과, ${fail} 실패\n`);
process.exit(fail === 0 ? 0 : 1);
