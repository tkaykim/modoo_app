import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendDiscordNotification } from '@/lib/notifications/discord';
import { sendEmailNotification } from '@/lib/notifications/mailjet';
import { sendCustomerInquiryConfirmation } from '@/lib/notifications/customerInquiry';

interface InquiryRequestBody {
  clothingType: string;
  quantity?: string | null;
  quantityExact?: number | null;
  priorities: string[];
  designType?: string | null;
  colorCount?: string | null;
  printLocations?: string[] | null;
  designSizes?: Record<string, number> | null;
  printMethod?: string | null;
  recommendedPrintMethod?: string | null;
  estimatedPriceMin?: number | null;
  estimatedPriceMax?: number | null;
  recommendedProductIds?: string[] | null;
  neededDate: string | null;
  neededDateFlexible: boolean;
  contactName: string;
  contactEmail?: string;
  contactPhone: string;
  fileUrls?: string[] | null;
  consultRequested?: boolean;
  userId?: string | null;
}

// 챗봇 상담 내용을 정식 문의(inquiries) content로 요약
function buildInquirySummary(b: InquiryRequestBody, quantityNum: number): string {
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const sizes = b.designSizes;
  const sizeStr = sizes
    ? [
        sizes['10x10'] > 0 ? `작은 ${sizes['10x10']}개` : '',
        sizes.A4 > 0 ? `중간 ${sizes.A4}개` : '',
        sizes.A3 > 0 ? `큰 ${sizes.A3}개` : '',
      ].filter(Boolean).join(' · ') || '미입력'
    : '미입력';
  const est = b.estimatedPriceMin != null
    ? (b.estimatedPriceMax != null && b.estimatedPriceMax !== b.estimatedPriceMin
        ? `장당 약 ${won(b.estimatedPriceMin)}~${won(b.estimatedPriceMax)}`
        : `장당 약 ${won(b.estimatedPriceMin)}`)
    : '담당자 안내';
  const date = b.neededDateFlexible ? '상관없음 (제작일정에 따름)' : (b.neededDate || '미지정');
  return [
    '챗봇 상담을 통해 접수된 문의입니다.',
    '',
    `· 의류: ${b.clothingType}`,
    `· 수량: ${quantityNum}벌`,
    `· 디자인: ${b.designType || '미입력'}`,
    `· 색상: ${b.colorCount || '미입력'}`,
    `· 인쇄 크기/개수: ${sizeStr}`,
    `· 선택 인쇄방식: ${b.printMethod || '미정'}`,
    `· 추천 인쇄방식: ${b.recommendedPrintMethod || '미정'}`,
    `· 예상 인쇄비: ${est}`,
    `· 필요 날짜: ${date}`,
  ].join('\n');
}

// Parse quantity string to number (returns approximate middle value of range)
function parseQuantity(quantityStr: string): number {
  if (quantityStr === '1~20벌') {
    return 10;
  }
  if (quantityStr === '21~50벌') {
    return 35;
  }
  if (quantityStr === '50~100벌') {
    return 75;
  }
  if (quantityStr === '100벌 이상') {
    return 100;
  }
  // Fallback: try to extract first number
  const match = quantityStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 10; // Default
}

export async function POST(request: NextRequest) {
  try {
    const body: InquiryRequestBody = await request.json();

    // Validate required fields (수량은 직접입력 quantityExact 또는 구간 quantity 중 하나)
    if (!body.clothingType || (!body.quantity && !body.quantityExact) || !body.priorities || body.priorities.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const quantityNum = body.quantityExact && body.quantityExact > 0
      ? Math.round(body.quantityExact)
      : parseQuantity(body.quantity ?? '');

    if (!body.contactName || !body.contactPhone) {
      return NextResponse.json(
        { error: 'Contact information is required' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for insert
    const supabase = createAdminClient();

    // 첨부 파일(시안/로고) — 클라이언트가 inquiry-files 버킷에 업로드한 공개 URL
    const fileUrls = Array.isArray(body.fileUrls)
      ? body.fileUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
      : [];

    // Insert inquiry into database
    const { data: inquiry, error } = await supabase
      .from('chatbot_inquiries')
      .insert({
        clothing_type: body.clothingType,
        quantity: quantityNum,
        priorities: body.priorities,
        design_type: body.designType ?? null,
        color_count: body.colorCount ?? null,
        print_locations: body.designSizes ?? body.printLocations ?? null,
        print_method: body.printMethod ?? null,
        recommended_print_method: body.recommendedPrintMethod ?? null,
        estimated_price_min: body.estimatedPriceMin ?? null,
        estimated_price_max: body.estimatedPriceMax ?? null,
        recommended_product_ids: body.recommendedProductIds ?? null,
        needed_date: body.neededDateFlexible ? null : body.neededDate,
        needed_date_flexible: body.neededDateFlexible,
        contact_name: body.contactName,
        contact_email: body.contactEmail || null,
        contact_phone: body.contactPhone,
        file_urls: fileUrls,
        admin_notes: body.consultRequested ? '[상담원 연결 요청]' : null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting inquiry:', error);
      return NextResponse.json(
        { error: 'Failed to save inquiry' },
        { status: 500 }
      );
    }

    // Send notifications (don't fail the request if notifications fail)
    const notificationData = {
      id: inquiry.id,
      clothing_type: inquiry.clothing_type,
      quantity: inquiry.quantity,
      priorities: inquiry.priorities,
      needed_date: inquiry.needed_date,
      needed_date_flexible: inquiry.needed_date_flexible,
      contact_name: inquiry.contact_name,
      contact_email: inquiry.contact_email,
      contact_phone: inquiry.contact_phone,
      created_at: inquiry.created_at,
      // rich 데이터 (리드 품질 판단용)
      design_type: inquiry.design_type,
      color_count: inquiry.color_count,
      print_sizes: inquiry.print_locations as Record<string, number> | null,
      print_method: inquiry.print_method,
      recommended_print_method: inquiry.recommended_print_method,
      estimated_price_min: inquiry.estimated_price_min,
      estimated_price_max: inquiry.estimated_price_max,
      consult_requested: body.consultRequested ?? false,
    };

    // Send admin notifications in parallel
    await Promise.allSettled([
      sendDiscordNotification(notificationData),
      sendEmailNotification(notificationData)
    ]);

    // 상담 연락 요청 시: 정식 문의(inquiries)로도 등록 → 답변 스레드/내문의/게시판 + 고객 확인메일
    let formalInquiryId: string | null = null;
    if (body.consultRequested) {
      try {
        const phoneDigits = (body.contactPhone || '').replace(/[^0-9]/g, '');
        const { data: formal, error: formalErr } = await supabase
          .from('inquiries')
          .insert({
            user_id: body.userId || null,
            title: `[챗봇 상담] ${body.clothingType} ${quantityNum}벌`,
            content: buildInquirySummary(body, quantityNum),
            status: 'pending',
            manager_name: body.contactName,
            phone: body.contactPhone,
            email: body.contactEmail || null,
            expected_qty: quantityNum,
            desired_date: body.neededDateFlexible ? null : (body.neededDate || null),
            password: phoneDigits || null, // 비로그인 고객은 전화번호로 열람
            file_urls: fileUrls,
            is_admin: false,
          })
          .select('id')
          .single();

        if (formalErr) {
          console.error('Error creating formal inquiry:', formalErr);
        } else if (formal) {
          formalInquiryId = formal.id;
          // 챗봇문의 ↔ 게시판문의 연결 (관리자 중복 인지 방지)
          await supabase
            .from('chatbot_inquiries')
            .update({ linked_inquiry_id: formal.id })
            .eq('id', inquiry.id);
          // 추천 상품 연결
          if (body.recommendedProductIds && body.recommendedProductIds.length > 0) {
            await supabase.from('inquiry_products').insert(
              body.recommendedProductIds.map((pid) => ({ inquiry_id: formal.id, product_id: pid })),
            );
          }
          // 고객 확인 메일
          if (body.contactEmail) {
            await sendCustomerInquiryConfirmation({
              contactName: body.contactName,
              contactEmail: body.contactEmail,
              contactPhone: body.contactPhone,
              clothingType: body.clothingType,
              quantity: quantityNum,
              designType: body.designType,
              colorCount: body.colorCount,
              printMethod: body.printMethod,
              recommendedPrintMethod: body.recommendedPrintMethod,
              estimatedPriceMin: body.estimatedPriceMin,
              estimatedPriceMax: body.estimatedPriceMax,
              createdAt: inquiry.created_at,
              formalInquiryId: formal.id,
            }).catch((e) => console.error('Customer email failed:', e));
          }
        }
      } catch (e) {
        console.error('Formal inquiry creation threw:', e);
      }
    }

    return NextResponse.json({
      success: true,
      inquiry: {
        id: inquiry.id,
        created_at: inquiry.created_at
      },
      formalInquiryId,
    });

  } catch (error) {
    console.error('Error processing inquiry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
