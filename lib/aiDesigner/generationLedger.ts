/**
 * AI 디자이너 — 생성 원장(ai_designer_generations) + 세션·IP 캡. 서버 전용(service role).
 * 원장 한 행 = 생성 라운드 1회(후보 n장). 비용·품질·선택·평가가 여기에 쌓여 파일럿 지표가 된다.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const GENERATIONS_TABLE = 'ai_designer_generations';

export type GenerationKind = 'customer' | 'pilot';
export type GenerationStatus = 'generated' | 'selected' | 'finalized' | 'failed';

export interface CandidateRecord {
  index: number;
  path: string;
  url: string;
  width: number;
  height: number;
  mime: string;
  /** compactQuality (상대 기준, 폭 mm 없음) */
  quality: unknown;
  svgPath?: string | null;
  svgUrl?: string | null;
}

export interface FinalRecord {
  path: string;
  url: string;
  width: number;
  height: number;
  svgPath: string | null;
  svgUrl: string | null;
  removedBackground: boolean;
  vectorized: 'recraft' | 'mock' | null;
  quality: unknown;
}

export interface GenerationInsert {
  kind: GenerationKind;
  session_id: string | null;
  user_id: string | null;
  ip_hash: string | null;
  purpose: string;
  provider: string;
  model: string;
  request_text: string;
  prompt: string;
  negative_prompt: string | null;
  candidate_count: number;
  candidates: CandidateRecord[];
  variation_of: string | null;
  cost_usd: number;
  credits: number | null;
  status: GenerationStatus;
  pilot_run?: string | null;
  pilot_prompt_id?: string | null;
  meta?: Record<string, unknown> | null;
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return req.headers.get('x-real-ip') || null;
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.AI_DESIGNER_IP_SALT || 'modoo-ai-designer';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export async function countRounds(
  admin: SupabaseClient,
  args: { sessionId: string | null; ipHash: string | null }
): Promise<{ session: number; ipDay: number }> {
  let session = 0;
  let ipDay = 0;
  if (args.sessionId) {
    const { count } = await admin
      .from(GENERATIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('session_id', args.sessionId)
      .eq('kind', 'customer')
      .neq('status', 'failed');
    session = count ?? 0;
  }
  if (args.ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from(GENERATIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', args.ipHash)
      .eq('kind', 'customer')
      .gte('created_at', since);
    ipDay = count ?? 0;
  }
  return { session, ipDay };
}

export async function insertGeneration(admin: SupabaseClient, row: GenerationInsert): Promise<string | null> {
  const { data, error } = await admin.from(GENERATIONS_TABLE).insert(row).select('id').single();
  if (error) {
    console.error('[aiDesigner/ledger] insert failed', error);
    return null;
  }
  return data?.id ?? null;
}

export async function updateGeneration(admin: SupabaseClient, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await admin
    .from(GENERATIONS_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[aiDesigner/ledger] update failed', error);
}

export async function getGeneration(admin: SupabaseClient, id: string) {
  const { data } = await admin.from(GENERATIONS_TABLE).select('*').eq('id', id).single();
  return data as (Record<string, unknown> & { id: string; candidates: CandidateRecord[] }) | null;
}
