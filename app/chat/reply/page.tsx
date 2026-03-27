'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface ChatMessage {
  id: string;
  content: string;
  status: string;
  attachment_urls: string[];
  created_at: string;
  sender?: { name: string | null; role: string } | null;
}

interface ChatData {
  orderItemId: string;
  orderId: string;
  productTitle: string;
  designTitle: string | null;
  messages: ChatMessage[];
}

const roleLabel: Record<string, string> = {
  admin: '관리자',
  factory: '공장',
  customer: '고객',
};

function ChatReplyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!token) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/chat/reply?token=${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || '메시지를 불러올 수 없습니다.');
        setLoading(false);
        return;
      }
      const { data } = await res.json();
      setChatData(data);
    } catch {
      setError('메시지를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData?.messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !token) return;

    setSending(true);
    try {
      const res = await fetch(`/api/chat/reply?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setChatData((prev) =>
          prev ? { ...prev, messages: [...prev.messages, data] } : prev,
        );
        setNewMessage('');
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
          <p className="text-gray-500 mt-4 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">접근할 수 없습니다</h2>
          <p className="text-sm text-gray-500">{error || '유효하지 않은 링크입니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-600 text-lg font-bold">M</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900">모두의 유니폼</h1>
            <p className="text-xs text-gray-500 truncate">
              {chatData.productTitle}
              {chatData.designTitle ? ` · ${chatData.designTitle}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatData.messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">아직 대화 내용이 없습니다</p>
          </div>
        ) : (
          chatData.messages.map((msg) => {
            const senderRole = msg.sender?.role || 'customer';
            const isMe = senderRole === 'customer';

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {msg.sender?.name || roleLabel[senderRole] || senderRole}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {roleLabel[senderRole]}
                    </span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.attachment_urls && msg.attachment_urls.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                    {msg.attachment_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
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
      <div className="border-t border-gray-200 px-4 py-3 bg-white shrink-0">
        {sent && (
          <div className="mb-2 px-3 py-2 bg-green-50 text-green-700 text-xs rounded-lg text-center">
            메시지가 전송되었습니다
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="답변을 입력하세요..."
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: '80px' }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? '전송중...' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatReplyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
        </div>
      }
    >
      <ChatReplyContent />
    </Suspense>
  );
}
