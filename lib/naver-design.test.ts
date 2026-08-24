import assert from 'node:assert/strict';
import test from 'node:test';
import { hashNaverDesignToken, safeFileExtension } from './naver-design-token.ts';

test('hashes bearer tokens deterministically without retaining the token', () => {
  assert.equal(hashNaverDesignToken('a'.repeat(43)), hashNaverDesignToken('a'.repeat(43)));
  assert.notEqual(hashNaverDesignToken('a'.repeat(43)), 'a'.repeat(43));
});

test('keeps only safe file extensions', () => {
  assert.equal(safeFileExtension('logo.final.PNG', 'image/png'), 'png');
  assert.equal(safeFileExtension('no-extension', 'image/jpeg'), 'jpg');
});
