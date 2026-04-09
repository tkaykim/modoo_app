import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { participantId, sessionId, ...updates } = body;

    if (!participantId || !sessionId) {
      return NextResponse.json({ error: '참여자 ID와 세션 ID가 필요합니다.' }, { status: 400 });
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
      return NextResponse.json({ error: '세션 소유자만 참여자를 수정할 수 있습니다.' }, { status: 403 });
    }

    const allowedFields: Record<string, string> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      selectedItems: 'selected_items',
      totalQuantity: 'total_quantity',
      selectedSize: 'selected_size',
      fieldResponses: 'field_responses',
      deliveryMethod: 'delivery_method',
      deliveryInfo: 'delivery_info',
      deliveryFee: 'delivery_fee',
      pickupStatus: 'pickup_status',
    };

    const updateData: Record<string, unknown> = {};
    for (const [key, dbField] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        updateData[dbField] = updates[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 필드가 없습니다.' }, { status: 400 });
    }

    const { data: participant, error: updateError } = await adminClient
      .from('cobuy_participants')
      .update(updateData)
      .eq('id', participantId)
      .eq('cobuy_session_id', sessionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: participant });
  } catch (error) {
    const message = error instanceof Error ? error.message : '참여자 수정에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
