'use client';

import { PrintMethodRecord } from '@/types/types';
import { Check } from 'lucide-react';

interface PrintMethodsDisplayProps {
  allPrintMethods: PrintMethodRecord[];
  enabledPrintMethodIds: Set<string>;
  className?: string;
}

export default function PrintMethodsDisplay({ allPrintMethods, enabledPrintMethodIds, className = '' }: PrintMethodsDisplayProps) {
  if (allPrintMethods.length === 0) return null;

  return (
    <div className={`py-2 ${className}`}>
      <p className="text-[11px] font-semibold text-gray-500 mb-1.5">인쇄 방식</p>
      <div className="flex flex-wrap gap-1.5">
        {allPrintMethods.map((pm) => {
          const isEnabled = enabledPrintMethodIds.has(pm.id);
          return (
            <div
              key={pm.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                isEnabled
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              {pm.image_url && (
                <img
                  src={pm.image_url}
                  alt={pm.name}
                  className={`w-5 h-5 rounded object-cover ${isEnabled ? '' : 'opacity-40'}`}
                />
              )}
              <span>{pm.name}</span>
              {isEnabled && <Check className="w-3 h-3 text-green-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
