import { verifyOrganizerAccessToken } from '@/lib/cobuy-organizer-token';

export function verifyOrganizerTokenForSession(organizerToken: unknown, sessionId: string): boolean {
  if (typeof organizerToken !== 'string' || !organizerToken) return false;
  const v = verifyOrganizerAccessToken(organizerToken);
  return v !== null && v.sessionId === sessionId;
}
