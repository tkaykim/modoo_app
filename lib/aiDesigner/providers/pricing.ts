/**
 * 이미지 모델 단가표 (USD / 장). 2026-09 웹 조사 기준 — 원장 비용 추정과 파일럿 리포트에만 쓴다.
 * 실제 과금 정본은 각 제공자 대시보드. 단가가 바뀌면 여기만 고친다.
 */
export const IMAGE_MODEL_PRICES_USD: Record<string, number> = {
  // Google Gemini (Nano Banana 계열)
  'gemini-3-pro-image': 0.134,
  'gemini-3-pro-image-preview': 0.134,
  'gemini-3.1-flash-image': 0.067,
  'gemini-3.1-flash-image-preview': 0.067,
  'gemini-2.5-flash-image': 0.039,
  'gemini-2.5-flash-image-preview': 0.039,
  'gemini-3.1-flash-lite-image': 0.0336,
  // OpenAI (1024×1024 medium 기준 추정치)
  'gpt-image-2': 0.053,
  'gpt-image-1.5': 0.034,
  'gpt-image-1': 0.042,
  'gpt-image-1-mini': 0.011,
  // Recraft
  recraftv4_1: 0.035,
  recraftv4_1_vector: 0.08,
  recraftv4_1_pro: 0.21,
  recraftv4_1_pro_vector: 0.3,
  recraftv4: 0.04,
  recraftv4_vector: 0.08,
  recraftv3: 0.04,
  recraftv3_vector: 0.08,
  // Ideogram (rendering_speed별)
  'ideogram-v4-turbo': 0.03,
  'ideogram-v4-default': 0.06,
  'ideogram-v4-quality': 0.1,
  'ideogram-v3-turbo': 0.03,
  'ideogram-v3-default': 0.06,
  'ideogram-v3-quality': 0.09,
  // 후처리
  'recraft-vectorize': 0.02, // 미확인 추정 — 응답 credits로 보정
  'vectorizer-ai': 0.2, // $9.99/50 credits 기준
  mock: 0,
};

export function priceOf(model: string): number {
  return IMAGE_MODEL_PRICES_USD[model] ?? 0;
}

export function usdToKrw(usd: number, rate = 1380): number {
  return Math.round(usd * rate);
}
