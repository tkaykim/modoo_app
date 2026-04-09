'use client';

import { useParams } from 'next/navigation';
import CoBuyOrganizerView from '@/app/components/cobuy/CoBuyOrganizerView';

export default function CoBuyHostByShareTokenPage() {
  const params = useParams();
  const raw = params.shareToken;
  const shareToken = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  return <CoBuyOrganizerView access={{ mode: 'shareToken', shareToken }} />;
}
