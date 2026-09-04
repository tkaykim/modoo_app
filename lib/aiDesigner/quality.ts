/**
 * AI 디자이너 — 도안 인쇄 적합성 검사 + 단색 배경 제거 (서버 전용, sharp 기반, 외부 API 없음).
 *
 * 검사 항목(자수·나염·DTF 제작 조건에서 가져옴):
 *  - 색 수: 전경 주요 색(≥1.5%) 개수. 자수 6색·나염 8색 권장.
 *  - 그라데이션: 인접 픽셀 간 완만한 색 변화 비율(gradientScore)과 미세 색 버킷 수.
 *  - 최소 선 굵기: 전경 마스크 거리변환(chamfer 3-4)의 능선 두께 10퍼센타일 → mm 환산(폭 mm를 알 때).
 *  - 도안 비율: 전경이 거의 없으면 low_coverage.
 * 검사는 주문을 막지 않는다 — 플래그를 붙여 디자이너 보정 대상으로 표시한다.
 */
import sharp from 'sharp';

export type QualityFlag = 'too_many_colors' | 'gradient' | 'thin_lines' | 'low_coverage';
export type PrintProfile = 'dtf' | 'screen' | 'embroidery';

export interface ProfileLimits {
  /** null = 제한 없음 */
  maxColors: number | null;
  allowGradient: boolean;
  minStrokeMm: number;
}

export const PROFILE_LIMITS: Record<PrintProfile, ProfileLimits> = {
  dtf: { maxColors: null, allowGradient: true, minStrokeMm: 0.5 },
  screen: { maxColors: 8, allowGradient: false, minStrokeMm: 0.8 },
  embroidery: { maxColors: 6, allowGradient: false, minStrokeMm: 1.0 },
};

export const PROFILE_LABELS: Record<PrintProfile, string> = { dtf: 'DTF 전사', screen: '나염', embroidery: '자수' };

/** 폭 mm를 모를 때 가정하는 인쇄 폭(위저드 기본 프리셋 12cm) */
export const ASSUMED_WIDTH_MM = 120;

export interface ArtworkMetrics {
  version: 1;
  width: number;
  height: number;
  transparent: boolean;
  coverage: number;
  colorCount: number;
  palette: Array<{ hex: string; share: number }>;
  distinctBuckets: number;
  gradientScore: number;
  /** 주요 색과 24 이상 떨어진 내부 픽셀 비율(완만한 그라데이션·사진 감지) */
  paletteResidual: number;
  /** 원본 px 기준 능선 두께 분위수 */
  strokePx: { p5: number; p10: number; p25: number; p50: number } | null;
  /** 분위수 계산용 표본(≤64, 원본 px) */
  strokeSamplesPx: number[];
  widthMm: number | null;
  minStrokeMm: number | null;
}

export interface QualityVerdict {
  profile: PrintProfile;
  flags: QualityFlag[];
  grade: 'ok' | 'review';
  labels: string[];
  thinRatio: number;
}

export interface ArtworkQuality {
  metrics: ArtworkMetrics;
  dtf: QualityVerdict;
  screen: QualityVerdict;
  embroidery: QualityVerdict;
}

/** 분석 해상도 상한 — 1024 이하 원본은 리샘플 없이 그대로(가는 선이 사라지지 않게), 큰 업로드만 축소 */
const ANALYZE_MAX = 1024;
const GRADIENT_SCORE_LIMIT = 0.15;
const GRADIENT_BUCKET_LIMIT = 16;
const GRADIENT_RESIDUAL_LIMIT = 0.25;
const THIN_RATIO_LIMIT = 0.05;
const COVERAGE_LIMIT = 0.03;
const BG_TOLERANCE = 40;

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** 테두리 2px 링에서 가장 흔한(양자화) 색 = 배경색 추정 */
function estimateBackground(px: Uint8Array, w: number, h: number): [number, number, number] {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const ring = 2;
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2];
    counts.set(key, e);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) visit(x, y);
    }
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  if (!best) return [255, 255, 255];
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

/** chamfer 3-4 거리변환: 전경 픽셀마다 가장 가까운 배경까지의 거리(×3 정수). 이미지 밖은 배경. */
function distanceTransform(fg: Uint8Array, w: number, h: number): Int32Array {
  const INF = 1 << 29;
  const dt = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) dt[i] = fg[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dt[i] === 0) continue;
      let v = dt[i];
      const up = y > 0 ? dt[i - w] + 3 : 3;
      const left = x > 0 ? dt[i - 1] + 3 : 3;
      const ul = x > 0 && y > 0 ? dt[i - w - 1] + 4 : 4;
      const ur = x < w - 1 && y > 0 ? dt[i - w + 1] + 4 : 4;
      if (up < v) v = up;
      if (left < v) v = left;
      if (ul < v) v = ul;
      if (ur < v) v = ur;
      dt[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (dt[i] === 0) continue;
      let v = dt[i];
      const down = y < h - 1 ? dt[i + w] + 3 : 3;
      const right = x < w - 1 ? dt[i + 1] + 3 : 3;
      const dl = x > 0 && y < h - 1 ? dt[i + w - 1] + 4 : 4;
      const dr = x < w - 1 && y < h - 1 ? dt[i + w + 1] + 4 : 4;
      if (down < v) v = down;
      if (right < v) v = right;
      if (dl < v) v = dl;
      if (dr < v) v = dr;
      dt[i] = v;
    }
  }
  return dt;
}

/** 마스크 영역의 능선(국소 최대 거리) 두께 표본(px). 얇은 선이면 작은 값이 많이 나온다. */
function ridgeThickness(mask: Uint8Array, w: number, h: number): number[] {
  const dt = distanceTransform(mask, w, h);
  const ridge: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = dt[i];
      if (v <= 0) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          const nv = nx < 0 || ny < 0 || nx >= w || ny >= h ? 0 : dt[ny * w + nx];
          if (nv > v) { isMax = false; break; }
        }
      }
      if (isMax) ridge.push((2 * v) / 3);
    }
  }
  return ridge;
}

/** 테두리와 이어지지 않은 배경 = 도안 안의 틈(구멍) 마스크 */
function enclosedHoles(fg: Uint8Array, w: number, h: number): { mask: Uint8Array; count: number } {
  const N = w * h;
  const reach = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const push = (i: number) => { if (!reach[i] && !fg[i]) { reach[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + (w - 1)); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  const mask = new Uint8Array(N);
  let count = 0;
  for (let i = 0; i < N; i++) if (!fg[i] && !reach[i]) { mask[i] = 1; count++; }
  return { mask, count };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}

export async function analyzeArtwork(
  input: Buffer,
  opts: { widthMm?: number | null } = {}
): Promise<ArtworkQuality> {
  const meta = await sharp(input).metadata();
  const origW = meta.width ?? 0;
  const origH = meta.height ?? 0;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize({ width: ANALYZE_MAX, height: ANALYZE_MAX, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const w = info.width;
  const h = info.height;
  const N = w * h;
  const scaleBack = origW > 0 ? origW / w : 1;

  // 1) 투명 배경 여부
  let transparentCount = 0;
  for (let i = 0; i < N; i++) if (px[i * 4 + 3] < 128) transparentCount++;
  const transparent = transparentCount / N >= 0.01;
  const bg = transparent ? null : estimateBackground(px, w, h);

  // 2) 전경 마스크
  const fg = new Uint8Array(N);
  let fgCount = 0;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    let isFg: boolean;
    if (transparent) isFg = px[o + 3] >= 128;
    else isFg = colorDist(px[o], px[o + 1], px[o + 2], bg![0], bg![1], bg![2]) > BG_TOLERANCE;
    if (isFg) { fg[i] = 1; fgCount++; }
  }
  const coverage = fgCount / N;

  // 3) 내부 픽셀(가장자리 안티앨리어싱 제외)
  const interior = new Uint8Array(N);
  let interiorCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!fg[i]) continue;
      if (transparent && px[i * 4 + 3] < 250) continue;
      if (fg[i - 1] && fg[i + 1] && fg[i - w] && fg[i + w]) { interior[i] = 1; interiorCount++; }
    }
  }

  // 4) 색 버킷 → 군집
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < N; i++) {
    if (!interior[i]) continue;
    const o = i * 4;
    const key = ((px[o] >> 3) << 10) | ((px[o + 1] >> 3) << 5) | (px[o + 2] >> 3);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += px[o]; e.g += px[o + 1]; e.b += px[o + 2];
    buckets.set(key, e);
  }
  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => b.n - a.n);
  const distinctBuckets = interiorCount > 0 ? sortedBuckets.filter((b) => b.n / interiorCount >= 0.003).length : 0;
  // 군집: 기준색(seed)과의 거리로만 합친다 — 이동 평균으로 합치면 그라데이션이 사슬처럼 한 색으로 뭉친다
  const clusters: Array<{ n: number; r: number; g: number; b: number; sr: number; sg: number; sb: number }> = [];
  for (const b of sortedBuckets) {
    const cr = b.r / b.n, cg = b.g / b.n, cb = b.b / b.n;
    let merged = false;
    for (const c of clusters) {
      if (colorDist(cr, cg, cb, c.sr, c.sg, c.sb) <= 40) {
        c.n += b.n; c.r += b.r; c.g += b.g; c.b += b.b;
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push({ n: b.n, r: b.r, g: b.g, b: b.b, sr: cr, sg: cg, sb: cb });
  }
  clusters.sort((a, b) => b.n - a.n);
  const shareOf = (c: { n: number }) => (interiorCount > 0 ? c.n / interiorCount : 0);
  const majorClusters = clusters.filter((c) => shareOf(c) >= 0.015);
  const colorCount = majorClusters.length;
  const palette = clusters.slice(0, 8).map((c) => ({
    hex: toHex(c.r / c.n, c.g / c.n, c.b / c.n),
    share: Math.round(shareOf(c) * 1000) / 1000,
  }));
  // 팔레트 잔차: 주요 색 어디에도 가깝지 않은 내부 픽셀 비율 — 완만한 그라데이션·사진은 크다
  let residual = 0;
  const centers = majorClusters.map((c) => [c.r / c.n, c.g / c.n, c.b / c.n] as const);
  if (centers.length > 0) {
    for (let i = 0; i < N; i++) {
      if (!interior[i]) continue;
      const o = i * 4;
      let best = Infinity;
      for (const [cr, cg, cb] of centers) {
        const d = colorDist(px[o], px[o + 1], px[o + 2], cr, cg, cb);
        if (d < best) best = d;
      }
      if (best > 24) residual++;
    }
  }
  const paletteResidual = interiorCount > 0 ? Math.round((residual / interiorCount) * 1000) / 1000 : 0;

  // 5) 그라데이션 점수: 내부 픽셀과 오른쪽·아래 이웃의 완만한 차이 비율
  let smooth = 0, comparisons = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!interior[i]) continue;
      const o = i * 4;
      for (const j of [i + 1, i + w]) {
        if (!interior[j]) continue;
        const p = j * 4;
        const d = Math.max(Math.abs(px[o] - px[p]), Math.abs(px[o + 1] - px[p + 1]), Math.abs(px[o + 2] - px[p + 2]));
        comparisons++;
        if (d >= 12 && d <= 48) smooth++;
      }
    }
  }
  const gradientScore = comparisons > 0 ? Math.round((smooth / comparisons) * 1000) / 1000 : 0;

  // 6) 선 굵기: 전경 능선 두께 + 도안 안 틈(구멍)의 두께 — 얇은 틈도 자수·전사에서 뭉개지므로 같은 표본에 합친다
  const ridge = ridgeThickness(fg, w, h);
  const holes = enclosedHoles(fg, w, h);
  if (holes.count > 0) ridge.push(...ridgeThickness(holes.mask, w, h));
  ridge.sort((a, b) => a - b);
  const strokePx = ridge.length > 0
    ? {
        p5: Math.round(quantile(ridge, 0.05) * scaleBack * 10) / 10,
        p10: Math.round(quantile(ridge, 0.1) * scaleBack * 10) / 10,
        p25: Math.round(quantile(ridge, 0.25) * scaleBack * 10) / 10,
        p50: Math.round(quantile(ridge, 0.5) * scaleBack * 10) / 10,
      }
    : null;
  const sampleCount = Math.min(64, ridge.length);
  const strokeSamplesPx: number[] = [];
  for (let k = 0; k < sampleCount; k++) {
    const idx = Math.floor((k / Math.max(1, sampleCount - 1)) * (ridge.length - 1));
    strokeSamplesPx.push(Math.round(ridge[idx] * scaleBack * 10) / 10);
  }

  const widthMm = opts.widthMm && opts.widthMm > 0 ? opts.widthMm : null;
  const mmPerPx = widthMm && origW > 0 ? widthMm / origW : null;
  const minStrokeMm = strokePx && mmPerPx ? Math.round(strokePx.p10 * mmPerPx * 100) / 100 : null;

  const metrics: ArtworkMetrics = {
    version: 1,
    width: origW,
    height: origH,
    transparent,
    coverage: Math.round(coverage * 1000) / 1000,
    colorCount,
    palette,
    distinctBuckets,
    gradientScore,
    paletteResidual,
    strokePx,
    strokeSamplesPx,
    widthMm,
    minStrokeMm,
  };
  return {
    metrics,
    dtf: evaluateArtwork(metrics, 'dtf'),
    screen: evaluateArtwork(metrics, 'screen'),
    embroidery: evaluateArtwork(metrics, 'embroidery'),
  };
}

export function evaluateArtwork(metrics: ArtworkMetrics, profile: PrintProfile): QualityVerdict {
  const limits = PROFILE_LIMITS[profile];
  const flags: QualityFlag[] = [];
  const labels: string[] = [];

  if (limits.maxColors !== null && metrics.colorCount > limits.maxColors) {
    flags.push('too_many_colors');
    labels.push(`색 ${metrics.colorCount}종 (${PROFILE_LABELS[profile]} ${limits.maxColors}색 이하 권장)`);
  }
  const gradientLike =
    metrics.gradientScore >= GRADIENT_SCORE_LIMIT ||
    metrics.distinctBuckets >= GRADIENT_BUCKET_LIMIT ||
    metrics.paletteResidual >= GRADIENT_RESIDUAL_LIMIT;
  if (!limits.allowGradient && gradientLike) {
    flags.push('gradient');
    labels.push('그라데이션·음영 감지 (단색으로 정리 필요)');
  }

  // 선 굵기: mm를 알면 mm 기준, 모르면 120mm 폭 가정
  const mmPerPx = metrics.widthMm && metrics.width > 0
    ? metrics.widthMm / metrics.width
    : metrics.width > 0 ? ASSUMED_WIDTH_MM / metrics.width : null;
  let thinRatio = 0;
  if (mmPerPx && metrics.strokeSamplesPx.length > 0) {
    const thin = metrics.strokeSamplesPx.filter((s) => s * mmPerPx < limits.minStrokeMm).length;
    thinRatio = Math.round((thin / metrics.strokeSamplesPx.length) * 1000) / 1000;
    const p10Mm = (metrics.strokePx?.p10 ?? 0) * mmPerPx;
    if (p10Mm < limits.minStrokeMm && thinRatio >= THIN_RATIO_LIMIT) {
      flags.push('thin_lines');
      labels.push(
        metrics.widthMm
          ? `가는 선 약 ${p10Mm.toFixed(1)}mm (${PROFILE_LABELS[profile]} 최소 ${limits.minStrokeMm}mm)`
          : `가는 선·작은 디테일 감지 (${ASSUMED_WIDTH_MM}mm 폭 기준 약 ${p10Mm.toFixed(1)}mm)`
      );
    }
  }
  if (metrics.coverage < COVERAGE_LIMIT) {
    flags.push('low_coverage');
    labels.push('도안이 너무 작거나 비어 있음');
  }
  return { profile, flags, grade: flags.length > 0 ? 'review' : 'ok', labels, thinRatio };
}

/** 원장·canvas_state에 넣는 축약형(표본 배열 제외) */
export function compactQuality(q: ArtworkQuality) {
  const { strokeSamplesPx: _samples, ...metrics } = q.metrics;
  void _samples;
  return {
    metrics,
    dtf: { flags: q.dtf.flags, grade: q.dtf.grade, labels: q.dtf.labels },
    screen: { flags: q.screen.flags, grade: q.screen.grade, labels: q.screen.labels },
    embroidery: { flags: q.embroidery.flags, grade: q.embroidery.grade, labels: q.embroidery.labels },
  };
}
export type CompactQuality = ReturnType<typeof compactQuality>;

/* ---------- 단색 배경 제거 ---------- */

export interface BackgroundRemovalResult {
  png: Buffer;
  width: number;
  height: number;
  removed: boolean;
  bgHex: string | null;
}

/**
 * 테두리에서 이어진 단색 배경만 투명 처리(플러드필). 도안 안쪽의 흰 영역은 보존한다.
 * 이미 투명 배경이면 여백만 잘라낸다. 사진 같은 복잡한 배경은 처리하지 않는다(플래그 없이 원본 반환).
 */
export async function removeFlatBackground(
  input: Buffer,
  opts: { tolerance?: number; trim?: boolean; paddingRatio?: number; maxDim?: number } = {}
): Promise<BackgroundRemovalResult> {
  const tolerance = opts.tolerance ?? BG_TOLERANCE;
  const maxDim = opts.maxDim ?? 2048;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const w = info.width, h = info.height, N = w * h;

  let transparentCount = 0;
  for (let i = 0; i < N; i++) if (px[i * 4 + 3] < 128) transparentCount++;
  const alreadyTransparent = transparentCount / N >= 0.01;
  let bgHex: string | null = null;

  if (!alreadyTransparent) {
    const bg = estimateBackground(px, w, h);
    bgHex = toHex(bg[0], bg[1], bg[2]);
    const isBgLike = (i: number) => {
      const o = i * 4;
      return colorDist(px[o], px[o + 1], px[o + 2], bg[0], bg[1], bg[2]) <= tolerance;
    };
    const mask = new Uint8Array(N);
    const queue = new Int32Array(N);
    let head = 0, tail = 0;
    const push = (i: number) => { if (!mask[i] && isBgLike(i)) { mask[i] = 1; queue[tail++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + (w - 1)); }
    while (head < tail) {
      const i = queue[head++];
      const x = i % w, y = (i - x) / w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    // 배경 → 투명, 배경과 맞닿은 전경 가장자리 → 배경색 대비로 부드러운 알파 + 색 보정(헤일로 방지)
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (mask[i]) { px[o + 3] = 0; continue; }
      const x = i % w, y = (i - x) / w;
      const touchesBg =
        (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]);
      if (!touchesBg) continue;
      const d = colorDist(px[o], px[o + 1], px[o + 2], bg[0], bg[1], bg[2]);
      const a = Math.max(0.05, Math.min(1, (d - tolerance * 0.5) / 90));
      px[o] = Math.max(0, Math.min(255, Math.round((px[o] - (1 - a) * bg[0]) / a)));
      px[o + 1] = Math.max(0, Math.min(255, Math.round((px[o + 1] - (1 - a) * bg[1]) / a)));
      px[o + 2] = Math.max(0, Math.min(255, Math.round((px[o + 2] - (1 - a) * bg[2]) / a)));
      px[o + 3] = Math.round(a * 255);
    }
  }

  // 여백 잘라내기
  let left = 0, top = 0, right = w - 1, bottom = h - 1;
  if (opts.trim !== false) {
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      const pad = Math.round(Math.max(maxX - minX, maxY - minY) * (opts.paddingRatio ?? 0.03));
      left = Math.max(0, minX - pad);
      top = Math.max(0, minY - pad);
      right = Math.min(w - 1, maxX + pad);
      bottom = Math.min(h - 1, maxY + pad);
    }
  }
  const outW = right - left + 1;
  const outH = bottom - top + 1;
  const png = await sharp(Buffer.from(px.buffer, px.byteOffset, px.byteLength), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: outW, height: outH })
    .png()
    .toBuffer();
  return { png, width: outW, height: outH, removed: !alreadyTransparent, bgHex };
}

/** SVG 문자열 → PNG(정사각 캔버스 안에 맞춤) */
export async function rasterizeSvg(svg: string, size = 1024): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize({ width: size, height: size, fit: 'inside' }).png().toBuffer();
}

export async function imageDims(buf: Buffer): Promise<{ width: number; height: number }> {
  const m = await sharp(buf).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}
