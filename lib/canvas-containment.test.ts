import assert from 'node:assert/strict';
import test from 'node:test';
import type * as fabric from 'fabric';

import {
  calculateContainmentDelta,
  intersectRectWithBounds,
  calculateTotalBoundingBoxMm,
} from './canvasUtils.ts';

// ── calculateContainmentDelta ────────────────────────────────────────
// 에디터 개체를 캔버스 [0,0,w,h] 밖으로 못 나가게 하는 보정치.

test('containment: 캔버스 안 개체는 보정 없음', () => {
  const delta = calculateContainmentDelta({ left: 100, top: 100, width: 50, height: 50 }, 500, 500);
  assert.deepEqual(delta, { dx: 0, dy: 0 });
});

test('containment: 오른쪽/아래로 벗어나면 안쪽으로 되민다', () => {
  const delta = calculateContainmentDelta({ left: 480, top: 490, width: 50, height: 40 }, 500, 500);
  assert.deepEqual(delta, { dx: -30, dy: -30 });
});

test('containment: 왼쪽/위로 벗어나면 안쪽으로 되민다', () => {
  const delta = calculateContainmentDelta({ left: -20, top: -5, width: 50, height: 40 }, 500, 500);
  assert.deepEqual(delta, { dx: 20, dy: 5 });
});

test('containment: 캔버스 완전 아래(H5MQ7P 사고 시나리오)도 안으로 되민다', () => {
  // 사고 주문의 front 텍스트: top 696, 높이 33.9 — 캔버스(500px) 완전 밖.
  const delta = calculateContainmentDelta({ left: 215.2, top: 696, width: 91.7, height: 33.9 }, 500, 500);
  assert.equal(delta.dx, 0);
  assert.equal(delta.dy, 500 - (696 + 33.9));
  // 보정 후 bbox 하단이 정확히 캔버스 하단에 닿는다.
  assert.equal(696 + delta.dy + 33.9, 500);
});

test('containment: 캔버스보다 큰 개체는 캔버스를 빈틈없이 덮도록 보정', () => {
  // 폭이 캔버스보다 크고 왼쪽으로 치우쳐 오른쪽에 틈이 생긴 경우
  const delta = calculateContainmentDelta({ left: -300, top: 50, width: 600, height: 100 }, 500, 500);
  assert.deepEqual(delta, { dx: 200, dy: 0 });
  // 시작점이 양수면 왼쪽 틈 제거
  const delta2 = calculateContainmentDelta({ left: 40, top: 0, width: 600, height: 500 }, 500, 500);
  assert.deepEqual(delta2, { dx: -40, dy: 0 });
});

test('containment: 경계 정보가 유효하지 않으면 보정하지 않는다', () => {
  const delta = calculateContainmentDelta({ left: 900, top: 900, width: 50, height: 50 }, 0, NaN);
  assert.deepEqual(delta, { dx: 0, dy: 0 });
});

// ── intersectRectWithBounds ──────────────────────────────────────────
// 단가·bbox 계산에서 캔버스 밖 부분을 제외하는 교차 영역.

test('intersect: 캔버스 안 개체는 원본 그대로', () => {
  const rect = { left: 100, top: 100, width: 50, height: 50 };
  assert.deepEqual(intersectRectWithBounds(rect, 500, 500), rect);
});

test('intersect: 걸친 개체는 캔버스 안쪽 부분만 남는다', () => {
  const clipped = intersectRectWithBounds({ left: 450, top: -20, width: 100, height: 60 }, 500, 500);
  assert.deepEqual(clipped, { left: 450, top: 0, width: 50, height: 40 });
});

test('intersect: 캔버스 완전 밖 개체는 null (인쇄 대상 아님)', () => {
  assert.equal(intersectRectWithBounds({ left: 215.2, top: 696, width: 91.7, height: 33.9 }, 500, 500), null);
  assert.equal(intersectRectWithBounds({ left: -100, top: 0, width: 50, height: 50 }, 500, 500), null);
});

test('intersect: 경계 정보가 유효하지 않으면 클립 없이 원본 반환 (fail-open)', () => {
  const rect = { left: 900, top: 900, width: 50, height: 50 };
  assert.deepEqual(intersectRectWithBounds(rect, 0, 500), rect);
});

// ── calculateTotalBoundingBoxMm (저장용 bbox의 캔버스 클립) ──────────

type FakeObject = {
  excludeFromExport?: boolean;
  data?: Record<string, unknown>;
  getBoundingRect: () => { left: number; top: number; width: number; height: number };
};

const makeCanvas = (objects: FakeObject[], width = 500, height = 500) =>
  ({
    getObjects: () => objects,
    getWidth: () => width,
    getHeight: () => height,
  } as unknown as fabric.Canvas);

test('totalBoundingBoxMm: 캔버스 밖으로 나간 개체가 bbox를 부풀리지 않는다', () => {
  const inside: FakeObject = { getBoundingRect: () => ({ left: 100, top: 100, width: 100, height: 100 }) };
  const flungOut: FakeObject = { getBoundingRect: () => ({ left: 215.2, top: 696, width: 91.7, height: 33.9 }) };
  const bbox = calculateTotalBoundingBoxMm(makeCanvas([inside, flungOut]), 500, 500, 1);
  // 밖 개체 제외 → 안쪽 개체만: 100×100px × 1mm/px
  assert.deepEqual(bbox, { widthMm: 100, heightMm: 100 });
});

test('totalBoundingBoxMm: 모든 개체가 완전 밖이면 0×0 (개체는 있으나 인쇄면적 없음)', () => {
  const flungOut: FakeObject = { getBoundingRect: () => ({ left: 215.2, top: 696, width: 91.7, height: 33.9 }) };
  const bbox = calculateTotalBoundingBoxMm(makeCanvas([flungOut]), 500, 500, 1);
  assert.deepEqual(bbox, { widthMm: 0, heightMm: 0 });
});

test('totalBoundingBoxMm: 걸친 개체는 안쪽 부분만 집계', () => {
  const straddling: FakeObject = { getBoundingRect: () => ({ left: 450, top: 400, width: 100, height: 60 }) };
  const bbox = calculateTotalBoundingBoxMm(makeCanvas([straddling]), 500, 500, 1);
  assert.deepEqual(bbox, { widthMm: 50, heightMm: 60 });
});
