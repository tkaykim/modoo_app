'use client';

import { useParams } from 'next/navigation';
import CoBuyOrganizerView from '@/app/components/cobuy/CoBuyOrganizerView';

export default function CoBuyDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  return <CoBuyOrganizerView access={{ mode: 'sessionId', sessionId }} />;
}
