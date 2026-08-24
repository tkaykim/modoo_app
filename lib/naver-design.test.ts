import assert from 'node:assert/strict';
import test from 'node:test';
import { hashNaverDesignToken, hydrateNaverDesignCanvasState, isUuid, resolveNaverDesignSaveState, safeFileExtension, sanitizeNaverDesignCanvasState } from './naver-design-token.ts';

test('hashes bearer tokens deterministically without retaining the token', () => {
  assert.equal(hashNaverDesignToken('a'.repeat(43)), hashNaverDesignToken('a'.repeat(43)));
  assert.notEqual(hashNaverDesignToken('a'.repeat(43)), 'a'.repeat(43));
});

test('keeps only safe file extensions', () => {
  assert.equal(safeFileExtension('logo.final.PNG', 'image/png'), 'png');
  assert.equal(safeFileExtension('no-extension', 'image/jpeg'), 'jpg');
});

test('saving an already submitted design does not reopen it', () => {
  const submittedAt = '2026-08-25T01:00:00.000Z';
  assert.deepEqual(
    resolveNaverDesignSaveState('submitted', submittedAt, false, '2026-08-25T02:00:00.000Z'),
    { status: 'submitted', submittedAt },
  );
  assert.deepEqual(
    resolveNaverDesignSaveState('reviewed', submittedAt, false, '2026-08-25T02:00:00.000Z'),
    { status: 'reviewed', submittedAt },
  );
});

test('revision saves reopen while an explicit submit stamps a new time', () => {
  const now = '2026-08-25T02:00:00.000Z';
  assert.deepEqual(resolveNaverDesignSaveState('revision_requested', 'old', false, now), { status: 'in_progress', submittedAt: null });
  assert.deepEqual(resolveNaverDesignSaveState('in_progress', null, true, now), { status: 'submitted', submittedAt: now });
});

test('persists token-free asset references and hydrates them for the active link', () => {
  const assetId = '9d870a55-f3c0-49a7-9161-f19b7068b2cb';
  const token = 'a'.repeat(43);
  const raw = { front: JSON.stringify({ src: `/api/naver-design/${token}/assets/${assetId}`, data: { originalFileUrl: `/api/naver-design/${token}/assets/${assetId}` } }) };
  const sanitized = sanitizeNaverDesignCanvasState(raw);
  assert.equal(sanitized.front.includes(token), false);
  assert.equal(sanitized.front.includes(`naver-asset:${assetId}`), true);
  const hydrated = hydrateNaverDesignCanvasState(sanitized, token);
  assert.equal(hydrated.front.includes(`/api/naver-design/${token}/assets/${assetId}`), true);
});

test('validates asset ids before querying Postgres uuid columns', () => {
  assert.equal(isUuid('9d870a55-f3c0-49a7-9161-f19b7068b2cb'), true);
  assert.equal(isUuid('not-a-uuid'), false);
});
