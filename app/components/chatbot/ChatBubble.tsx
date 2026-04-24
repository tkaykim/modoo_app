'use client';

import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { trackChatbotOpen } from '@/lib/gtm-events';

// Cute chatbot face icon
function ChatBotIcon() {
  return (
    <div className="relative">
      {/* Face */}
      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center relative">
        {/* Eyes */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-[#3B55A5] rounded-full animate-[blink_3s_infinite]" />
          <div className="w-2 h-2 bg-[#3B55A5] rounded-full animate-[blink_3s_infinite]" />
        </div>
        {/* Smile */}
        <div className="absolute bottom-1.5 w-3 h-1.5 border-b-2 border-[#3B55A5] rounded-b-full" />
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

  // Only show chat bubble on the home screen
  if (pathname !== '/home') {
    return null;
  }

  const handleClick = () => {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
      trackChatbotOpen({ source: 'home_bubble' });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-9998 w-15 h-15 bg-linear-to-br from-[#4A66B5] to-[#3B55A5] text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center animate-[float_3s_ease-in-out_infinite]"
      aria-label={isOpen ? '채팅 닫기' : '채팅 열기'}
    >
      {isOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <ChatBotIcon />
      )}
    </button>
  );
}
