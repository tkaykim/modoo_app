import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyOrganizerAccessToken } from '@/lib/cobuy-organizer-token';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }

    const verified = verifyOrganizerAccessToken(token);
    if (!verified) {
      return NextResponse.json({ error: '유효하지 않거나 만료된 링크입니다.' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from('cobuy_sessions')
      .select(
        `
        *,
        saved_design_screenshot:saved_design_screenshots (
          id,
          user_id,
          product_id,
          title,
          color_selections,
          canvas_state,
          preview_url,
          created_at,
          updated_at,
          price_per_item,
          image_urls,
          text_svg_exports,
          custom_fonts
        )
      `
      )
      .eq('id', verified.sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: participants, error: partError } = await admin
      .from('cobuy_participants')
      .select('*')
      .eq('cobuy_session_id', verified.sessionId)
      .order('joined_at', { ascending: false });

    if (partError) {
      return NextResponse.json({ error: partError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        session,
        participants: participants || [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '불러오기에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
