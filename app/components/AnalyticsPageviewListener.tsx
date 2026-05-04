'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageview } from '@/lib/analytics-tracker';

export default function AnalyticsPageviewListener() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    trackPageview();
  }, [pathname]);

  return null;
}
