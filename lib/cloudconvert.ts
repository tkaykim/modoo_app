/**
 * Client-side CloudConvert utility for converting AI/PSD files to PNG.
 *
 * Flow (browser uploads directly to CloudConvert; server only brokers job + status):
 *   1. POST /api/convert-image/create-job  -> { jobId, uploadForm }
 *   2. POST uploadForm.url with file       (browser -> CloudConvert, no Vercel body limit)
 *   3. Poll GET /api/convert-image/status?jobId=...  until finished
 *   4. Fetch the resulting PNG URL and return as Blob
 */

export interface ConversionResult {
  success: boolean;
  pngBlob?: Blob;
  error?: string;
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function safeParseJson(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return { error: `Invalid JSON response (status ${res.status})` };
    }
  }
  const text = await res.text().catch(() => '');
  return { error: text ? `${res.status}: ${text.slice(0, 200)}` : `HTTP ${res.status}` };
}

async function pollUntilFinished(jobId: string, timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`/api/convert-image/status?jobId=${encodeURIComponent(jobId)}`);
    const data = await safeParseJson(res);
    if (!res.ok) throw new Error(data.error || 'Status check failed');
    if (data.status === 'finished' && data.pngUrl) return data.pngUrl as string;
    if (data.status === 'error') throw new Error(data.error || 'Conversion failed');
  }
  return null;
}

export async function convertToPNG(file: File): Promise<ConversionResult> {
  try {
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return { success: false, error: `파일이 너무 큽니다 (현재 ${mb}MB / 최대 50MB)` };
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['ai', 'psd'].includes(ext)) {
      return { success: false, error: 'AI 또는 PSD 파일만 지원합니다.' };
    }

    const createRes = await fetch('/api/convert-image/create-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ext }),
    });
    const createData = await safeParseJson(createRes);
    if (!createRes.ok || !createData.success) {
      return { success: false, error: createData.error || 'job creation failed' };
    }

    const { jobId, uploadForm } = createData as {
      jobId: string;
      uploadForm: { url: string; parameters: Record<string, string> };
    };

    const uploadFD = new FormData();
    Object.entries(uploadForm.parameters).forEach(([k, v]) => uploadFD.append(k, v));
    uploadFD.append('file', file, file.name);

    const upRes = await fetch(uploadForm.url, { method: 'POST', body: uploadFD });
    if (!upRes.ok) {
      return { success: false, error: `Upload failed: ${upRes.status} ${upRes.statusText}` };
    }

    const pngUrl = await pollUntilFinished(jobId, POLL_TIMEOUT_MS);
    if (!pngUrl) return { success: false, error: '변환 시간 초과' };

    const pngRes = await fetch(pngUrl);
    if (!pngRes.ok) {
      return { success: false, error: `Failed to download converted PNG: ${pngRes.statusText}` };
    }
    const pngBlob = await pngRes.blob();
    return { success: true, pngBlob };
  } catch (error) {
    console.error('CloudConvert conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown conversion error',
    };
  }
}

export function isAiOrPsdFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'ai' || extension === 'psd';
}

export function getConversionErrorMessage(error?: string): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  if (error.includes('API key')) {
    return 'CloudConvert API 키가 설정되지 않았습니다.';
  }
  if (error.includes('Upload failed') || error.includes('업로드')) {
    return '파일 업로드에 실패했습니다. 다시 시도해주세요.';
  }
  if (error.includes('Export task failed') || error.includes('Export URL')) {
    return '파일 변환에 실패했습니다. 파일이 손상되었을 수 있습니다.';
  }
  if (error.includes('job creation failed') || error.includes('Unprocessable')) {
    return '파일 변환이 지원되지 않습니다. AI 파일의 경우 PDF나 SVG로 먼저 변환해주세요.';
  }
  if (error.includes('시간 초과') || error.includes('timeout')) {
    return '변환이 너무 오래 걸립니다. 더 작은 파일로 다시 시도해주세요.';
  }
  if (error.includes('너무 큽니다') || error.includes('exceeded the maximum')) {
    if (error.includes('exceeded the maximum')) {
      return '파일이 너무 큽니다 (최대 50MB). 더 작은 파일로 다시 시도해주세요.';
    }
    return error;
  }

  return `파일 변환 중 오류가 발생했습니다: ${error}`;
}
