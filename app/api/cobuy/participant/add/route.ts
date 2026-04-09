import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      name,
      email,
      phone,
      selectedItems,
      fieldResponses,
      deliveryMethod,
      deliveryInfo,
      deliveryFee,
    } = body;

    if (!sessionId || !name || !email || !selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const adminClient = createAdminClient();

    const { data: session, error: sessionError } = await adminClient
      .from('cobuy_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const ownerOk = !authError && user && session.user_id === user.id;

    if (!ownerOk) {
      if (authError || !user) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
      }
      return NextResponse.json({ error: '세션 소유자만 참여자를 추가할 수 있습니다.' }, { status: 403 });
    }

    const totalQuantity = selectedItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
    const selectedSize = selectedItems.map((i: { size: string; quantity: number }) => `${i.size}(${i.quantity})`).join(', ');

    const { data: participant, error: insertError } = await adminClient
      .from('cobuy_participants')
      .insert({
        cobuy_session_id: sessionId,
        name,
        email,
        phone: phone || null,
        selected_size: selectedSize,
        selected_size_code: null,
        selected_items: selectedItems,
        total_quantity: totalQuantity,
        field_responses: fieldResponses || {},
        delivery_method: deliveryMethod || null,
        delivery_info: deliveryInfo || null,
        delivery_fee: deliveryFee || 0,
        pickup_status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: participant });
  } catch (error) {
    const message = error instanceof Error ? error.message : '참여자 추가에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
