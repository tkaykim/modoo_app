/**
 * 날짜·시간은 한국 표준시(KST, Asia/Seoul)로 표시합니다.
 * 서버/클라이언트 타임존과 무관하게 동일하게 보입니다.
 */
export const KST_TIMEZONE = 'Asia/Seoul' as const;

function parseDate(input: string | Date | null | undefined): Date | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const kst = { timeZone: KST_TIMEZONE } as const;

export function formatKstDateLong(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKstDateNumeric(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatKstDateOnly(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatKstDateShort(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatKstMonthDay(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR', {
    ...kst,
    month: 'short',
    day: 'numeric',
  });
}

/** 예: "3월 15일" (연도 없음) */
export function formatKstMonthDayLong(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR', {
    ...kst,
    month: 'long',
    day: 'numeric',
  });
}

/** 예: "3월 15일 오후 2:30" */
export function formatKstShortDateTime(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKstDateTimeMedium(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKstDateTimeCompact(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKstDateTimeFull(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatKstTodayLong(): string {
  return new Date().toLocaleDateString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** `<input type="date">`의 value / min 등에 쓰는 YYYY-MM-DD (KST 달력 기준) */
export function formatKstDateInputValue(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPart['type']) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatDatetimeLocalKst(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPart['type']) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function getKstYYYYMMDD(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPart['type']) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** 현재 시각의 KST 시(0–23) */
export function getKstHour(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIMEZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
}

export function isTodayKst(input: string | Date | null | undefined): boolean {
  const d = parseDate(input);
  if (!d) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d) === fmt.format(new Date());
}
