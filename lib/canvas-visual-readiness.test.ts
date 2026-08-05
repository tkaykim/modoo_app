import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countVisuallyReadyUserObjects,
  isCanvasObjectVisuallyReady,
  prepareViewerCanvasState,
} from './canvas-visual-readiness.ts';

test('rejects a Fabric image whose element has not decoded', () => {
  assert.equal(isCanvasObjectVisuallyReady({
    type: 'Image',
    width: 500,
    height: 500,
    getElement: () => ({ complete: true, naturalWidth: 0, naturalHeight: 0 }),
  }), false);
});

test('rejects a transparent placeholder-sized image response', () => {
  assert.equal(isCanvasObjectVisuallyReady({
    type: 'Image',
    width: 500,
    height: 500,
    getElement: () => ({ complete: true, naturalWidth: 1, naturalHeight: 1 }),
  }), false);
});

test('counts only decoded user artwork', () => {
  const canvas = {
    getObjects: () => [
      {
        type: 'Image',
        width: 400,
        height: 500,
        data: { id: 'background-product-image' },
        getElement: () => ({ complete: true, naturalWidth: 1200, naturalHeight: 1500 }),
      },
      {
        type: 'Image',
        width: 200,
        height: 100,
        getElement: () => ({ complete: true, naturalWidth: 2000, naturalHeight: 1000 }),
      },
      {
        type: 'Image',
        width: 200,
        height: 100,
        getElement: () => ({ complete: true, naturalWidth: 0, naturalHeight: 0 }),
      },
    ],
  };

  assert.equal(countVisuallyReadyUserObjects(canvas), 1);
});

test('prefetches the current saved image source before legacy metadata URLs', async () => {
  const requested: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalFileReader = globalThis.FileReader;

  class TestFileReader {
    result: string | null = null;
    error: Error | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsDataURL() {
      this.result = 'data:image/png;base64,dGVzdA==';
      this.onload?.();
    }
  }

  globalThis.fetch = (async (url: string | URL | Request) => {
    requested.push(String(url));
    return new Response(new Blob([new Uint8Array(64)], { type: 'image/png' }), { status: 200 });
  }) as typeof fetch;
  globalThis.FileReader = TestFileReader as unknown as typeof FileReader;

  try {
    const prepared = JSON.parse(await prepareViewerCanvasState({
      objects: [{
        type: 'Image',
        src: 'https://cdn.example/current.png',
        data: { supabaseUrl: 'https://cdn.example/legacy.png' },
      }],
    }));

    assert.deepEqual(requested, ['https://cdn.example/current.png']);
    assert.equal(prepared.objects[0].src, 'data:image/png;base64,dGVzdA==');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalFileReader;
  }
});
