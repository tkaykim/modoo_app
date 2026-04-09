'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import CoBuyOrganizerView from '@/app/components/cobuy/CoBuyOrganizerView';

export default function CoBuyHostByShareTokenPage() {
  const params = useParams();
  const raw = params.shareToken;
  const shareToken = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  return <CoBuyOrganizerView access={{ mode: 'shareToken', shareToken }} />;
}
