import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindCustomFontsToCanvasState,
  extractCustomFontsFromCanvasState,
} from './font-contract.ts';

const uploadedFont = {
  fontFamily: 'Modoo Custom Customer Font abc12345',
  displayName: 'Customer Font',
  fileName: 'customer-font.otf',
  url: 'https://example.supabase.co/storage/v1/object/public/user-fonts/fonts/customer-font.otf',
  path: 'fonts/customer-font.otf',
  uploadedAt: '2026-07-30T00:00:00.000Z',
  format: 'otf' as const,
};

test('binds the immutable font file metadata into every matching text object', () => {
  const state = {
    front: JSON.stringify({
      objects: [{
        type: 'CurvedText',
        text: 'ASL',
        fontFamily: uploadedFont.fontFamily,
        fontWeight: 'bold',
        fontStyle: 'italic',
        stroke: '#000000',
        strokeWidth: 3,
        data: { objectId: 'front-text-1' },
      }],
    }),
  };

  const result = bindCustomFontsToCanvasState(state, [uploadedFont]);
  const front = JSON.parse(result.canvasState.front);
  assert.deepEqual(front.objects[0].data.fontMetadata, uploadedFont);
  assert.equal(front.objects[0].data.fontUrl, uploadedFont.url);
  assert.equal(front.objects[0].fontWeight, 'bold');
  assert.equal(front.objects[0].fontStyle, 'italic');
  assert.equal(front.objects[0].strokeWidth, 3);
  assert.deepEqual(result.customFonts, [uploadedFont]);
});

test('recovers custom_fonts solely from object-level metadata', () => {
  const state = {
    front: JSON.stringify({
      objects: [{
        type: 'i-text',
        fontFamily: uploadedFont.fontFamily,
        data: {
          fontUrl: uploadedFont.url,
          fontMetadata: uploadedFont,
        },
      }],
    }),
  };

  assert.deepEqual(extractCustomFontsFromCanvasState(state), [uploadedFont]);
});

test('keeps two binaries with the same display family distinct', () => {
  const other = {
    ...uploadedFont,
    url: uploadedFont.url.replace('.otf', '-v2.otf'),
    path: uploadedFont.path.replace('.otf', '-v2.otf'),
  };
  const state = {
    front: JSON.stringify({
      objects: [
        { type: 'i-text', fontFamily: uploadedFont.fontFamily, data: { fontMetadata: uploadedFont } },
        { type: 'i-text', fontFamily: other.fontFamily, data: { fontMetadata: other } },
      ],
    }),
  };

  assert.equal(extractCustomFontsFromCanvasState(state).length, 2);
});
