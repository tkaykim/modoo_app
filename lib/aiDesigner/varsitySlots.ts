/**
 * 과잠(바시티 자켓) 빌더 — 정석 슬롯·색상 프리셋·명단 도우미 (클라이언트·서버 공용, 런타임 의존성 없음).
 *
 * 슬롯 좌표(fx, fy)는 목업 이미지 기준 상대값(0~1)이며, 공동구매 '과잠' 프리셋에 실제로 배치돼 있던
 * 위치(앞면 가슴 이니셜·소매 학번·소매 엠블럼, 등판 아치 문구·엠블럼)에서 가져왔다.
 * 400×500 에디터 캔버스 = 목업 이미지 크기(400×500)라 캔버스 좌표와 이미지 좌표가 같다.
 */

import type { PartLayerSide } from './catalogTypes';
import type { VarsitySurchargeKey } from './varsityPricing';

export type VarsitySideId = 'front' | 'back';
export type VarsitySlotId =
  | 'front-left-chest'
  | 'front-right-chest'
  | 'front-right-sleeve'
  | 'front-left-sleeve'
  | 'back-lettering'
  | 'back-emblem';

export type VarsitySlotRole = 'logo' | 'number' | 'sleeve' | 'lettering' | 'emblem';

export interface VarsitySlotDef {
  id: VarsitySlotId;
  sideId: VarsitySideId;
  label: string;
  hint: string;
  role: VarsitySlotRole;
  /** 텍스트·이미지 중 무엇을 넣을 수 있는지 */
  allow: Array<'text' | 'image'>;
  fx: number;
  fy: number;
  /** 두 번째 줄(등판 부제) 위치 */
  fy2?: number;
  defaultFontSize: number;
  curveIntensity?: number;
  /** 이미지 최대 폭(이미지 폭 대비 비율) */
  maxWidthFrac: number;
  defaultOn: boolean;
  /** 추가금이 붙는 슬롯 */
  surchargeKey?: VarsitySurchargeKey;
  placeholder: string;
  placeholder2?: string;
}

export const VARSITY_SLOTS: VarsitySlotDef[] = [
  {
    id: 'front-left-chest',
    sideId: 'front',
    label: '왼쪽 가슴 로고·이니셜',
    hint: '기본 포함 · 학교 이니셜이나 로고',
    role: 'logo',
    allow: ['text', 'image'],
    fx: 0.6475,
    fy: 0.336,
    defaultFontSize: 40,
    maxWidthFrac: 0.2,
    defaultOn: true,
    placeholder: '예) M',
  },
  {
    id: 'front-right-chest',
    sideId: 'front',
    label: '오른쪽 가슴 학번·문구',
    hint: '기본 포함 · 학번(공통) 또는 짧은 문구',
    role: 'number',
    allow: ['text'],
    fx: 0.3525,
    fy: 0.336,
    defaultFontSize: 34,
    maxWidthFrac: 0.2,
    defaultOn: false,
    placeholder: '예) 26',
  },
  {
    id: 'front-right-sleeve',
    sideId: 'front',
    label: '오른쪽 소매 학번·이니셜',
    hint: '기본 포함 · 학번 1종 또는 이니셜',
    role: 'sleeve',
    allow: ['text'],
    fx: 0.14,
    fy: 0.342,
    defaultFontSize: 30,
    maxWidthFrac: 0.14,
    defaultOn: false,
    placeholder: '예) 26',
  },
  {
    id: 'front-left-sleeve',
    sideId: 'front',
    label: '왼쪽 소매 엠블럼·이니셜',
    hint: '기본 포함 · 작은 엠블럼 또는 이니셜',
    role: 'sleeve',
    allow: ['text', 'image'],
    fx: 0.8775,
    fy: 0.352,
    defaultFontSize: 30,
    maxWidthFrac: 0.14,
    defaultOn: false,
    placeholder: '예) M',
  },
  {
    id: 'back-lettering',
    sideId: 'back',
    label: '등판 학교·학과명 (아치형)',
    hint: '대형 레터링 · 장당 추가금',
    role: 'lettering',
    allow: ['text'],
    fx: 0.5075,
    fy: 0.286,
    fy2: 0.362,
    defaultFontSize: 40,
    curveIntensity: -18,
    maxWidthFrac: 0.7,
    defaultOn: true,
    surchargeKey: 'backLettering',
    placeholder: '예) MODOO',
    placeholder2: '예) UNIV. / 디자인학과',
  },
  {
    id: 'back-emblem',
    sideId: 'back',
    label: '등판 엠블럼·그래픽',
    hint: '대형 엠블럼 · 장당 추가금',
    role: 'emblem',
    allow: ['image', 'text'],
    fx: 0.5075,
    fy: 0.526,
    defaultFontSize: 36,
    maxWidthFrac: 0.45,
    defaultOn: false,
    surchargeKey: 'backEmblem',
    placeholder: '예) 2026',
  },
];

export const VARSITY_FONTS: Array<{ family: string; label: string; korean: boolean }> = [
  { family: 'Freshman', label: '바시티체 (영문·숫자)', korean: false },
  { family: 'Pretendard', label: '프리텐다드 (한글 가능)', korean: true },
];

/** 자수실 색 팔레트 (부위 색과 잘 어울리는 기본 6색) */
export const VARSITY_THREAD_COLORS: Array<{ name: string; hex: string }> = [
  { name: '화이트', hex: '#ffffff' },
  { name: '블랙', hex: '#000000' },
  { name: '네이비', hex: '#19375e' },
  { name: '골드', hex: '#d4a72c' },
  { name: '레드', hex: '#c62828' },
  { name: '그린', hex: '#086329' },
];

export interface VarsityColorPreset {
  id: string;
  name: string;
  /** 레이어 id → hex (front·back 공통, 없는 레이어는 무시) */
  colors: Record<string, string>;
}

export const VARSITY_COLOR_PRESETS: VarsityColorPreset[] = [
  { id: 'navy-white', name: '네이비 × 화이트', colors: { body: '#19375e', arms: '#ffffff', chivory: '#ffffff', buttons: '#ffffff' } },
  { id: 'black-white', name: '블랙 × 화이트', colors: { body: '#000000', arms: '#ffffff', chivory: '#ffffff', buttons: '#ffffff' } },
  { id: 'green-white', name: '그린 × 화이트', colors: { body: '#086329', arms: '#ffffff', chivory: '#ffffff', buttons: '#ffffff' } },
  { id: 'burgundy-white', name: '버건디 × 화이트', colors: { body: '#8c2a35', arms: '#ffffff', chivory: '#ffffff', buttons: '#ffffff' } },
  { id: 'white-navy', name: '화이트 × 네이비', colors: { body: '#ffffff', arms: '#19375e', chivory: '#19375e', buttons: '#ffffff' } },
  { id: 'all-black', name: '올 블랙', colors: { body: '#000000', arms: '#000000', chivory: '#ffffff', buttons: '#ffffff' } },
];

export interface VarsitySlotImage {
  url: string;
  path: string;
  name: string;
  width: number;
  height: number;
}

export interface VarsitySlotState {
  enabled: boolean;
  mode: 'text' | 'image';
  text: string;
  /** 등판 부제 줄 */
  text2: string;
  fontFamily: string;
  fill: string;
  /** 외곽선 색('' = 없음) */
  stroke: string;
  /** 0.8 / 1 / 1.25 크기 배율 */
  scale: number;
  chenille: boolean;
  image: VarsitySlotImage | null;
}

export interface RosterRow {
  name: string;
  number: string;
  size: string;
}

export type NumberMode = 'none' | 'common' | 'individual';

export interface VarsityBuilderState {
  version: 1;
  presetId: string | null;
  partColors: Record<string, string>;
  slots: Record<VarsitySlotId, VarsitySlotState>;
  numberMode: NumberMode;
  commonNumber: string;
  roster: RosterRow[];
  /** 명단 없이 사이즈별 수량만 입력할 때 */
  sizeQuantities: Record<string, number>;
  note: string;
}

export function defaultSlotState(def: VarsitySlotDef): VarsitySlotState {
  return {
    enabled: def.defaultOn,
    mode: def.allow[0],
    text: '',
    text2: '',
    fontFamily: 'Freshman',
    fill: '#ffffff',
    stroke: '',
    scale: 1,
    chenille: false,
    image: null,
  };
}

/** 부위 색 초기값: 과잠 프리셋 layer_colors → 첫 색상 프리셋 → 레이어 첫 옵션 */
export function defaultPartColors(
  partLayers: PartLayerSide[],
  presetLayerColors: Record<string, Record<string, string>> | null
): Record<string, string> {
  const out: Record<string, string> = {};
  const layerIds = new Set<string>();
  for (const side of partLayers) for (const l of side.layers) layerIds.add(l.id);
  const primary = [...partLayers].sort((a, b) => b.layers.length - a.layers.length)[0];
  for (const id of layerIds) {
    const opt = primary?.layers.find((l) => l.id === id) ?? partLayers.flatMap((s) => s.layers).find((l) => l.id === id);
    const options = opt?.colorOptions ?? [];
    const fromPreset = presetLayerColors ? Object.values(presetLayerColors).map((m) => m?.[id]).find(Boolean) : undefined;
    const fromCombo = VARSITY_COLOR_PRESETS[0].colors[id];
    const candidate = [fromPreset, fromCombo].find(
      (hex) => hex && options.some((c) => c.hex.toLowerCase() === hex.toLowerCase())
    );
    out[id] = candidate ?? options[0]?.hex ?? '#ffffff';
  }
  return out;
}

export function defaultBuilderState(
  partLayers: PartLayerSide[],
  presetLayerColors: Record<string, Record<string, string>> | null
): VarsityBuilderState {
  const slots = {} as Record<VarsitySlotId, VarsitySlotState>;
  for (const def of VARSITY_SLOTS) slots[def.id] = defaultSlotState(def);
  return {
    version: 1,
    presetId: VARSITY_COLOR_PRESETS[0].id,
    partColors: defaultPartColors(partLayers, presetLayerColors),
    slots,
    numberMode: 'none',
    commonNumber: '',
    roster: [],
    sizeQuantities: {},
    note: '',
  };
}

/** 저장된 상태를 현재 슬롯 정의에 맞춰 보정한다(누락 슬롯 채움, 모르는 키 무시). */
export function normalizeBuilderState(
  raw: unknown,
  partLayers: PartLayerSide[],
  presetLayerColors: Record<string, Record<string, string>> | null
): VarsityBuilderState {
  const base = defaultBuilderState(partLayers, presetLayerColors);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<VarsityBuilderState>;
  const slots = { ...base.slots };
  if (r.slots && typeof r.slots === 'object') {
    for (const def of VARSITY_SLOTS) {
      const s = (r.slots as Record<string, Partial<VarsitySlotState> | undefined>)[def.id];
      if (s) slots[def.id] = { ...base.slots[def.id], ...s, image: s.image ?? null };
    }
  }
  return {
    version: 1,
    presetId: typeof r.presetId === 'string' || r.presetId === null ? r.presetId ?? null : base.presetId,
    partColors: { ...base.partColors, ...(r.partColors && typeof r.partColors === 'object' ? r.partColors : {}) },
    slots,
    numberMode: r.numberMode === 'common' || r.numberMode === 'individual' ? r.numberMode : 'none',
    commonNumber: typeof r.commonNumber === 'string' ? r.commonNumber.slice(0, 12) : '',
    roster: Array.isArray(r.roster)
      ? r.roster
          .map((row) => ({
            name: typeof row?.name === 'string' ? row.name.slice(0, 30) : '',
            number: typeof row?.number === 'string' ? row.number.slice(0, 12) : '',
            size: typeof row?.size === 'string' ? row.size.slice(0, 12) : '',
          }))
          .slice(0, 500)
      : [],
    sizeQuantities:
      r.sizeQuantities && typeof r.sizeQuantities === 'object'
        ? Object.fromEntries(
            Object.entries(r.sizeQuantities).filter(([, v]) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10000)
          ) as Record<string, number>
        : {},
    note: typeof r.note === 'string' ? r.note.slice(0, 2000) : '',
  };
}

/** "홍길동 24 M" / "김민지, 25, L" 같은 줄을 명단 행으로 파싱 */
export function parseRoster(text: string, sizeLabels: string[]): RosterRow[] {
  const sizes = sizeLabels.map((s) => s.trim()).filter(Boolean);
  const sizeIndex = new Map(sizes.map((s) => [s.toLowerCase(), s]));
  const rows: RosterRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line
      .split(/[\s,\t/|]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) continue;
    let size = '';
    let number = '';
    const rest: string[] = [];
    for (const tok of tokens) {
      const low = tok.toLowerCase();
      if (!size && sizeIndex.has(low)) {
        size = sizeIndex.get(low)!;
      } else if (!number && /^\d{2,4}$/.test(tok)) {
        number = tok;
      } else {
        rest.push(tok);
      }
    }
    rows.push({ name: rest.join(' ').slice(0, 30), number, size });
  }
  return rows;
}

export function aggregateSizes(rows: RosterRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (!r.size) continue;
    out[r.size] = (out[r.size] || 0) + 1;
  }
  return out;
}

export function totalQuantity(state: VarsityBuilderState): number {
  if (state.roster.length > 0) return state.roster.length;
  return Object.values(state.sizeQuantities).reduce((s, q) => s + (q || 0), 0);
}

export function effectiveSizeQuantities(state: VarsityBuilderState): Record<string, number> {
  return state.roster.length > 0 ? aggregateSizes(state.roster) : { ...state.sizeQuantities };
}

/** 개인별 다른 학번이 실제로 쓰이는지 (장당 가산 기준) */
export function usesIndividualNumbers(state: VarsityBuilderState): boolean {
  if (state.numberMode !== 'individual') return false;
  const distinct = new Set(state.roster.map((r) => r.number.trim()).filter(Boolean));
  return distinct.size >= 2;
}

/** 학번 자리(오른쪽 가슴·오른쪽 소매)인지 */
export function isNumberSlot(def: VarsitySlotDef): boolean {
  return def.role === 'number' || def.id === 'front-right-sleeve';
}

/**
 * 슬롯에 실제로 들어갈 글자. 학번 자리를 비워 두면 학번 모드에 따라 공통 학번을,
 * 개인별 모드에서는 명단의 첫 학번(없으면 '00')을 대표로 넣는다(장당 실제 학번은 personalization 명단).
 */
export function slotText(def: VarsitySlotDef, slot: VarsitySlotState, state: VarsityBuilderState): string {
  const own = slot.text.trim();
  if (own || !isNumberSlot(def) || state.numberMode === 'none') return own;
  if (state.numberMode === 'common') return state.commonNumber.trim();
  return state.roster.find((r) => r.number.trim())?.number.trim() || '00';
}

export function enabledSlots(state: VarsityBuilderState): VarsitySlotDef[] {
  return VARSITY_SLOTS.filter((def) => {
    const s = state.slots[def.id];
    if (!s?.enabled) return false;
    if (s.mode === 'image') return !!s.image;
    return slotText(def, s, state).length > 0 || (def.fy2 !== undefined && s.text2.trim().length > 0);
  });
}

export function surchargeKeysOf(state: VarsityBuilderState): VarsitySurchargeKey[] {
  return enabledSlots(state)
    .map((d) => d.surchargeKey)
    .filter((k): k is VarsitySurchargeKey => !!k);
}

export function chenilleCountOf(state: VarsityBuilderState): number {
  return enabledSlots(state).filter((d) => state.slots[d.id].mode === 'text' && state.slots[d.id].chenille).length;
}

export function hasKorean(text: string): boolean {
  return /[ㄱ-ㆎ가-힣]/.test(text);
}

/** 한글이 섞이면 한글 지원 서체로 강제 */
export function effectiveFont(fontFamily: string, ...texts: string[]): string {
  if (texts.some((t) => hasKorean(t))) return 'Pretendard';
  return fontFamily;
}
