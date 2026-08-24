import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPartnerMallCapabilityToken,
  isPartnerMallPreviewRequest,
} from './partnerMallAccess.ts';

test('capability token은 32자리 hex와 UUID만 허용한다', () => {
  assert.equal(isPartnerMallCapabilityToken('4cc4aa7b7bb14b9ca2a1ab63afe21822'), true);
  assert.equal(isPartnerMallCapabilityToken('bd56f63f-8ea5-4c11-a518-1e8b984355b1'), true);
  assert.equal(isPartnerMallCapabilityToken('expo84-123'), false);
  assert.equal(isPartnerMallCapabilityToken('public-slug'), false);
});

test('비공개 시안은 preview=1에서만 활성화된다', () => {
  assert.equal(isPartnerMallPreviewRequest(new Request('https://modoo.test/mall/token?preview=1')), true);
  assert.equal(isPartnerMallPreviewRequest(new Request('https://modoo.test/mall/token')), false);
  assert.equal(isPartnerMallPreviewRequest(new Request('https://modoo.test/mall/token?preview=true')), false);
});
