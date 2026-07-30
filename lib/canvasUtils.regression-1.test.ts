import assert from 'node:assert/strict';
import test from 'node:test';
import type * as fabric from 'fabric';

import { updateObjectDimensionsData } from './canvasUtils.ts';

test('save-time measurement replaces stale stored object dimensions', () => {
  const object = {
    data: {
      widthMm: 343.5,
      heightMm: 475.7,
      sizeBasis: 'alpha',
    },
    getBoundingRect: () => ({
      left: 0,
      top: 0,
      width: 292.1,
      height: 404.4,
    }),
  } as unknown as fabric.FabricObject & {
    data: Record<string, unknown>;
  };

  updateObjectDimensionsData(object, 1000, 500, 1);

  assert.deepEqual(object.data, {
    widthMm: 292.1,
    heightMm: 404.4,
    sizeBasis: 'alpha',
  });
});
