'use client';

/**
 * 전화번호 입력칸 — 하이픈 표시 + 형식 안내를 한 곳에서 처리한다.
 *
 * 값은 항상 숫자만 부모에게 올려보낸다(저장 포맷 유지).
 * 화면에만 하이픈을 넣는 이유는, 붙어 있는 11자리는 사람이 자릿수를 셀 수 없어서다.
 * `010-493-1766` 처럼 마지막 칸이 짧으면 고객이 스스로 알아챈다.
 */

import { checkPhone, formatPhone, sanitizePhoneInput } from '@/lib/phone';

interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const MESSAGE_STYLE: Record<string, string> = {
  error: 'text-red-600',
  warn: 'text-amber-600',
  notice: 'text-gray-500',
  ok: 'text-gray-500',
};

const DEFAULT_CLASS =
  'w-full px-4 py-2.5 border rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black';

export default function PhoneInput({
  value,
  onChange,
  placeholder = '010-1234-5678',
  className,
  id,
  ariaLabel,
  disabled,
}: PhoneInputProps) {
  const result = checkPhone(value);
  const showError = result.severity === 'error' && !!result.message;

  const borderClass = showError
    ? 'border-red-400 bg-red-50'
    : result.severity === 'warn'
      ? 'border-amber-300'
      : 'border-gray-300';

  return (
    <div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        aria-label={ariaLabel}
        aria-invalid={showError || undefined}
        disabled={disabled}
        value={formatPhone(value)}
        onChange={(e) => onChange(sanitizePhoneInput(e.target.value))}
        placeholder={placeholder}
        className={`${className ?? DEFAULT_CLASS} ${borderClass}`}
      />
      {result.message && (
        <p className={`mt-1 text-xs ${MESSAGE_STYLE[result.severity] ?? 'text-gray-500'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
