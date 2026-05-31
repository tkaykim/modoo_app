'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

interface QuantityInputBubbleProps {
  onSubmit: (qty: number) => void;
  disabled?: boolean;
}

export default function QuantityInputBubble({ onSubmit, disabled }: QuantityInputBubbleProps) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState(false);

  const submit = () => {
    if (disabled) return;
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setHint(true);
      return;
    }
    onSubmit(n);
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(e) => { setHint(false); setValue(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="예: 30"
          disabled={disabled}
          className="w-24 px-3 py-2 text-sm text-center border border-gray-300 rounded-lg focus:outline-none focus:border-[#0052CC] disabled:opacity-50"
        />
        <span className="text-sm text-gray-700">벌 정도</span>
        <button
          onClick={submit}
          disabled={disabled}
          className="ml-auto px-4 py-2 bg-[#0052CC] text-white text-sm font-medium rounded-lg hover:bg-[#003D99] transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Check className="w-4 h-4" /> 확인
        </button>
      </div>
      {hint && <p className="text-xs text-red-500 mt-1.5">숫자로 입력해 주세요 (예: 30)</p>}
      <p className="text-[11px] text-gray-400 mt-1.5">단 1벌부터 초대량까지 모두 제작 가능해요.</p>
      <p className="text-[11px] text-gray-400 mt-0.5">실제 주문 시 수량이 조금 변동돼도 괜찮아요.</p>
    </div>
  );
}
