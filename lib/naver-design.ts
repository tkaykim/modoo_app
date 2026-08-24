import { createAdminClient } from '@/lib/supabase-admin';
import { hashNaverDesignToken, safeFileExtension } from '@/lib/naver-design-token';

export { hashNaverDesignToken, safeFileExtension } from '@/lib/naver-design-token';

export const NAVER_DESIGN_BUCKET = 'naver-design-assets';
export const NAVER_DESIGN_MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function findNaverDesignSession(token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('naver_design_sessions')
    .select('id,naver_order_id,buyer_name,status,job_count,submitted_job_count,expires_at,first_viewed_at,last_viewed_at,submitted_at,created_at,updated_at')
    .eq('token_hash', hashNaverDesignToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

export async function ensureNaverDesignBucket() {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.getBucket(NAVER_DESIGN_BUCKET);
  if (data) return;
  if (error && !/not found/i.test(error.message)) throw error;
  const { error: createError } = await admin.storage.createBucket(NAVER_DESIGN_BUCKET, {
    public: false,
    fileSizeLimit: NAVER_DESIGN_MAX_FILE_BYTES,
    allowedMimeTypes: [
      'image/*',
      'application/postscript',
      'application/octet-stream',
      'application/vnd.adobe.photoshop',
      'image/vnd.adobe.photoshop',
    ],
  });
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}
