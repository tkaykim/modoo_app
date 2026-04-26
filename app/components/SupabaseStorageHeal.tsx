'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { isSupabaseAuthLikeError, healSupabaseAndReload } from '@/lib/supabase-resilient';

const HEAL_FLAG = 'sb-heal-ran';

export default function SupabaseStorageHeal() {
  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(HEAL_FLAG) === 'done') return;
    } catch {}

    (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('hero_banners')
          .select('id')
          .limit(1);

        if (cancelled) return;

        if (error && isSupabaseAuthLikeError(error)) {
          healSupabaseAndReload();
          return;
        }

        try { sessionStorage.setItem(HEAL_FLAG, 'done'); } catch {}
      } catch {
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
