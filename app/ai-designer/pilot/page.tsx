import { notFound } from 'next/navigation';
import PilotClient from './PilotClient';

export const dynamic = 'force-dynamic';

/**
 * AI 디자이너 품질 파일럿(개발·테스트 환경 전용).
 * AI_DESIGNER_PILOT_ENABLED=1 일 때만 열린다. API 토큰(AI_DESIGNER_PILOT_TOKEN)이 있으면 ?token= 으로 전달.
 */
export default function PilotPage() {
  if (process.env.AI_DESIGNER_PILOT_ENABLED !== '1') notFound();
  return <PilotClient tokenRequired={!!process.env.AI_DESIGNER_PILOT_TOKEN} />;
}
