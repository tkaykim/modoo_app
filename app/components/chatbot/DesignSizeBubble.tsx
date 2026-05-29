'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { DesignSizeCounts } from '@/lib/chatbot/types';

interface DesignSizeBubbleProps {
  onSubmit: (counts: DesignSizeCounts) => void;
  disabled?: boolean;
}

const ROWS: { key: keyof DesignSizeCounts; label: string; hint: string }[] = [
  { key: '10x10', label: '작은 디자인', hint: '10cm 정도' },
  { key: 'A4', label: '중간 크기 디자인', hint: 'A4 사이즈 이내' },
  { key: 'A3', label: '큰 디자인', hint: 'A3 사이즈 이내' },
];

export default function DesignSizeBubble({ onSubmit, disabled }: DesignSizeBubbleProps) {
  const [counts, setCounts] = useState<Record<string, string>>({ '10x10': '', A4: '', A3: '' });
  const [hint, setHint] = useState(false);

  const setVal = (key: string, v: string) => {
    setHint(false);
    setCounts((prev) => ({ ...prev, [key]: v }));
  };

  const submit = () => {
    if (disabled) return;
    const parsed: DesignSizeCounts = {
      '10x10': Math.max(0, parseInt(counts['10x10'] || '0', 10) || 0),
      A4: Math.max(0, parseInt(counts.A4 || '0', 10) || 0),
      A3: Math.max(0, parseInt(counts.A3 || '0', 10) || 0),
    };
    if (parsed['10x10'] + parsed.A4 + parsed.A3 <= 0) {
      setHint(true);
      return;
    }
    onSubmit(parsed);
  };

  return (
    <div className="mt-3 space-y-2">
      {ROWS.map((r) => (
        <div key={r.key} className="flex items-center gap-2 border-b border-gray-100 pb-2">
          <div className="flex-1 min-w-0 leading-tight">
            <span className="block text-sm font-medium text-gray-900">{r.label}</span>
            <span className="block text-[11px] text-gray-400">{r.hint}</span>
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={counts[r.key]}
            onChange={(e) => setVal(r.key, e.target.value)}
            placeholder="0"
            disabled={disabled}
            className="w-14 px-2 py-2 text-sm text-center border border-gray-300 rounded-lg focus:outline-none focus:border-[#3B55A5] disabled:opacity-50 shrink-0"
          />
          <span className="text-sm text-gray-500 shrink-0">개</span>
        </div>
      ))}
      {hint && <p className="text-xs text-red-500">최소 1개 이상 입력해 주세요.</p>}
      <button
        onClick={submit}
        disabled={disabled}
        className="w-full py-2.5 mt-1 bg-[#3B55A5] text-white text-sm font-medium rounded-lg hover:bg-[#2D4280] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" /> 확인
      </button>
    </div>
  );
}
