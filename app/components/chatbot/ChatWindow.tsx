'use client';

import { useChatStore } from '@/store/useChatStore';
import ChatConversation from './ChatConversation';

/**
 * 우하단 플로팅 챗봇. 대화 로직·UI는 ChatConversation(공유)에 있고,
 * 여기선 열림 상태만 게이트한다. 전체화면 /chat 도 같은 컴포넌트를 쓴다.
 */
export default function ChatWindow() {
  const isOpen = useChatStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <ChatConversation variant="floating" />;
}
