const LEGACY_SHARE_TOKEN = /^[a-f0-9]{32}$/i;
const UUID_SHARE_TOKEN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function isPartnerMallCapabilityToken(value: string): boolean {
  return LEGACY_SHARE_TOKEN.test(value) || UUID_SHARE_TOKEN.test(value);
}

export function isPartnerMallPreviewRequest(request: Request): boolean {
  return new URL(request.url).searchParams.get('preview') === '1';
}
