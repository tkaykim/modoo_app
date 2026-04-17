'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, MessageSquare, Loader2, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { formatKstDateTimeCompact } from '@/lib/kst';
import type { EditorChatMessage } from '@/types/types';

interface DesignChatSectionProps {
  orderId: string;
  orderItemId: string;
  productTitle?: string;
  designTitle?: string;
  onClose: () => void;
}

const roleLabel: Record<string, string> = {
  admin: '관리자',
  factory: '공장',
  customer: '나',
};

export default function DesignChatSection({
  orderId,
  orderItemId,
  productTitle,
  designTitle,
  onClose,
}: DesignChatSectionProps) {
  const [messages, setMessages] = useState<EditorChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/messages?orderItemId=${orderItemId}`);
      if (!res.ok) return;
      const { data } = await res.json();
      setMessages(data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [orderId, orderItemId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`editor-chat-${orderItemId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'editor_chat_messages',
          filter: `order_item_id=eq.${orderItemId}`,
        },
        () => {
          fetchMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderItemId, fetchMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId,
          content: newMessage.trim(),
        }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setMessages((prev) => [...prev, data]);
        setNewMessage('');
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => formatKstDateTimeCompact(dateStr);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1">
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">디자인 소통</h3>
            <p className="text-xs text-gray-500 truncate">
              {productTitle}{designTitle ? ` · ${designTitle}` : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">아직 메시지가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">디자인에 대해 궁금한 점을 물어보세요</p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderRole = msg.sender?.role || 'customer';
            const isMe = senderRole === 'customer';

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {msg.sender?.name || (senderRole === 'admin' ? '관리자' : '공장')}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {roleLabel[senderRole]}
                    </span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.attachment_urls && msg.attachment_urls.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                    {msg.attachment_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`첨부 ${i + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-gray-400 mt-0.5">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white shrink-0 safe-area-bottom">
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: '80px' }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
