/**
 * AI 디자이너 — 서버측 캔버스 배치 수학 + canvas_state 빌더.
 *
 * 에디터 캔버스는 고정 400×500 좌표계다(ProductDesigner가 SingleSideCanvas에
 * width=400 height=500을 넘기고, 저장된 좌표는 restore 시 그대로 쓰인다).
 * SingleSideCanvas의 목업 배치 공식을 그대로 미러링한다:
 *   baseScale = min(400/imgW, 500/imgH); scale = baseScale * zoomScale
 *   imageLeft = (400 - imgW*scale)/2; imageTop = (500 - imgH*scale)/2
 *   printArea(canvas) = imageLeft + printArea.x*scale, ...
 * 오브젝트 mm 크기 → 캔버스 px: (widthMm / nativeMmPerPx) * scale
 * (nativeMmPerPx = mm per 원본 목업 px — product_calibrations 1순위,
 *  realLifeDimensions.printAreaWidthMm / printArea.width 2순위)
 *
 * 여기서 만든 canvas_state는 에디터/관리자 에디터가 그대로 열 수 있는
 * fabric 7.x JSON이며, 원본 이미지 URL을 data.originalFileUrl로 보존한다.
 */

export const EDITOR_CANVAS_W = 400;
export const EDITOR_CANVAS_H = 500;

export interface SideGeometry {
  sideId: string;
  imgW: number; // 원본 목업 px
  imgH: number;
  zoomScale: number;
  printArea: { x: number; y: number; width: number; height: number };
  nativeMmPerPx: number; // 0이면 mm 환산 불가(폭 비율 폴백 사용)
}

export interface PlacementInput {
  sideId: string;
  /** 인쇄영역 기준 상대 좌표 (0~1). 오브젝트 중심점. */
  fx: number;
  fy: number;
  /** 도안 목표 폭(mm). nativeMmPerPx 없으면 인쇄영역 폭 대비 비율로 폴백. */
  widthMm: number;
  /** 목업 원점 기준 앵커 mm 좌표 — 있으면 fx/fy 대신 사용(캘리브 앵커). */
  anchorXMm?: number;
  anchorYMm?: number;
  image: {
    url: string;
    path?: string;
    name?: string;
    naturalWidth: number;
    naturalHeight: number;
  };
}

export interface ComputedPlacement {
  left: number;
  top: number;
  scale: number;
  widthMm: number;
  heightMm: number;
  canvasScale: number; // 목업 scale (원본px → 캔버스px)
}

export function computeSideScale(geo: SideGeometry): {
  scale: number;
  imageLeft: number;
  imageTop: number;
  printAreaLeft: number;
  printAreaTop: number;
  printAreaW: number;
  printAreaH: number;
} {
  const baseScale = Math.min(EDITOR_CANVAS_W / geo.imgW, EDITOR_CANVAS_H / geo.imgH);
  const scale = baseScale * (geo.zoomScale || 1);
  const imageLeft = EDITOR_CANVAS_W / 2 - (geo.imgW * scale) / 2;
  const imageTop = EDITOR_CANVAS_H / 2 - (geo.imgH * scale) / 2;
  return {
    scale,
    imageLeft,
    imageTop,
    printAreaLeft: imageLeft + geo.printArea.x * scale,
    printAreaTop: imageTop + geo.printArea.y * scale,
    printAreaW: geo.printArea.width * scale,
    printAreaH: geo.printArea.height * scale,
  };
}

export function computePlacement(geo: SideGeometry, p: PlacementInput): ComputedPlacement {
  const s = computeSideScale(geo);

  // 목표 폭 → 캔버스 px
  let targetCanvasW: number;
  const widthMm = p.widthMm;
  if (geo.nativeMmPerPx > 0) {
    targetCanvasW = (p.widthMm / geo.nativeMmPerPx) * s.scale;
  } else {
    // mm 실측이 없는 상품: 인쇄영역 폭을 300mm로 가정한 비율 폴백
    const assumedPrintWidthMm = 300;
    targetCanvasW = (p.widthMm / assumedPrintWidthMm) * s.printAreaW;
  }
  // 인쇄영역을 넘지 않게 캡
  targetCanvasW = Math.min(targetCanvasW, s.printAreaW * 0.96);

  const objScale = targetCanvasW / p.image.naturalWidth;
  const targetCanvasH = p.image.naturalHeight * objScale;
  const heightMm =
    geo.nativeMmPerPx > 0 ? (targetCanvasH / s.scale) * geo.nativeMmPerPx : 0;

  // 중심 좌표: 앵커 mm(목업 원점) 우선, 아니면 인쇄영역 상대 fx/fy
  let cx: number;
  let cy: number;
  if (
    typeof p.anchorXMm === 'number' &&
    typeof p.anchorYMm === 'number' &&
    geo.nativeMmPerPx > 0
  ) {
    cx = s.imageLeft + (p.anchorXMm / geo.nativeMmPerPx) * s.scale;
    cy = s.imageTop + (p.anchorYMm / geo.nativeMmPerPx) * s.scale;
  } else {
    cx = s.printAreaLeft + p.fx * s.printAreaW;
    cy = s.printAreaTop + p.fy * s.printAreaH;
  }

  // 세로로 인쇄영역을 벗어나면 안쪽으로 클램프
  const halfH = targetCanvasH / 2;
  cy = Math.min(Math.max(cy, s.printAreaTop + halfH), s.printAreaTop + s.printAreaH - halfH);
  const halfW = targetCanvasW / 2;
  cx = Math.min(Math.max(cx, s.printAreaLeft + halfW), s.printAreaLeft + s.printAreaW - halfW);

  return {
    left: cx,
    top: cy,
    scale: objScale,
    widthMm,
    heightMm,
    canvasScale: s.scale,
  };
}

/** 에디터가 저장하는 것과 동일 골격의 fabric Image 오브젝트 JSON. */
export function buildImageObject(
  sideId: string,
  p: PlacementInput,
  c: ComputedPlacement
): Record<string, unknown> {
  const now = Date.now();
  const objectId = `${sideId}-${now}-${Math.random().toString(36).slice(2, 11)}`;
  return {
    src: p.image.url,
    top: c.top,
    left: c.left,
    data: {
      objectId,
      printMethod: 'dtf',
      widthMm: c.widthMm > 0 ? Math.round(c.widthMm * 10) / 10 : undefined,
      heightMm: c.heightMm > 0 ? Math.round(c.heightMm * 10) / 10 : undefined,
      fileType: 'image/png',
      bgRemoved: false,
      sizeBasis: 'alpha',
      uploadedAt: new Date().toISOString(),
      isConverted: false,
      supabaseUrl: p.image.url,
      supabasePath: p.image.path,
      originalFileUrl: p.image.url,
      originalFileName: p.image.name || 'ai-designer.png',
      aiDesigner: true,
    },
    fill: 'rgb(0,0,0)',
    type: 'Image',
    angle: 0,
    cropX: 0,
    cropY: 0,
    flipX: false,
    flipY: false,
    skewX: 0,
    skewY: 0,
    width: p.image.naturalWidth,
    height: p.image.naturalHeight,
    scaleX: c.scale,
    scaleY: c.scale,
    shadow: null,
    stroke: null,
    filters: [],
    opacity: 1,
    originX: 'center',
    originY: 'center',
    version: '7.2.0',
    visible: true,
    fillRule: 'nonzero',
    paintFirst: 'fill',
    crossOrigin: 'anonymous',
    strokeWidth: 0,
    strokeLineCap: 'butt',
    strokeUniform: false,
    strokeLineJoin: 'miter',
    backgroundColor: '',
    strokeDashArray: null,
    strokeDashOffset: 0,
    strokeMiterLimit: 4,
    globalCompositeOperation: 'source-over',
  };
}

/** 면별 canvas_state JSON(문자열 아님) — 호출측에서 JSON.stringify 해 Record<side,string>으로 저장. */
export function buildSideCanvasState(
  geo: SideGeometry,
  productColorHex: string,
  objects: Array<{ input: PlacementInput; computed: ComputedPlacement }>
): Record<string, unknown> {
  let bboxMm: { widthMm: number; heightMm: number } | null = null;
  if (objects.length > 0 && geo.nativeMmPerPx > 0) {
    const s = computeSideScale(geo);
    const lefts = objects.map((o) => o.computed.left - (o.input.image.naturalWidth * o.computed.scale) / 2);
    const rights = objects.map((o) => o.computed.left + (o.input.image.naturalWidth * o.computed.scale) / 2);
    const tops = objects.map((o) => o.computed.top - (o.input.image.naturalHeight * o.computed.scale) / 2);
    const bottoms = objects.map((o) => o.computed.top + (o.input.image.naturalHeight * o.computed.scale) / 2);
    const wPx = Math.max(...rights) - Math.min(...lefts);
    const hPx = Math.max(...bottoms) - Math.min(...tops);
    bboxMm = {
      widthMm: Math.round(((wPx / s.scale) * geo.nativeMmPerPx) * 10) / 10,
      heightMm: Math.round(((hPx / s.scale) * geo.nativeMmPerPx) * 10) / 10,
    };
  }
  return {
    objects: objects.map((o) => buildImageObject(geo.sideId, o.input, o.computed)),
    version: '7.2.0',
    layerColors: {},
    productColor: productColorHex,
    totalBoundingBoxMm: bboxMm,
    __mmPerPxCalibrationNative: geo.nativeMmPerPx > 0 ? geo.nativeMmPerPx : null,
  };
}
