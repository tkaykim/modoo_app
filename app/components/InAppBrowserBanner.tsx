'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X, Copy, Check } from 'lucide-react';
import {
  detectInApp,
  appLabel,
  openInExternalAndroid,
  copyCurrentUrl,
  type InAppInfo,
} from '@/lib/inAppBrowser';

type Variant = 'bar' | 'card';

const DISMISS_KEY = 'inapp_banner_dismissed';

export default function InAppBrowserBanner({
  variant = 'bar',
  dismissible = true,
}: {
  variant?: Variant;
  dismissible?: boolean;
}) {
  const [info, setInfo] = useState<InAppInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // SSR 하이드레이션 불일치 방지 — 마운트 후에만 감지
  useEffect(() => {
    setInfo(detectInApp());
    if (dismissible && variant === 'bar') {
      try {
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
      } catch {
        /* ignore */
      }
    }
  }, [dismissible, variant]);

  if (!info?.isInApp || dismissed) return null;

  const isIOS = info.platform === 'ios';
  const label = appLabel(info.app);

  const handleOpenExternal = async () => {
    if (info.platform === 'android') {
      const ok = openInExternalAndroid();
      if (ok) return;
    }
    // iOS / 실패 시: 링크 복사 후 안내
    const copiedOk = await copyCurrentUrl();
    setCopied(copiedOk);
    if (copiedOk) setTimeout(() => setCopied(false), 2500);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const iosHint = isIOS
    ? '오른쪽 위 ··· 메뉴 → "Safari로 열기"를 눌러주세요.'
    : null;

  if (variant === 'card') {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <ExternalLink className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              {label} 인앱 브라우저에서는 결제가 막힐 수 있어요
            </p>
            <p className="mt-1 text-amber-800">
              안전한 결제를 위해 <b>외부 브라우저(Chrome/Safari)</b>로 열어주세요.
            </p>
            {iosHint && <p className="mt-1 text-amber-700 text-xs">{iosHint}</p>}
            <button
              onClick={handleOpenExternal}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700 transition"
            >
              {isIOS ? (
                copied ? <><Check className="w-4 h-4" /> 링크 복사됨</> : <><Copy className="w-4 h-4" /> 결제 링크 복사</>
              ) : (
                <><ExternalLink className="w-4 h-4" /> 외부 브라우저로 열기</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // variant === 'bar'
  return (
    <div className="bg-amber-500 text-white text-xs sm:text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <ExternalLink className="w-4 h-4 shrink-0" />
        <span className="flex-1 leading-tight">
          {label} 브라우저예요. 로그인·결제 오류를 피하려면{' '}
          <b>외부 브라우저로 열기</b>를 권장해요{isIOS ? ' (··· → Safari로 열기)' : ''}.
        </span>
        <button
          onClick={handleOpenExternal}
          className="shrink-0 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-1 font-medium hover:bg-white/30 transition"
        >
          {isIOS ? (
            copied ? <><Check className="w-3.5 h-3.5" /> 복사됨</> : <><Copy className="w-3.5 h-3.5" /> 링크복사</>
          ) : (
            <><ExternalLink className="w-3.5 h-3.5" /> 열기</>
          )}
        </button>
        {dismissible && (
          <button onClick={handleDismiss} className="shrink-0 p-1 hover:bg-white/20 rounded" aria-label="닫기">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
