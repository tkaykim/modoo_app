import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

type Body = {
  event_type?: string;
  path?: string;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  device?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.event_type || typeof body.event_type !== 'string') {
    return NextResponse.json({ ok: false, error: 'event_type_required' }, { status: 400 });
  }

  const country =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    null;

  const userAgent = body.user_agent || req.headers.get('user-agent') || null;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('analytics_events').insert({
      event_type: body.event_type.slice(0, 64),
      path: body.path?.slice(0, 2048) ?? null,
      referrer: body.referrer?.slice(0, 2048) ?? null,
      utm_source: body.utm_source?.slice(0, 256) ?? null,
      utm_medium: body.utm_medium?.slice(0, 256) ?? null,
      utm_campaign: body.utm_campaign?.slice(0, 256) ?? null,
      country,
      device: body.device?.slice(0, 32) ?? null,
      user_agent: userAgent?.slice(0, 1024) ?? null,
      session_id: body.session_id?.slice(0, 128) ?? null,
      meta: body.meta ?? {},
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
