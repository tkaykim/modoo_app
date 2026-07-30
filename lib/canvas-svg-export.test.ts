import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTextSvgStorageMode,
  isPathOnlyTextSvg,
  styledPathMarkup,
} from './text-vector-style.ts';

test('bakes bold, italic, and the customer stroke into vector paths', () => {
  const svg = styledPathMarkup({
    pathData: 'M 0 0 L 10 0 L 10 10 Z',
    fill: '#000000',
    stroke: '#fffcd6',
    strokeWidth: 1,
    fontSize: 40,
    fontWeight: 'bold',
    fontStyle: 'italic',
    opacity: 1,
  });

  assert.doesNotMatch(svg, /<text\b/i);
  assert.match(svg, /<path\b/);
  assert.match(svg, /skewX\(-12\)/);
  assert.match(svg, /stroke="#fffcd6" stroke-width="2\.4"/);
  assert.match(svg, /stroke="#000000" stroke-width="1\.4"/);
  assert.equal(isPathOnlyTextSvg(svg), true);
});

test('accepts numeric bold weights and can suppress a second italic transform', () => {
  const svg = styledPathMarkup({
    pathData: 'M 0 0 L 5 5 Z',
    fill: '#112233',
    stroke: '',
    strokeWidth: 0,
    fontSize: 20,
    fontWeight: 700,
    fontStyle: 'italic',
    opacity: 0.75,
    applyItalicTransform: false,
  });

  assert.doesNotMatch(svg, /skewX/);
  assert.match(svg, /stroke="#112233" stroke-width="0\.7"/);
  assert.match(svg, /opacity="0\.75"/);
});

test('rejects any SVG that still depends on a font text element', () => {
  assert.equal(isPathOnlyTextSvg('<svg><text>ASL</text></svg>'), false);
  assert.equal(isPathOnlyTextSvg('<svg><path d="M0 0Z"/></svg>'), true);
});

test('stores font text SVG as a safe fallback instead of blocking customer saves', () => {
  const fallbackSvg =
    '<svg><text font-family="Pretendard" font-weight="bold" font-style="italic" ' +
    'stroke="#fffcd6" stroke-width="2" paint-order="stroke fill">모두</text></svg>';

  assert.equal(getTextSvgStorageMode(fallbackSvg), 'font');
  assert.equal(getTextSvgStorageMode('<svg><path d="M0 0Z"/></svg>'), 'path');
  assert.equal(getTextSvgStorageMode('<div>not svg</div>'), 'invalid');
  assert.match(fallbackSvg, /stroke="#fffcd6"/);
  assert.match(fallbackSvg, /stroke-width="2"/);
});
