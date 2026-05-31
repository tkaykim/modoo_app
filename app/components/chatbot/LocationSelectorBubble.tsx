'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { PrintLocation } from '@/lib/chatbot/types';
import { PRINT_LOCATIONS } from '@/lib/chatbot/config';

interface LocationSelectorBubbleProps {
  onSubmit: (locations: PrintLocation[]) => void;
  disabled?: boolean;
}

export default function LocationSelectorBubble({ onSubmit, disabled }: LocationSelectorBubbleProps) {
  const [selected, setSelected] = useState<PrintLocation[]>([]);
  const [showHint, setShowHint] = useState(false);

  const toggle = (loc: PrintLocation) => {
    if (disabled) return;
    setShowHint(false);
    setSelected((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const handleSubmit = () => {
    if (disabled) return;
    if (selected.length === 0) {
      // silent disabled 금지 — 클릭 가능하게 두고 시각적으로 안내
      setShowHint(true);
      return;
    }
    onSubmit(selected);
  };

  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-2">
        {selected.length === 0 ? '인쇄할 위치를 1곳 이상 골라주세요' : `${selected.length}곳 선택됨`}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRINT_LOCATIONS.map((loc) => {
          const isSelected = selected.includes(loc);
          return (
            <button
              key={loc}
              onClick={() => toggle(loc)}
              disabled={disabled}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? 'bg-brand text-white ring-2 ring-brand ring-offset-1'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-brand hover:text-brand'
              }`}
            >
              {isSelected && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
              {loc}
            </button>
          );
        })}
      </div>
      {showHint && (
        <p className="text-xs text-red-500 mb-2 animate-pulse">
          최소 1곳을 선택해주세요.
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={disabled}
        className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          selected.length === 0
            ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            : 'bg-brand text-white hover:bg-brand-deep'
        }`}
      >
        <Check className="w-4 h-4" />
        선택 완료
      </button>
    </div>
  );
}
