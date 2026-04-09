'use client';

import { useParams } from 'next/navigation';
import CoBuyOrganizerView from '@/app/components/cobuy/CoBuyOrganizerView';

export default function CoBuyHostByTokenPage() {
  const params = useParams();
  const raw = params.token;
  const token = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  return <CoBuyOrganizerView access={{ mode: 'token', token }} />;
}
