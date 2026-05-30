import { NextResponse } from 'next/server';
import { createClient as createAuthedClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function pickExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'jpg';
  return 'bin';
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/postscript',                          // .ai
  'application/illustrator',                         // .ai alt
  'application/vnd.adobe.illustrator',               // .ai alt
];

const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB/파일 — 여유롭게

export async function POST(req: Request) {
  const supabase = await createAuthedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const uploaderFolder = user?.id ?? 'guest';

  const formData = await req.formData();
  const files = formData.getAll('files').filter((v): v is File => v instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
  }

  for (const file of files) {
    const isAllowed =
      ALLOWED_TYPES.includes(file.type) ||
      file.name.toLowerCase().endsWith('.ai');
    if (!isAllowed) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.name}` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다(최대 50MB): ${file.name}` },
        { status: 400 },
      );
    }
  }

  const admin = createAdminClient();
  const uploaded: Array<{ url: string; path: string; name: string }> = [];

  for (const file of files) {
    const extension = pickExtension(file);
    const path = `${uploaderFolder}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('inquiry-files')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from('inquiry-files').getPublicUrl(path);

    uploaded.push({ url: publicUrl, path, name: file.name });
  }

  return NextResponse.json({ files: uploaded });
}
