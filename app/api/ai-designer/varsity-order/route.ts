import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { loadProductSides } from '@/lib/aiDesigner/serverGeometry';
import { buildImageObject, computePlacement, computeSideScale, type PlacementInput } from '@/lib/aiDesigner/placement';
import { fetchImageDims } from '@/lib/aiDesigner/imageDims';
import {
  VARSITY_SLOTS,
  effectiveFont,
  effectiveSizeQuantities,
  enabledSlots,
  chenilleCountOf,
  normalizeBuilderState,
  slotText,
  surchargeKeysOf,
  totalQuantity,
  usesIndividualNumbers,
  type VarsityBuilderState,
  type VarsitySlotDef,
} from '@/lib/aiDesigner/varsitySlots';
import { DEFAULT_VARSITY_PRICING, quoteVarsity } from '@/lib/aiDesigner/varsityPricing';
import type { PartLayerSide } from '@/lib/aiDesigner/catalogTypes';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 과잠 빌더 → saved_design + cart_items (로그인 필수). 결제는 기존 /cart → /checkout.
 *
 * canvas_state는 에디터와 같은 fabric JSON이다:
 *   - layerColors: 부위별 색(관리자 에디터·공장 정보가 그대로 읽음)
 *   - IText / CurvedText: 자수 글자(서체 Freshman·Pretendard), data.printMethod='embroidery'
 *   - Image: 엠블럼(data.printMethod='applique', 원본 URL 보존)
 * 개인화 명단은 saved_designs.personalization → cart_items.personalization → 체크아웃에서
 * order_items.item_options.personalization 으로 이어진다. 가격은 varsityPricing(슬롯형 패키지가).
 */

interface RawLayer { id: string; name?: string; imageUrl?: string; zIndex?: number; colorOptions?: Array<{ name?: string; hex?: string; colorCode?: string }> }
interface RawSide { id: string; name?: string; layers?: RawLayer[] }

function textWidthEstimate(text: string, fontSize: number): number {
  // 자수 서체(대문자·숫자 위주) 평균 폭 ≈ 0.62em, 한글 ≈ 0.95em
  let w = 0;
  for (const ch of text) w += /[ㄱ-ㆎ가-힣]/.test(ch) ? fontSize * 0.95 : fontSize * 0.62;
  return w;
}

export async function POST(req: Request) {
  const authed = await createAuthedClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  const previewDataUrl = typeof body?.previewDataUrl === 'string' ? body.previewDataUrl : null;
  if (!sessionId) return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin.from('ai_designer_requests').select('*').eq('id', sessionId).single();
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  if (session.user_id && session.user_id !== user.id) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (session.status === 'ordered') return NextResponse.json({ error: '이미 장바구니에 담긴 세션입니다.' }, { status: 409 });
  // 세션 생성 직후 상품을 고르면 product_id PATCH가 누락될 수 있어 본문의 productId를 보조로 받는다.
  const bodyProductId = typeof body?.productId === 'string' && /^[0-9a-f-]{36}$/i.test(body.productId) ? body.productId : null;
  const productId: string | null = (session.product_id as string | null) ?? bodyProductId;
  if (!productId) return NextResponse.json({ error: '상품이 선택되지 않았습니다.' }, { status: 400 });

  const { data: productRow } = await admin
    .from('products')
    .select('id, title, base_price, configuration, size_options')
    .eq('id', productId)
    .single();
  if (!productRow) return NextResponse.json({ error: '상품 정보를 찾을 수 없습니다.' }, { status: 404 });

  const rawSides = (Array.isArray(productRow.configuration) ? productRow.configuration : []) as RawSide[];
  const partLayers: PartLayerSide[] = rawSides
    .filter((s) => Array.isArray(s.layers) && s.layers.length > 0)
    .map((s) => ({
      sideId: s.id,
      sideName: s.name || s.id,
      imgW: 0,
      imgH: 0,
      layers: [...(s.layers ?? [])]
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((l) => ({
          id: l.id,
          name: l.name || l.id,
          imageUrl: l.imageUrl ?? null,
          zIndex: l.zIndex ?? 0,
          colorOptions: (l.colorOptions ?? [])
            .filter((c) => typeof c.hex === 'string' && c.hex)
            .map((c) => ({ name: c.name ?? c.colorCode ?? '', hex: c.hex as string, colorCode: c.colorCode ?? '' })),
        })),
    }));
  if (partLayers.length === 0) return NextResponse.json({ error: '과잠 빌더 대상 상품이 아닙니다.' }, { status: 400 });

  const state: VarsityBuilderState = normalizeBuilderState(body?.state ?? session.builder_state, partLayers, null);
  const sizeLabels = ((productRow.size_options as Array<{ label: string }> | null) ?? []).map((s) => s.label);
  const sizeQuantities = effectiveSizeQuantities(state);
  for (const key of Object.keys(sizeQuantities)) {
    if (!sizeLabels.includes(key)) return NextResponse.json({ error: `사이즈 "${key}"는 선택할 수 없습니다.` }, { status: 400 });
  }
  const quantity = totalQuantity(state);
  const rule = DEFAULT_VARSITY_PRICING;
  if (quantity < 1) return NextResponse.json({ error: '수량을 입력해 주세요.' }, { status: 400 });
  if (quantity < rule.moq) return NextResponse.json({ error: `과잠은 최소 ${rule.moq}장부터 주문할 수 있습니다.` }, { status: 400 });
  if (state.roster.length > 0 && state.roster.some((r) => !r.size)) {
    return NextResponse.json({ error: '명단에 사이즈가 빠진 사람이 있습니다.' }, { status: 400 });
  }
  const active = enabledSlots(state);
  if (active.length === 0) return NextResponse.json({ error: '넣을 글자나 이미지를 하나 이상 지정해 주세요.' }, { status: 400 });

  const loaded = await loadProductSides(admin, productId);
  if (!loaded) return NextResponse.json({ error: '상품 정보를 찾을 수 없습니다.' }, { status: 404 });

  const quote = quoteVarsity(rule, {
    quantity,
    surchargeKeys: surchargeKeysOf(state),
    chenilleCount: chenilleCountOf(state),
    individualNumbers: usesIndividualNumbers(state),
  });
  const pricePerItem = Math.max(quote.unitPrice, Number(productRow.base_price) || 0);

  // 면별 canvas_state
  const canvasState: Record<string, unknown> = {};
  const layerColorsBySide: Record<string, Record<string, string>> = {};
  const usedImageUrls = new Set<string>();
  const now = Date.now();

  for (const side of loaded.sides) {
    const geo = side.geometry;
    const s = computeSideScale(geo);
    const part = partLayers.find((p) => p.sideId === geo.sideId);
    const layerColors: Record<string, string> = {};
    for (const l of part?.layers ?? []) layerColors[l.id] = state.partColors[l.id] || l.colorOptions[0]?.hex || '#ffffff';
    layerColorsBySide[geo.sideId] = layerColors;

    const objects: Record<string, unknown>[] = [];
    let bbox: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    const track = (cx: number, cy: number, w: number, h: number) => {
      const b = { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 };
      bbox = bbox
        ? { minX: Math.min(bbox.minX, b.minX), minY: Math.min(bbox.minY, b.minY), maxX: Math.max(bbox.maxX, b.maxX), maxY: Math.max(bbox.maxY, b.maxY) }
        : b;
    };

    for (const def of active.filter((d: VarsitySlotDef) => d.sideId === geo.sideId)) {
      const slot = state.slots[def.id];
      const cx = s.imageLeft + def.fx * geo.imgW * s.scale;

      if (slot.mode === 'image' && slot.image) {
        let w = slot.image.width, h = slot.image.height;
        if (!(w > 0 && h > 0)) {
          const dims = await fetchImageDims(slot.image.url);
          if (!dims) continue;
          w = dims.w; h = dims.h;
        }
        const widthMm = geo.nativeMmPerPx > 0
          ? def.maxWidthFrac * slot.scale * geo.imgW * geo.nativeMmPerPx
          : def.maxWidthFrac * slot.scale * 300;
        const input: PlacementInput = {
          sideId: geo.sideId,
          fx: def.fx,
          fy: def.fy,
          widthMm,
          image: { url: slot.image.url, path: slot.image.path, name: slot.image.name, naturalWidth: w, naturalHeight: h },
        };
        const computed = computePlacement(geo, input);
        const obj = buildImageObject(geo.sideId, input, computed);
        const data = obj.data as Record<string, unknown>;
        data.printMethod = 'applique';
        data.varsitySlot = def.id;
        objects.push(obj);
        track(computed.left, computed.top, w * computed.scale, h * computed.scale);
        usedImageUrls.add(slot.image.url);
        continue;
      }

      const texts: Array<{ text: string; fy: number; fontSize: number; curve: number }> = [];
      const fontSize = Math.round(def.defaultFontSize * slot.scale);
      const mainText = slotText(def, slot, state);
      if (mainText) texts.push({ text: mainText, fy: def.fy, fontSize, curve: def.curveIntensity ?? 0 });
      if (def.fy2 !== undefined && slot.text2.trim()) {
        texts.push({ text: slot.text2.trim(), fy: def.fy2, fontSize: Math.round(fontSize * 0.68), curve: 0 });
      }
      for (const t of texts) {
        const ty = s.imageTop + t.fy * geo.imgH * s.scale;
        const family = effectiveFont(slot.fontFamily, t.text);
        const widthPx = textWidthEstimate(t.text, t.fontSize);
        const heightPx = t.fontSize * 1.16;
        const mm = (px: number) => (geo.nativeMmPerPx > 0 ? Math.round(((px / s.scale) * geo.nativeMmPerPx) * 10) / 10 : undefined);
        const base = {
          top: ty,
          left: cx,
          text: t.text,
          fill: slot.fill,
          stroke: slot.stroke || '',
          strokeWidth: slot.stroke ? 3 : 0,
          paintFirst: slot.stroke ? 'stroke' : 'fill',
          angle: 0,
          flipX: false,
          flipY: false,
          skewX: 0,
          skewY: 0,
          scaleX: 1,
          scaleY: 1,
          shadow: null,
          opacity: 1,
          originX: 'center',
          originY: 'center',
          version: '7.2.0',
          visible: true,
          fillRule: 'nonzero',
          fontSize: t.fontSize,
          fontStyle: 'normal',
          fontFamily: family,
          fontWeight: 'bold',
          strokeLineCap: 'butt',
          strokeUniform: false,
          strokeLineJoin: 'miter',
          backgroundColor: '',
          strokeDashArray: null,
          strokeDashOffset: 0,
          strokeMiterLimit: 4,
          globalCompositeOperation: 'source-over',
          data: {
            objectId: `${geo.sideId}-${now}-${Math.random().toString(36).slice(2, 11)}`,
            printMethod: 'embroidery',
            varsitySlot: def.id,
            chenille: slot.chenille,
            // 개인별 학번 자리: 캔버스엔 대표 학번만, 장당 실제 학번은 personalization.rows
            personalized: usesIndividualNumbers(state) && !slot.text.trim() && t.fy === def.fy && (def.role === 'number' || def.id === 'front-right-sleeve'),
            widthMm: mm(widthPx),
            heightMm: mm(heightPx),
            aiDesigner: true,
          },
        };
        if (t.curve !== 0) {
          objects.push({ ...base, type: 'CurvedText', width: widthPx, height: heightPx * 1.6, charSpacing: 50, curveIntensity: t.curve });
          track(cx, ty, widthPx, heightPx * 1.6);
        } else {
          objects.push({
            ...base,
            type: 'IText',
            width: widthPx,
            height: heightPx,
            styles: [],
            overline: false,
            pathSide: 'left',
            direction: 'ltr',
            pathAlign: 'baseline',
            textAlign: 'center',
            underline: false,
            lineHeight: 1.16,
            charSpacing: 0,
            linethrough: false,
            pathStartOffset: 0,
            textBackgroundColor: '',
          });
          track(cx, ty, widthPx, heightPx);
        }
      }
    }

    const bodyHex = layerColors.body ?? Object.values(layerColors)[0] ?? '#ffffff';
    const finalBbox = bbox as { minX: number; minY: number; maxX: number; maxY: number } | null;
    canvasState[geo.sideId] = {
      objects,
      version: '7.2.0',
      layerColors,
      productColor: bodyHex,
      totalBoundingBoxMm:
        finalBbox && geo.nativeMmPerPx > 0
          ? {
              widthMm: Math.round(((finalBbox.maxX - finalBbox.minX) / s.scale) * geo.nativeMmPerPx * 10) / 10,
              heightMm: Math.round(((finalBbox.maxY - finalBbox.minY) / s.scale) * geo.nativeMmPerPx * 10) / 10,
            }
          : null,
      __mmPerPxCalibrationNative: geo.nativeMmPerPx > 0 ? geo.nativeMmPerPx : null,
      __varsityBuilder: true,
    };
  }

  const frontColors = layerColorsBySide.front ?? Object.values(layerColorsBySide)[0] ?? {};
  const bodyHex = frontColors.body ?? '#ffffff';
  const bodyName =
    partLayers.flatMap((p) => p.layers).find((l) => l.id === 'body')?.colorOptions.find((c) => c.hex.toLowerCase() === bodyHex.toLowerCase())?.name ?? '';

  // 미리보기 업로드
  let previewUrl: string | null = null;
  if (previewDataUrl?.startsWith('data:image/')) {
    try {
      const b64 = previewDataUrl.split(',')[1] ?? '';
      const buf = Buffer.from(b64, 'base64');
      if (buf.length > 0 && buf.length <= 4 * 1024 * 1024) {
        const path = `ai-designer/previews/${sessionId}-${Date.now()}.png`;
        const { error } = await admin.storage.from('user-designs').upload(path, buf, { contentType: 'image/png', upsert: true });
        if (!error) previewUrl = admin.storage.from('user-designs').getPublicUrl(path).data.publicUrl;
      }
    } catch { /* 미리보기 실패는 치명 아님 */ }
  }

  const schoolText = state.slots['back-lettering']?.text?.trim() || state.slots['front-left-chest']?.text?.trim() || '';
  const personalization = {
    mode: state.numberMode,
    commonNumber: state.commonNumber,
    rows: state.roster,
    sizeQuantities,
    individualSurcharge: usesIndividualNumbers(state),
    note: state.note,
    quote: { unitPrice: quote.unitPrice, lines: quote.lines, tier: quote.tier.label, leadTimeWeeks: quote.leadTimeWeeks },
  };

  const { data: design, error: designErr } = await admin
    .from('saved_designs')
    .insert({
      user_id: user.id,
      product_id: productId,
      title: `과잠 - ${schoolText || productRow.title}`,
      color_selections: { productColor: bodyHex, layerColors: layerColorsBySide },
      canvas_state: canvasState,
      preview_url: previewUrl,
      image_urls: Array.from(usedImageUrls),
      price_per_item: pricePerItem,
      custom_fonts: [],
      retouch_requested: true,
      personalization,
    })
    .select('id')
    .single();
  if (designErr || !design) {
    console.error('[ai-designer/varsity-order] design insert failed', designErr);
    return NextResponse.json({ error: '디자인 저장에 실패했습니다.' }, { status: 500 });
  }

  const cartRows = Object.entries(sizeQuantities)
    .filter(([, q]) => q > 0)
    .map(([size, qty]) => ({
      user_id: user.id,
      product_id: productId,
      saved_design_id: design.id,
      product_title: productRow.title,
      product_color: bodyHex,
      product_color_name: bodyName,
      product_color_code: null,
      size_id: size,
      size_name: size,
      quantity: qty,
      price_per_item: pricePerItem,
      thumbnail_url: previewUrl,
      personalization,
    }));
  const { data: cartItems, error: cartErr } = await admin.from('cart_items').insert(cartRows).select('id');
  if (cartErr) {
    console.error('[ai-designer/varsity-order] cart insert failed', cartErr);
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
      builder_state: state,
      customer_note: state.note || session.customer_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return NextResponse.json({
    ok: true,
    savedDesignId: design.id,
    cartItemIds: (cartItems ?? []).map((c) => c.id),
    pricePerItem,
    quantity,
    total: pricePerItem * quantity,
    slotCount: active.length,
    slots: VARSITY_SLOTS.filter((d) => active.includes(d)).map((d) => d.id),
  });
}
