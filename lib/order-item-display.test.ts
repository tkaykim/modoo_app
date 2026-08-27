import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatOrderColor,
  formatOrderVariantQuantity,
  getOrderItemColorLabel,
  getOrderItemVariants,
} from './order-item-display.ts';

test('사이즈별 수량이 1개여도 사이즈 코드와 수량을 함께 표시한다', () => {
  const item = {
    quantity: 1,
    item_options: {
      variants: [{ size_id: '100', size_name: 'L', quantity: 1 }],
    },
  };

  assert.equal(formatOrderVariantQuantity(getOrderItemVariants(item)[0]), 'L (100) × 1');
});

test('사이즈명이 제조사 코드를 이미 포함하면 코드를 반복하지 않는다', () => {
  assert.equal(
    formatOrderVariantQuantity({ size_name: '110 (아동용) 품절', size_id: '110', quantity: 1 }),
    '110 (아동용) 품절 × 1',
  );
});

test('색상명과 제조사 색상 코드를 붙여 표시한다', () => {
  const item = {
    quantity: 1,
    item_options: {
      variants: [{ color_name: '화이트', color_code: '001', quantity: 1 }],
    },
  };

  assert.equal(getOrderItemColorLabel(item), '화이트(001)');
  assert.equal(formatOrderColor('블랙', null), '블랙');
});

test('구형 단일 옵션 주문도 사이즈와 색상을 복원한다', () => {
  const item = {
    quantity: 2,
    item_options: {
      size_id: '95',
      size_name: 'M',
      color_name: '네이비',
      color_code: '003',
    },
  };

  assert.equal(formatOrderVariantQuantity(getOrderItemVariants(item)[0]), 'M (95) × 2');
  assert.equal(getOrderItemColorLabel(item), '네이비(003)');
});
