'use client';

import ChatConversation from '@/app/components/chatbot/ChatConversation';

/**
 * 전체화면 챗봇 페이지. 플로팅 위젯과 100% 동일한 대화 플로우를 쓴다
 * (ChatConversation 공유). 과거 별도 핸들러 사본으로 인한 동작 불일치 제거.
 */
export default function ChatPage() {
  return <ChatConversation variant="fullscreen" />;
}
