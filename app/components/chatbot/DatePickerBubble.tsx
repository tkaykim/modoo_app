'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerBubbleProps {
  onSubmit: (date: string | null, flexible: boolean) => void;
  disabled?: boolean;
}

export default function DatePickerBubble({ onSubmit, disabled }: DatePickerBubbleProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');

  const handleDateSubmit = () => {
    if (!selectedDate || disabled) return;
    onSubmit(selectedDate, false);
  };

  const handleFlexibleDate = () => {
    if (disabled) return;
    onSubmit(null, true);
  };

  return (
    <div className="mt-3 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          <Calendar className="w-3.5 h-3.5 inline mr-1" />
          필요한 날짜
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B55A5] focus:border-transparent bg-white disabled:opacity-50"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleFlexibleDate}
          disabled={disabled}
          className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          크게 상관 없음
        </button>
        <button
          onClick={handleDateSubmit}
          disabled={!selectedDate || disabled}
          className="flex-1 py-2.5 bg-[#3B55A5] text-white text-sm font-medium rounded-lg hover:bg-[#2D4280] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          선택 완료
        </button>
      </div>
    </div>
  );
}
