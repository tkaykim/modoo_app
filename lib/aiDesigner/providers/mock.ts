/**
 * 모의(mock) 제공자 — API 키 없이 개발·테스트 환경에서 전체 파이프라인을 돌리기 위한 결정적 엠블럼 생성기.
 *
 * - 프롬프트+인덱스 해시로 시드 → 같은 입력이면 같은 그림(테스트 재현성).
 * - 실제 모델처럼 "흰 배경 PNG"를 내놓는다(투명 없음) → 배경 제거·벡터화·검사 단계가 그대로 실행된다.
 * - 결함 주입 키워드(프롬프트에 포함 시): gradient/그라데이션 → 그라데이션, thin/얇은 → 가는 선,
 *   rainbow/무지개 → 12색, transparent → 투명 배경. 품질 검사 규칙을 눈으로 확인할 때 쓴다.
 * - vectorize: 같은 프로세스에서 만든 PNG면 원본 SVG를 돌려준다(진짜 벡터화 흉내), 아니면 PNG를 감싼 SVG.
 * 운영(NODE_ENV=production)에서는 AI_DESIGNER_ALLOW_MOCK=1 일 때만 활성.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { GenerateArgs, GeneratedImage, ImageProvider, VectorizeResult } from './types.ts';

const PALETTES: string[][] = [
  ['#1b2a4a', '#ffffff', '#f2b632', '#c0392b'],
  ['#111111', '#d7263d', '#ffffff', '#f4d35e'],
  ['#1e5631', '#f5f0e1', '#c9a227', '#2c2c2c'],
  ['#6d1a2a', '#ffffff', '#b8b8b8', '#1f1f1f'],
  ['#0052cc', '#ffffff', '#ffd23f', '#0b1f3a'],
  ['#0f766e', '#ffffff', '#f97316', '#134e4a'],
];

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svgCache = new Map<string, string>();
function remember(png: Buffer, svg: string) {
  const key = createHash('sha1').update(png).digest('hex');
  if (svgCache.size > 60) {
    const first = svgCache.keys().next().value;
    if (first) svgCache.delete(first);
  }
  svgCache.set(key, svg);
}

function shapePath(kind: number, cx: number, cy: number, r: number): string {
  switch (kind % 5) {
    case 0: // 방패
      return `M ${cx - r} ${cy - r * 0.8} L ${cx + r} ${cy - r * 0.8} L ${cx + r} ${cy + r * 0.1} Q ${cx + r} ${cy + r * 0.9} ${cx} ${cy + r * 1.05} Q ${cx - r} ${cy + r * 0.9} ${cx - r} ${cy + r * 0.1} Z`;
    case 1: // 원
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    case 2: { // 육각형
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(`${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`);
      }
      return `M ${pts.join(' L ')} Z`;
    }
    case 3: // 둥근 배지
      return `M ${cx - r} ${cy - r * 0.7} Q ${cx - r} ${cy - r} ${cx - r * 0.7} ${cy - r} L ${cx + r * 0.7} ${cy - r} Q ${cx + r} ${cy - r} ${cx + r} ${cy - r * 0.7} L ${cx + r} ${cy + r * 0.7} Q ${cx + r} ${cy + r} ${cx + r * 0.7} ${cy + r} L ${cx - r * 0.7} ${cy + r} Q ${cx - r} ${cy + r} ${cx - r} ${cy + r * 0.7} Z`;
    default: // 다이아몬드
      return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
  }
}

function iconMarkup(kind: number, cx: number, cy: number, r: number, fill: string): string {
  switch (kind % 4) {
    case 0: { // 별
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
    }
    case 1: // 번개
      return `<polygon points="${cx - r * 0.2},${cy - r} ${cx + r * 0.35},${cy - r} ${cx + r * 0.05},${cy - r * 0.15} ${cx + r * 0.4},${cy - r * 0.15} ${cx - r * 0.3},${cy + r} ${cx - r * 0.05},${cy + r * 0.15} ${cx - r * 0.45},${cy + r * 0.15}" fill="${fill}"/>`;
    case 2: // 산
      return `<polygon points="${cx - r},${cy + r * 0.7} ${cx - r * 0.35},${cy - r * 0.6} ${cx},${cy + r * 0.1} ${cx + r * 0.3},${cy - r * 0.9} ${cx + r},${cy + r * 0.7}" fill="${fill}"/>`;
    default: // 발바닥
      return [
        `<circle cx="${cx}" cy="${cy + r * 0.35}" r="${r * 0.45}" fill="${fill}"/>`,
        `<circle cx="${cx - r * 0.55}" cy="${cy - r * 0.2}" r="${r * 0.2}" fill="${fill}"/>`,
        `<circle cx="${cx - r * 0.2}" cy="${cy - r * 0.55}" r="${r * 0.2}" fill="${fill}"/>`,
        `<circle cx="${cx + r * 0.2}" cy="${cy - r * 0.55}" r="${r * 0.2}" fill="${fill}"/>`,
        `<circle cx="${cx + r * 0.55}" cy="${cy - r * 0.2}" r="${r * 0.2}" fill="${fill}"/>`,
      ].join('');
  }
}

export function buildMockSvg(args: GenerateArgs, index: number): string {
  const lower = args.prompt.toLowerCase();
  // 결함 키워드는 고객 요청(Subject 줄)에서만 찾는다 — 템플릿의 금지 문구("Do not use gradients… thin hairlines")에 반응하면 안 된다.
  const subjectMatch = /subject: (.*?)\.(\n|$)/.exec(lower);
  const subject = subjectMatch ? subjectMatch[1] : lower;
  const rng = mulberry32(fnv1a(`${args.prompt}|${index}|${args.seed ?? 0}`));
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const wantGradient = /gradient|그라데이션/.test(subject);
  const wantThin = /\bthin\b|얇은|hairline/.test(subject);
  const wantRainbow = /rainbow|무지개/.test(subject);
  // 기본 템플릿은 항상 "white background"를 요구한다 — 파일럿 커스텀 프롬프트로 transparent만 요구할 때 투명 출력
  const transparent = /transparent/.test(lower) && !/white background/.test(lower);
  const colorMatch = /exactly (\d) colors/.exec(lower);
  const colorCount = Math.max(2, Math.min(4, colorMatch ? Number(colorMatch[1]) : 3));

  const base = args.paletteHex && args.paletteHex.length >= 2 ? args.paletteHex : pick(PALETTES);
  const palette = base.slice(0, colorCount);
  while (palette.length < 4) palette.push(palette[palette.length % Math.max(1, palette.length)] ?? '#333333');
  const [c1, c2, c3, c4] = palette;

  const W = 1024;
  const cx = 512;
  const cy = 512;
  const r = 380;
  const outerKind = Math.floor(rng() * 5) + index;
  const iconKind = Math.floor(rng() * 4) + index;

  const defs: string[] = [];
  let outerFill = c1;
  if (wantGradient) {
    defs.push(`<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c3}"/></linearGradient>`);
    outerFill = 'url(#g)';
  }

  const parts: string[] = [];
  if (!transparent) parts.push(`<rect width="${W}" height="${W}" fill="#ffffff"/>`);
  parts.push(`<path d="${shapePath(outerKind, cx, cy, r)}" fill="${outerFill}" stroke="${c2}" stroke-width="26"/>`);
  parts.push(`<path d="${shapePath(outerKind, cx, cy, r * 0.78)}" fill="none" stroke="${c2}" stroke-width="14"/>`);
  if (wantRainbow) {
    const cols = ['#e6194b', '#f58231', '#ffe119', '#bfef45', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6', '#a9a9a9', '#800000', '#000075'];
    cols.forEach((c, i) => {
      parts.push(`<rect x="${cx - r * 0.6 + (i * r * 1.2) / cols.length}" y="${cy - r * 0.35}" width="${(r * 1.2) / cols.length + 1}" height="${r * 0.7}" fill="${c}"/>`);
    });
  } else {
    const iconColor = colorCount >= 3 ? c3 : c2;
    parts.push(iconMarkup(iconKind, cx, cy - (args.purpose === 'wordmark' ? r * 0.25 : 0), r * (args.purpose === 'wordmark' ? 0.32 : 0.5), iconColor));
    if (colorCount >= 4) {
      parts.push(`<rect x="${cx - r * 0.55}" y="${cy + r * 0.55}" width="${r * 1.1}" height="${r * 0.12}" fill="${c4}"/>`);
    }
  }
  if (wantThin) {
    for (let i = 0; i < 6; i++) {
      const y = cy - r * 0.5 + i * r * 0.2;
      parts.push(`<line x1="${cx - r * 0.7}" y1="${y}" x2="${cx + r * 0.7}" y2="${y + 12}" stroke="${c2}" stroke-width="1.5"/>`);
    }
  }
  if (args.purpose === 'wordmark') {
    const m = /the only text is "([^"]+)"/i.exec(args.prompt);
    const text = (m ? m[1] : 'TEAM').toUpperCase().slice(0, 14);
    const fontSize = Math.min(150, Math.floor(700 / Math.max(3, text.length) * 1.6));
    parts.push(`<rect x="${cx - r * 0.85}" y="${cy + r * 0.05}" width="${r * 1.7}" height="${fontSize * 1.25}" rx="18" fill="${c2}"/>`);
    parts.push(`<text x="${cx}" y="${cy + r * 0.05 + fontSize * 0.98}" text-anchor="middle" font-family="Impact, 'Arial Black', Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="${c1}">${text.replace(/[<>&]/g, '')}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`;
}

export function mockAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.AI_DESIGNER_ALLOW_MOCK === '1';
}

export function createMockProvider(): ImageProvider {
  return {
    id: 'mock',
    model: 'mock',
    async generate(args: GenerateArgs): Promise<GeneratedImage[]> {
      const n = Math.max(1, Math.min(6, args.n));
      const out: GeneratedImage[] = [];
      for (let i = 0; i < n; i++) {
        const svg = buildMockSvg(args, i + (args.reference ? 10 : 0));
        try {
          const png = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
          remember(png, svg);
          out.push({ buffer: png, mime: 'image/png', model: 'mock', costUsd: 0 });
        } catch (e) {
          console.warn('[aiDesigner/providers/mock] rasterize failed', e instanceof Error ? e.message : e);
        }
      }
      return out;
    },
    async vectorize(png: Buffer): Promise<VectorizeResult | null> {
      const key = createHash('sha1').update(png).digest('hex');
      const hit = svgCache.get(key);
      if (hit) return { svg: hit, costUsd: 0 };
      // 원본을 모르면 PNG를 감싼 SVG(실제 벡터 아님 — mock 표시)
      const meta = await sharp(png).metadata().catch(() => null);
      const w = meta?.width ?? 1024;
      const h = meta?.height ?? 1024;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><!-- mock vectorize: embedded raster --><image width="${w}" height="${h}" xlink:href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
      return { svg, costUsd: 0 };
    },
  };
}
