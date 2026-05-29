'use client';

import { useState } from 'react';

interface ContactFormBubbleProps {
  onSubmit: (name: string, email: string, phone: string) => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactFormBubble({ onSubmit, disabled, isSubmitting }: ContactFormBubbleProps) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '' });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (disabled || isSubmitting) return;
    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    const phone = contactForm.phone.trim();
    // silent-disabled 금지: 버튼은 항상 누를 수 있고, 미입력은 인라인으로 안내
    if (!name) return setError('이름을 입력해 주세요.');
    if (!phone) return setError('연락처를 입력해 주세요.');
    if (!email) return setError('이메일을 입력해 주세요. (접수 확인 메일을 보내드려요)');
    if (!EMAIL_RE.test(email)) return setError('이메일 형식을 확인해 주세요.');
    if (!privacyConsent) return setError('개인정보 활용에 동의해 주세요.');
    setError(null);
    onSubmit(name, email, phone);
  };

  const field = (key: 'name' | 'email' | 'phone', label: string, type: string, placeholder: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label} *</label>
      <input
        type={type}
        value={contactForm[key]}
        onChange={(e) => { setError(null); setContactForm((prev) => ({ ...prev, [key]: e.target.value })); }}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B55A5] focus:border-transparent bg-white disabled:opacity-50"
      />
    </div>
  );

  return (
    <div className="mt-3 space-y-3">
      {field('name', '이름', 'text', '홍길동')}
      {field('phone', '연락처', 'tel', '010-1234-5678')}
      {field('email', '이메일', 'email', 'email@example.com')}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={privacyConsent}
          onChange={(e) => { setError(null); setPrivacyConsent(e.target.checked); }}
          disabled={disabled || isSubmitting}
          className="w-4 h-4 text-[#3B55A5] border-gray-300 rounded focus:ring-[#3B55A5]"
        />
        <span className="text-xs text-gray-600">개인정보 활용 동의 *</span>
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={disabled || isSubmitting}
        className="w-full py-2.5 bg-[#3B55A5] text-white text-sm font-medium rounded-lg hover:bg-[#2D4280] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '접수 중...' : '상담 신청하기'}
      </button>
    </div>
  );
}
