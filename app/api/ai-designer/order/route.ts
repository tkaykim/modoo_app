import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { loadProductSides } from '@/lib/aiDesigner/serverGeometry';
import {
  buildSideCanvasState,
  computePlacement,
  type PlacementInput,
  type ComputedPlacement,
} from '@/lib/aiDesigner/placement';
import { computePrintSurcharge } from '@/lib/aiDesigner/serverPricing';
import { fetchImageDims } from '@/lib/aiDesigner/imageDims';
import { analyzeArtwork, compactQuality, type CompactQuality } from '@/lib/aiDesigner/quality';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SourceImageRow {
  url: string; path?: string; name?: string; width?: number; height?: number;
  origin?: 'upload' | 'camera' | 'ai'; prompt?: string; generationId?: string | null;
  svgUrl?: string | null; bgRemoved?: boolean;
}

/**
 * 배치된 실제 폭(mm) 기준 인쇄 적합성 검사 — 디자이너 보정 플래그용. 실패해도 주문은 막지 않는다.
 * 같은 이미지가 여러 면에 쓰이면 URL+폭 단위로 캐시.
 */
async function qualityAtSize(
  cache: Map<string, CompactQuality | null>,
  url: string,
  widthMm: number
): Promise<CompactQuality | null> {
  const key = `${url}|${Math.round(widthMm)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let result: CompactQuality | null = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0 && buf.length <= 12 * 1024 * 1024) {
        result = compactQuality(await analyzeArtwork(buf, { widthMm }));
      }
    }
  } catch (e) {
    console.warn('[ai-designer/order] quality check skipped', e instanceof Error ? e.message : e);
  }
  cache.set(key, result);
  return result;
}

interface OrderPlacement {
  side_id: string;
  image_index: number;
  anchor_id?: string;
  anchor_label?: string;
  fx: number;
  fy: number;
  width_mm: number;
}

/**
 * AI 디자이너 세션 → saved_design + cart_items 생성 (로그인 필수).
 * 결제는 기존 /cart → /checkout 경로를 그대로 사용한다 — 결제 코드는 건드리지 않는다.
 * 원본 보장: canvas_state 오브젝트의 data.originalFileUrl + saved_designs.image_urls
 * + ai_designer_requests.source_images 3중 보존.
 */
export async function POST(req: Request) {
  const authed = await createAuthedClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  const sizeQuantities = (body?.sizeQuantities ?? {}) as Record<string, number>;
  const previewDataUrl = typeof body?.previewDataUrl === 'string' ? body.previewDataUrl : null;
  const customerNote = typeof body?.customerNote === 'string' ? body.customerNote.slice(0, 2000) : '';
  if (!sessionId) return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });

  const sizes = Object.entries(sizeQuantities).filter(
    ([, q]) => Number.isInteger(q) && q > 0 && q <= 10000
  );
  if (sizes.length === 0) {
    return NextResponse.json({ error: '사이즈별 수량을 입력해 주세요.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from('ai_designer_requests')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  if (session.user_id && session.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  if (session.status === 'ordered') {
    return NextResponse.json({ error: '이미 장바구니에 담긴 세션입니다.' }, { status: 409 });
  }
  if (!session.product_id) {
    return NextResponse.json({ error: '상품이 선택되지 않았습니다.' }, { status: 400 });
  }

  const placements = (session.placements ?? []) as OrderPlacement[];
  const sourceImages = (session.source_images ?? []) as SourceImageRow[];
  if (placements.length === 0 || sourceImages.length === 0) {
    return NextResponse.json({ error: '배치된 이미지가 없습니다.' }, { status: 400 });
  }

  const loaded = await loadProductSides(admin, session.product_id);
  if (!loaded) return NextResponse.json({ error: '상품 정보를 찾을 수 없습니다.' }, { status: 404 });

  const color = (session.product_color ?? {}) as {
    hex?: string; name?: string; code?: string; side_mockups?: Record<string, string>;
  };
  const colorHex = color.hex || '#FFFFFF';

  // 면별 캔버스 상태 구성
  const canvasState: Record<string, unknown> = {};
  const sideBoxesMm: Array<{ widthMm: number; heightMm: number }> = [];
  const usedImageUrls = new Set<string>();
  const qualityCache = new Map<string, CompactQuality | null>();

  for (const side of loaded.sides) {
    const sidePlacements = placements.filter((p) => p.side_id === side.geometry.sideId);
    const objects: Array<{ input: PlacementInput; computed: ComputedPlacement }> = [];
    const objectMeta: Array<{ img: SourceImageRow; widthMm: number }> = [];
    for (const p of sidePlacements) {
      const img = sourceImages[p.image_index];
      if (!img?.url) continue;
      let w = img.width ?? 0;
      let h = img.height ?? 0;
      if (!(w > 0 && h > 0)) {
        const dims = await fetchImageDims(img.url);
        if (!dims) continue;
        w = dims.w;
        h = dims.h;
      }
      const anchor = p.anchor_id
        ? side.anchors.find((a) => a.id === p.anchor_id)
        : undefined;
      const input: PlacementInput = {
        sideId: side.geometry.sideId,
        fx: p.fx,
        fy: p.fy,
        widthMm: p.width_mm,
        anchorXMm: anchor?.xMm,
        anchorYMm: anchor?.yMm,
        image: { url: img.url, path: img.path, name: img.name, naturalWidth: w, naturalHeight: h },
      };
      const computed = computePlacement(side.geometry, input);
      objects.push({ input, computed });
      objectMeta.push({ img, widthMm: computed.widthMm > 0 ? computed.widthMm : p.width_mm });
      usedImageUrls.add(img.url);
    }
    const state = buildSideCanvasState(side.geometry, colorHex, objects);
    // AI 초안 표시 + 배치 폭 기준 인쇄 적합성(디자이너 보정 플래그) — 에디터/관리자가 그대로 읽는 data 필드
    const stateObjects = state.objects as Array<{ data?: Record<string, unknown> }>;
    for (let i = 0; i < objectMeta.length; i++) {
      const { img, widthMm } = objectMeta[i];
      const data = stateObjects[i]?.data;
      if (!data) continue;
      const quality = await qualityAtSize(qualityCache, img.url, widthMm);
      Object.assign(data, {
        bgRemoved: !!img.bgRemoved,
        ...(quality ? { artworkQuality: quality } : {}),
        ...(img.origin === 'ai'
          ? {
              aiGenerated: true,
              aiPrompt: img.prompt ?? null,
              aiGenerationId: img.generationId ?? null,
              originalSvgUrl: img.svgUrl ?? null,
            }
          : {}),
      });
    }
    canvasState[side.geometry.sideId] = state;
    const bbox = state.totalBoundingBoxMm as { widthMm: number; heightMm: number } | null;
    if (objects.length > 0) {
      if (bbox) {
        sideBoxesMm.push(bbox);
      } else {
        // mm 실측 없는 상품 — 목표 폭 기준 근사(가장 큰 도안 폭)
        const maxW = Math.max(...objects.map((o) => o.input.widthMm));
        sideBoxesMm.push({ widthMm: maxW, heightMm: maxW });
      }
    }
  }

  if (usedImageUrls.size === 0) {
    return NextResponse.json({ error: '이미지 배치를 확인해 주세요.' }, { status: 400 });
  }

  // 가격: base_price + 면별 DTF 인쇄비 (프로덕션 canvasPricing 경로 미러)
  const surcharge = await computePrintSurcharge(admin, sideBoxesMm);
  const pricePerItem = loaded.product.base_price + surcharge;

  // 미리보기 업로드 (클라이언트 합성 PNG)
  let previewUrl: string | null = null;
  if (previewDataUrl?.startsWith('data:image/')) {
    try {
      const b64 = previewDataUrl.split(',')[1] ?? '';
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > 0 && buf.length <= 4 * 1024 * 1024) {
        const path = `ai-designer/previews/${sessionId}-${Date.now()}.png`;
        const { error } = await admin.storage
          .from('user-designs')
          .upload(path, buf, { contentType: 'image/png', upsert: true });
        if (!error) {
          previewUrl = admin.storage.from('user-designs').getPublicUrl(path).data.publicUrl;
        }
      }
    } catch { /* 미리보기 실패는 치명 아님 */ }
  }
  const draftImages = (session.draft_images ?? {}) as Record<string, string>;
  if (!previewUrl) previewUrl = draftImages['front'] || Object.values(draftImages)[0] || null;

  // saved_design 생성 — retouch_requested로 디자이너 손작업 플래그
  const { data: design, error: designErr } = await admin
    .from('saved_designs')
    .insert({
      user_id: user.id,
      product_id: session.product_id,
      title: `AI 디자이너 - ${loaded.product.title}`,
      color_selections: { productColor: colorHex },
      canvas_state: canvasState,
      preview_url: previewUrl,
      image_urls: Array.from(usedImageUrls),
      price_per_item: pricePerItem,
      custom_fonts: [],
      retouch_requested: true,
    })
    .select('id')
    .single();
  if (designErr || !design) {
    console.error('[ai-designer/order] design insert failed', designErr);
    return NextResponse.json({ error: '디자인 저장에 실패했습니다.' }, { status: 500 });
  }

  // 사이즈별 cart_items 생성
  const cartRows = sizes.map(([size, qty]) => ({
    user_id: user.id,
    product_id: session.product_id,
    saved_design_id: design.id,
    product_title: loaded.product.title,
    product_color: colorHex,
    product_color_name: color.name || '',
    product_color_code: color.code || null,
    size_id: size,
    size_name: size,
    quantity: qty,
    price_per_item: pricePerItem,
    thumbnail_url: previewUrl,
  }));
  const { data: cartItems, error: cartErr } = await admin
    .from('cart_items')
    .insert(cartRows)
    .select('id');
  if (cartErr) {
    console.error('[ai-designer/order] cart insert failed', cartErr);
    return NextResponse.json({ error: '장바구니 담기에 실패했습니다.' }, { status: 500 });
  }

  await admin
    .from('ai_designer_requests')
    .update({
      status: 'ordered',
      user_id: user.id,
      saved_design_id: design.id,
      cart_item_ids: (cartItems ?? []).map((c) => c.id),
      size_quantities: sizeQuantities,
      customer_note: customerNote || session.customer_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return NextResponse.json({
    ok: true,
    savedDesignId: design.id,
    cartItemIds: (cartItems ?? []).map((c) => c.id),
    pricePerItem,
  });
}
