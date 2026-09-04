import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { analyzeArtwork, removeFlatBackground } from './quality.ts';
import { buildMockSvg, createMockProvider } from './providers/mock.ts';
import { buildArtworkPrompt } from './prompt.ts';

const W = 1024;
function svgDoc(inner: string, bg = '<rect width="1024" height="1024" fill="#ffffff"/>') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">${bg}${inner}</svg>`;
}
async function png(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

test('flat 3-color emblem passes embroidery profile', async () => {
  const buf = await png(svgDoc(
    '<circle cx="512" cy="512" r="380" fill="#1b2a4a" stroke="#f2b632" stroke-width="40"/>' +
    '<polygon points="512,260 640,700 380,420 644,420 384,700" fill="#ffffff"/>'
  ));
  const q = await analyzeArtwork(buf, { widthMm: 100 });
  assert.equal(q.metrics.transparent, false);
  assert.ok(q.metrics.colorCount >= 2 && q.metrics.colorCount <= 3, `colorCount=${q.metrics.colorCount}`);
  assert.ok(q.metrics.gradientScore < 0.15, `gradientScore=${q.metrics.gradientScore}`);
  assert.equal(q.embroidery.grade, 'ok', JSON.stringify(q.embroidery));
  assert.equal(q.dtf.grade, 'ok');
});

test('gradient fill is flagged for embroidery but allowed for dtf', async () => {
  const buf = await png(svgDoc(
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset="1" stop-color="#f2b632"/></linearGradient></defs>' +
    '<circle cx="512" cy="512" r="380" fill="url(#g)"/>'
  ));
  const q = await analyzeArtwork(buf, { widthMm: 100 });
  assert.ok(q.embroidery.flags.includes('gradient'), JSON.stringify(q.metrics));
  assert.ok(!q.dtf.flags.includes('gradient'));
});

test('hairlines are flagged at real print size', async () => {
  let lines = '';
  for (let i = 0; i < 12; i++) lines += `<line x1="120" y1="${200 + i * 55}" x2="900" y2="${210 + i * 55}" stroke="#111111" stroke-width="2"/>`;
  const buf = await png(svgDoc(`<rect x="100" y="150" width="820" height="60" fill="#111111"/>${lines}`));
  const q = await analyzeArtwork(buf, { widthMm: 100 });
  assert.ok(q.metrics.minStrokeMm !== null && q.metrics.minStrokeMm < 1, `minStrokeMm=${q.metrics.minStrokeMm}`);
  assert.ok(q.embroidery.flags.includes('thin_lines'), JSON.stringify(q.embroidery));
});

test('thin gaps inside a solid shape count as thin features', async () => {
  let gaps = '';
  for (let i = 0; i < 8; i++) gaps += `<line x1="200" y1="${300 + i * 60}" x2="820" y2="${306 + i * 60}" stroke="#ffffff" stroke-width="2"/>`;
  const buf = await png(svgDoc(`<rect x="150" y="200" width="720" height="620" fill="#0f766e"/>${gaps}`));
  const q = await analyzeArtwork(buf, { widthMm: 120 });
  assert.ok(q.dtf.flags.includes('thin_lines'), JSON.stringify({ dtf: q.dtf, stroke: q.metrics.strokePx }));
  assert.ok(q.embroidery.flags.includes('thin_lines'));
});

test('12 solid colors exceed embroidery limit but not dtf', async () => {
  const cols = ['#e6194b', '#f58231', '#ffe119', '#bfef45', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6', '#a9a9a9', '#800000', '#000075'];
  const rects = cols.map((c, i) => `<rect x="${60 + i * 75}" y="200" width="70" height="600" fill="${c}"/>`).join('');
  const q = await analyzeArtwork(await png(svgDoc(rects)), { widthMm: 100 });
  assert.ok(q.metrics.colorCount >= 10, `colorCount=${q.metrics.colorCount}`);
  assert.ok(q.embroidery.flags.includes('too_many_colors'));
  assert.ok(!q.dtf.flags.includes('too_many_colors'));
  assert.ok(!q.embroidery.flags.includes('gradient'), 'solid stripes must not read as gradient');
});

test('removeFlatBackground turns white background transparent, keeps inner white, trims margins', async () => {
  const buf = await png(svgDoc(
    '<circle cx="512" cy="512" r="300" fill="#1b2a4a"/><circle cx="512" cy="512" r="120" fill="#ffffff"/>'
  ));
  const r = await removeFlatBackground(buf);
  assert.equal(r.removed, true);
  assert.ok(r.width < 1024 && r.width > 560, `trimmed width=${r.width}`);
  const { data, info } = await sharp(r.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
  assert.equal(alphaAt(0, 0), 0, 'corner must be transparent');
  const cx = Math.floor(info.width / 2), cy = Math.floor(info.height / 2);
  assert.equal(alphaAt(cx, cy), 255, 'enclosed white center must stay opaque');
  const after = await analyzeArtwork(r.png, { widthMm: 100 });
  assert.equal(after.metrics.transparent, true);
});

test('mock provider is deterministic and honours defect keywords', async () => {
  const mock = createMockProvider();
  const base = { prompt: 'Design a bold emblem. Subject: 파란 방패 번개. exactly 3 colors. plain solid white background', n: 2, purpose: 'emblem' as const };
  const a = await mock.generate(base);
  const b = await mock.generate(base);
  assert.equal(a.length, 2);
  assert.ok(a[0].buffer.equals(b[0].buffer), 'same prompt → same PNG');
  assert.ok(!a[0].buffer.equals(a[1].buffer), 'candidates differ');
  const grad = buildMockSvg({ ...base, prompt: `${base.prompt} gradient` }, 0);
  assert.ok(grad.includes('linearGradient'));
  const q = await analyzeArtwork(await png(grad), { widthMm: 100 });
  assert.ok(q.embroidery.flags.includes('gradient'));
  const vec = await mock.vectorize!(a[0].buffer);
  assert.ok(vec && vec.svg.includes('<svg') && !vec.svg.includes('mock vectorize'), 'cached original svg is returned');
});

test('mock ignores the template negative phrases and produces a clean flat emblem from a built prompt', async () => {
  const built = buildArtworkPrompt({ request: '파란 방패 안에 번개, 축구팀 느낌', purpose: 'emblem', colorCount: 3 });
  const svg = buildMockSvg({ prompt: built.prompt, negativePrompt: built.negativePrompt, n: 1, purpose: 'emblem' }, 0);
  assert.ok(!svg.includes('linearGradient'), 'template "Do not use gradients" must not inject a gradient');
  assert.ok(!svg.includes('stroke-width="1.5"'), 'template "thin hairlines" must not inject hairlines');
  const q = await analyzeArtwork(await png(svg), { widthMm: 120 });
  assert.equal(q.embroidery.grade, 'ok', JSON.stringify({ emb: q.embroidery, m: { ...q.metrics, strokeSamplesPx: undefined } }));
});
