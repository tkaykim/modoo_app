import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { inquiryKeyMatches } from '@/lib/inquiry-access';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { inquiryId: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { inquiryId, password } = body;
  if (!inquiryId || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('inquiries')
    .select('password, phone')
    .eq('id', inquiryId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
  }

  // 전화번호 또는 저장된 비밀번호 둘 다 허용
  return NextResponse.json({ match: inquiryKeyMatches(password, data) });
}
