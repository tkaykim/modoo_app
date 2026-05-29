'use client';

import { Priority } from '@/lib/chatbot/types';

// 선호 방향 단일 선택 (제목 + 설명). 선택 즉시 [값] 배열로 제출 → 추천 단계로.
const OPTIONS: { value: Priority; title: string; desc: string }[] = [
  { value: '가격', title: '일단 싸게 만드는 게 최고야', desc: '퀄리티보다는 싼 가격에 집중' },
  { value: '밸런스', title: '적당한 가격, 꽤 괜찮은 퀄리티', desc: '적절한 밸런스' },
  { value: '퀄리티', title: '한번 만드는 거 고급스럽게 만들고 싶어', desc: '퀄리티에 집중' },
];

interface PrioritySelectorBubbleProps {
  onSubmit: (priorities: Priority[]) => void;
  disabled?: boolean;
}

export default function PrioritySelectorBubble({ onSubmit, disabled }: PrioritySelectorBubbleProps) {
  return (
    <div className="mt-3 space-y-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => !disabled && onSubmit([o.value])}
          disabled={disabled}
          className="w-full text-left p-3 rounded-lg border border-gray-300 bg-white hover:border-[#3B55A5] hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="block text-sm font-semibold text-gray-900">{o.title}</span>
          <span className="block text-xs text-gray-500 mt-0.5">{o.desc}</span>
        </button>
      ))}
    </div>
  );
}
