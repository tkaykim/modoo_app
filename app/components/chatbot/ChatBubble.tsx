'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { trackChatbotOpen } from '@/lib/gtm-events';

// 말풍선 티저 문구 — 랜덤 로테이션으로 노출.
const TEASER_MESSAGES = [
  '단체복·커스텀, 처음이신가요? 👋',
  '예상 견적이 궁금하신가요? 💰',
  '1장도 제작할 수 있어요!',
  '디자인 막막하면 같이 잡아드려요 🎨',
  '최소수량·납기, 편하게 물어보세요',
  '지금 물어보면 바로 답변드려요 ⚡',
];

const TEASER_DISMISS_KEY = 'chat_teaser_dismissed';

// Cute chatbot face icon
function ChatBotIcon() {
  return (
    <div className="relative">
      {/* Face */}
      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center relative">
        {/* Eyes */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-brand rounded-full animate-[blink_3s_infinite]" />
          <div className="w-2 h-2 bg-brand rounded-full animate-[blink_3s_infinite]" />
        </div>
        {/* Smile */}
        <div className="absolute bottom-1.5 w-3 h-1.5 border-b-2 border-brand rounded-b-full" />
        {/* Antenna */}
        <div className="absolute -top-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-1 bg-gray-300" />
      </div>
    </div>
  );
}

export default function ChatBubble() {
  const pathname = usePathname();
  const { isOpen, openChat, closeChat } = useChatStore();

  // ⚠️ Hooks must run before any early return (React #310 in minified prod otherwise).
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);

  // 등장(1.8s 지연) + 문구 랜덤 로테이션(5s). /home 이고, 이 세션에 닫지 않았을 때만.
  useEffect(() => {
    if (pathname !== '/home') return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(TEASER_DISMISS_KEY) === '1') return;
    setMsgIndex(Math.floor(Math.random() * TEASER_MESSAGES.length));
    const showTimer = setTimeout(() => setTeaserVisible(true), 1800);
    const rotateTimer = setInterval(() => {
      setMsgIndex((prev) => {
        // 같은 문구 연속 회피
        let next = Math.floor(Math.random() * TEASER_MESSAGES.length);
        if (next === prev) next = (next + 1) % TEASER_MESSAGES.length;
        return next;
      });
    }, 5000);
    return () => {
      clearTimeout(showTimer);
      clearInterval(rotateTimer);
    };
  }, [pathname]);

  // 챗봇이 열리면 티저 숨김.
  useEffect(() => {
    if (isOpen) setTeaserVisible(false);
  }, [isOpen]);

  // Only show chat bubble on the home screen
  if (pathname !== '/home') {
    return null;
  }

  const openFromBubble = (source: 'home_bubble' | 'home_teaser') => {
    openChat();
    trackChatbotOpen({ source });
  };

  const handleIconClick = () => {
    if (isOpen) {
      closeChat();
    } else {
      openFromBubble('home_bubble');
    }
  };

  const dismissTeaser = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTeaserVisible(false);
    try {
      sessionStorage.setItem(TEASER_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const showTeaser = teaserVisible && !isOpen;

  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-9998 flex flex-row-reverse items-center gap-2">
      <button
        onClick={handleIconClick}
        className="w-15 h-15 bg-linear-to-br from-brand to-brand-deep text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center animate-[float_3s_ease-in-out_infinite] shrink-0"
        aria-label={isOpen ? '채팅 닫기' : '채팅 열기'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <ChatBotIcon />}
      </button>

      {showTeaser && (
        <div className="relative animate-[float_3s_ease-in-out_infinite]">
          <button
            onClick={() => openFromBubble('home_teaser')}
            className="block max-w-[60vw] sm:max-w-[230px] text-left bg-white text-gray-800 text-sm font-medium leading-snug pl-4 pr-5 py-2.5 rounded-2xl rounded-br-sm shadow-lg ring-1 ring-black/5 hover:shadow-xl transition-shadow"
          >
            {TEASER_MESSAGES[msgIndex]}
          </button>
          {/* 말풍선 꼬리 (아이콘 방향) */}
          <span className="absolute -right-1 bottom-3 w-3 h-3 bg-white ring-1 ring-black/5 rotate-45 -z-10" />
          {/* 닫기 */}
          <button
            onClick={dismissTeaser}
            aria-label="안내 닫기"
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-gray-700/80 text-white flex items-center justify-center shadow hover:bg-gray-900 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
