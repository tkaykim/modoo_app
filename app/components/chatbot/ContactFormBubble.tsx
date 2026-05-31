'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';

interface ContactFormBubbleProps {
  onSubmit: (name: string, email: string, phone: string, fileUrls: string[]) => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isImage = (u: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u);

export default function ContactFormBubble({ onSubmit, disabled, isSubmitting }: ContactFormBubbleProps) {
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '' });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await fetch('/api/inquiries/files/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '파일 업로드에 실패했어요.');
      setFileUrls((prev) => [...prev, ...(json?.files || []).map((f: { url: string }) => f.url)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일 업로드에 실패했어요.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    onSubmit(name, email, phone, fileUrls);
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
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white disabled:opacity-50"
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
          className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
        />
        <span className="text-xs text-gray-600">개인정보 활용 동의 *</span>
      </label>

      {/* 시안/로고 첨부 (선택) — 미리 주시면 상담이 더 빨라져요 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">시안·로고 파일 첨부 (선택)</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSubmitting || uploading}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <Paperclip className="w-3.5 h-3.5" />
          {uploading ? '업로드 중...' : '로고·이미지 첨부'}
        </button>
        <p className="mt-1 text-[11px] text-gray-400">로고나 원하시는 시안을 미리 올려주시면 상담이 더 빨라져요.</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.ai"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        {fileUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {fileUrls.map((u) => (
              <div key={u} className="relative">
                {isImage(u) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u} alt="첨부" className="w-14 h-14 object-cover rounded border border-gray-200" />
                ) : (
                  <span className="flex items-center justify-center w-14 h-14 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-500">파일</span>
                )}
                <button
                  type="button"
                  onClick={() => setFileUrls((prev) => prev.filter((x) => x !== u))}
                  className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full w-4 h-4 flex items-center justify-center"
                  aria-label="첨부 삭제"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={disabled || isSubmitting}
        className="w-full py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '접수 중...' : '상담 신청하기'}
      </button>
    </div>
  );
}
