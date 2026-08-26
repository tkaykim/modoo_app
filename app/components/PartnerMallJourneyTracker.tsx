'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics-tracker';

type Props = {
  partnerMallId: string;
  sourceKey?: string | null;
};

function sanitizeActionLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function resolveAction(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const interactive = target.closest<HTMLElement>('button, a, [role="button"], [data-partner-action]');
  if (!interactive) return null;

  const explicit = interactive.dataset.partnerAction;
  if (explicit) return sanitizeActionLabel(explicit);

  const ariaLabel = interactive.getAttribute('aria-label');
  if (ariaLabel) return `aria:${sanitizeActionLabel(ariaLabel)}`;

  const text = sanitizeActionLabel(interactive.textContent || '');
  if (text) return `text:${text}`;

  return interactive.tagName.toLowerCase();
}

function readScrollPercent(): number {
  const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const available = Math.max(0, scrollHeight - window.innerHeight);
  if (available === 0) return 100;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / available) * 100)));
}

export default function PartnerMallJourneyTracker({ partnerMallId, sourceKey }: Props) {
  useEffect(() => {
    const startedAt = Date.now();
    let visibleStartedAt: number | null = document.visibilityState === 'visible' ? startedAt : null;
    let accumulatedActiveMs = 0;
    let maxScrollPercent = readScrollPercent();
    let clickCount = 0;
    let lastAction: string | null = null;
    let ended = false;

    const activeMsAt = (now: number) => accumulatedActiveMs + (visibleStartedAt === null ? 0 : now - visibleStartedAt);

    const sendEngagement = (reason: 'heartbeat' | 'hidden' | 'pagehide' | 'unmount') => {
      if (ended && reason !== 'heartbeat') return;
      const now = Date.now();
      maxScrollPercent = Math.max(maxScrollPercent, readScrollPercent());
      track({
        event_type: 'partner_mall_engagement',
        meta: {
          partner_mall_id: partnerMallId,
          source_key: sourceKey ?? null,
          duration_seconds: Math.max(0, Math.round((now - startedAt) / 1000)),
          active_seconds: Math.max(0, Math.round(activeMsAt(now) / 1000)),
          max_scroll_percent: maxScrollPercent,
          click_count: clickCount,
          last_action: lastAction,
          reason,
        },
      });
      if (reason === 'pagehide' || reason === 'unmount') ended = true;
    };

    const handleClick = (event: MouseEvent) => {
      const action = resolveAction(event.target);
      if (!action) return;
      clickCount += 1;
      lastAction = action;
      track({
        event_type: 'partner_mall_action_click',
        meta: {
          partner_mall_id: partnerMallId,
          source_key: sourceKey ?? null,
          action,
          click_index: clickCount,
          elapsed_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        },
      });
    };

    const handleScroll = () => {
      maxScrollPercent = Math.max(maxScrollPercent, readScrollPercent());
    };

    const handleVisibility = () => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        if (visibleStartedAt !== null) accumulatedActiveMs += now - visibleStartedAt;
        visibleStartedAt = null;
        sendEngagement('hidden');
      } else if (visibleStartedAt === null) {
        visibleStartedAt = now;
      }
    };

    const handlePageHide = () => sendEngagement('pagehide');
    const heartbeat = window.setInterval(() => sendEngagement('heartbeat'), 15000);

    document.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      sendEngagement('unmount');
    };
  }, [partnerMallId, sourceKey]);

  return null;
}
