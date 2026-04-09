import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const shareToken = request.nextUrl.searchParams.get('shareToken');
    if (!shareToken) {
      return NextResponse.json({ error: 'shareToken이 필요합니다.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from('cobuy_sessions')
      .select(
        `
        *,
        saved_design_screenshot:saved_design_screenshots (
          id, user_id, product_id, title,
          color_selections, canvas_state, preview_url,
          created_at, updated_at, price_per_item,
          image_urls, text_svg_exports, custom_fonts
        )
      `
      )
      .eq('share_token', shareToken)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: participants, error: partError } = await admin
      .from('cobuy_participants')
      .select('*')
      .eq('cobuy_session_id', session.id)
      .order('joined_at', { ascending: false });

    if (partError) {
      return NextResponse.json({ error: partError.message }, { status: 500 });
    }

    return NextResponse.json({ data: { session, participants: participants || [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '불러오기에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
