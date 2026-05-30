'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType, QuickReply, Priority, PrintLocation, PrintMethodChoice, DesignType, ColorCount, DesignSizeCounts } from '@/lib/chatbot/types';
import ChatMessage from './ChatMessage';

interface MessageListProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  onQuickReplyClick: (reply: QuickReply) => void;
  onProductClick: (productId: string) => void;
  onDateSubmit?: (date: string | null, flexible: boolean) => void;
  onPrioritiesSubmit?: (priorities: Priority[]) => void;
  onContactSubmit?: (name: string, email: string, phone: string) => void;
  onLocationSubmit?: (locations: PrintLocation[]) => void;
  onDesignSizeSubmit?: (counts: DesignSizeCounts) => void;
  onQuantitySubmit?: (qty: number) => void;
  onMethodSelect?: (method: PrintMethodChoice) => void;
  onConsult?: (productId?: string) => void;
  designType?: DesignType;
  colorCount?: ColorCount;
  isSubmitting?: boolean;
}

export default function MessageList({
  messages,
  isTyping,
  onQuickReplyClick,
  onProductClick,
  onDateSubmit,
  onPrioritiesSubmit,
  onContactSubmit,
  onLocationSubmit,
  onDesignSizeSubmit,
  onQuantitySubmit,
  onMethodSelect,
  onConsult,
  designType,
  colorCount,
  isSubmitting
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const lastBotMessageIndex = messages.findLastIndex(m => m.sender === 'bot');

  // Auto-scroll to bottom only when new messages are added
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id}
          message={message}
          onQuickReplyClick={onQuickReplyClick}
          onProductClick={onProductClick}
          isLastBotMessage={index === lastBotMessageIndex}
          onDateSubmit={onDateSubmit}
          onPrioritiesSubmit={onPrioritiesSubmit}
          onContactSubmit={onContactSubmit}
          onLocationSubmit={onLocationSubmit}
          onDesignSizeSubmit={onDesignSizeSubmit}
          onQuantitySubmit={onQuantitySubmit}
          onMethodSelect={onMethodSelect}
          onConsult={onConsult}
          designType={designType}
          colorCount={colorCount}
          isTyping={isTyping}
          isSubmitting={isSubmitting}
        />
      ))}

      {/* Typing indicator */}
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
