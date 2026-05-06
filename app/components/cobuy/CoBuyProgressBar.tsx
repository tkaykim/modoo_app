'use client';

import { CoBuyStatus } from '@/types/types';
import { Check } from 'lucide-react';

// Progress states in order (excludes 'cancelled' as it's not a progress step)
type ProgressStatus = Exclude<CoBuyStatus, 'cancelled'>;

interface ProgressStep {
  key: ProgressStatus;
  label: string;
}

const PROGRESS_STEPS: ProgressStep[] = [
  { key: 'gathering', label: '모집중' },
  { key: 'gather_complete', label: '모집 완료' },
  { key: 'order_complete', label: '주문 완료' },
  { key: 'manufacturing', label: '제작중' },
  { key: 'manufacture_complete', label: '제작 완료' },
  { key: 'delivering', label: '배송중' },
  { key: 'delivery_complete', label: '배송 완료' },
];

interface CoBuyProgressBarProps {
  currentStatus: CoBuyStatus;
}

export default function CoBuyProgressBar({ currentStatus }: CoBuyProgressBarProps) {
  // If cancelled, don't show progress (or show at gathering step)
  const effectiveStatus = currentStatus === 'cancelled' ? 'gathering' : currentStatus;
  const currentIndex = PROGRESS_STEPS.findIndex((step) => step.key === effectiveStatus);

  return (
    <div className="w-full">
      <div className="flex items-start justify-between relative gap-1 md:gap-2">
        {/* Background line */}
        <div className="absolute left-0 right-0 top-3 md:top-4 h-0.5 bg-gray-200" />
        {/* Progress line */}
        <div
          className="absolute left-0 top-3 md:top-4 h-0.5 bg-green-500 transition-all duration-300"
          style={{
            width: `${currentIndex > 0 ? (currentIndex / (PROGRESS_STEPS.length - 1)) * 100 : 0}%`,
          }}
        />

        {PROGRESS_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 flex-1 min-w-0">
              {/* Circle */}
              <div
                className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-[#3B55A5] text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 md:w-5 md:h-5" />
                ) : (
                  <span className="text-[11px] md:text-sm font-medium">{index + 1}</span>
                )}
              </div>
              {/* Label */}
              <span
                className={`mt-1.5 md:mt-2 text-[10px] md:text-xs font-medium whitespace-nowrap ${
                  isCompleted
                    ? 'text-green-600'
                    : isCurrent
                    ? 'text-[#3B55A5]'
                    : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
