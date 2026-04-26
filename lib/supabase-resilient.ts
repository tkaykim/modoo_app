const HEAL_FLAG = 'sb-heal-ran';

export function isSupabaseAuthLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: number; code?: string; message?: string; name?: string };
  if (e.status === 401 || e.status === 403) return true;
  const code = (e.code || '').toUpperCase();
  if (code === 'PGRST301' || code === 'PGRST302' || code === '42501') return true;
  const msg = (e.message || '').toLowerCase();
  if (msg.includes('jwt') && (msg.includes('expired') || msg.includes('invalid') || msg.includes('malformed'))) return true;
  if (msg.includes('invalid api key')) return true;
  if (msg.includes('invalid token')) return true;
  if ((e.name || '').toLowerCase() === 'authsessionmissingerror') return false;
  return false;
}

export function purgeSupabaseAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.startsWith('supabase.'))) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('sb-') || k.startsWith('supabase.')) && k !== HEAL_FLAG) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch {}
  try {
    const host = window.location.hostname;
    const root = host.replace(/^www\./, '');
    document.cookie.split(';').forEach(raw => {
      const name = raw.split('=')[0].trim();
      if (!name.startsWith('sb-')) return;
      const expire = (extra: string) => {
        document.cookie = `${name}=; Max-Age=0; path=/${extra}`;
      };
      expire('');
      expire(`; domain=${host}`);
      expire(`; domain=.${root}`);
    });
  } catch {}
}

export function healSupabaseAndReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(HEAL_FLAG) === 'done') return false;
    sessionStorage.setItem(HEAL_FLAG, 'done');
  } catch {}
  purgeSupabaseAuthStorage();
  window.location.reload();
  return true;
}

export function maybeHealOnError(error: unknown): boolean {
  if (!isSupabaseAuthLikeError(error)) return false;
  return healSupabaseAndReload();
}
