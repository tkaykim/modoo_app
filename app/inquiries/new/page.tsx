'use client'

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Product } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import ProductSelectionModal from '@/app/components/ProductSelectionModal';
import { ChevronLeft, X, Loader2 } from 'lucide-react';
import { useRef } from 'react';

interface UploadedFile {
  url: string;
  path: string;
  name: string;
}

function FormRow({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col sm:flex-row border-b border-gray-300 ${className ?? ''}`}>
      <div className="sm:w-40 shrink-0 bg-gray-100 px-4 py-2 sm:py-3 text-sm font-medium text-gray-700 flex items-center sm:border-r border-gray-300">
        {label} {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div className="flex-1 px-4 py-2 sm:py-3">{children}</div>
    </div>
  );
}

const TITLE_PRESETS: Record<string, string> = {
  '디자인/견적 문의합니다.': `──────── 디자인/견적 문의 ────────

●제품 종류 :
 (예: 과잠바, 후드, 티셔츠, 유니폼 등)

●원하시는 디자인 설명 :
 (로고 위치, 텍스트 내용, 참고 이미지 등)

●인쇄 방식 희망사항 :
 (자수, DTF, 실크스크린 등 / 잘 모르시면 비워두세요)

●예산 범위 :
 (예: 개당 3만원 이내)

●기타 문의사항 :
`,
  '인쇄방법 문의': `──────── 인쇄방법 문의 ────────

인쇄 방법을 어떻게 선택해야할지 모르겠어요.

●제품 종류 :
 (예: 과잠바, 면티셔츠, 기능성 티셔츠, 또는 정확한 상품명)

●원하시는 디자인 설명 :
 (크기, 위치, 참고 이미지)

●예상 제작 수량 (소폭 변동되어도 괜찮습니다) :

●기타 문의사항 :
`,
  '주문/배송 문의합니다.': `──────── 주문/배송 문의 ────────

●주문번호 (있을 경우) :

●문의 내용 :
 (주문 변경, 배송 일정, 교환/반품 등)

●기타 문의사항 :
`,
};

function InquiryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevPresetRef = useRef('');

  // Auth
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product selection
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 기본정보
  const [title, setTitle] = useState('');
  const [groupName, setGroupName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [kakaoId, setKakaoId] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [expectedQty, setExpectedQty] = useState('');

  // 추가 내용 (maps to content column)
  const [content, setContent] = useState('');

  // 색상 및 디자인
  const [fabricColor, setFabricColor] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 개인정보
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState<'agree' | 'disagree' | ''>('');

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUser(user);
    };
    init();

    const productIdsParam = searchParams.get('products');
    if (productIdsParam) {
      fetchProductsByIds(productIdsParam.split(','));
    }
  }, [searchParams]);

  const fetchProductsByIds = async (productIds: string[]) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);
    if (!error && data) {
      setSelectedProducts(data as Product[]);
    }
  };

  const handleProductsConfirm = (products: Product[]) => {
    setSelectedProducts(products);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    const newPreset = TITLE_PRESETS[newTitle] || '';
    if (!content || content === prevPresetRef.current) {
      setContent(newPreset);
    }
    prevPresetRef.current = newPreset;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = 5 - uploadedFiles.length;
    if (remaining <= 0) {
      alert('최대 5개의 파일만 업로드할 수 있습니다.');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setIsUploading(true);

    try {
      const formData = new FormData();
      filesToUpload.forEach(f => formData.append('files', f));

      const res = await fetch('/api/inquiries/files/upload', {
        method: 'POST',
        body: formData,
      });

      const body = await res.json();
      if (!res.ok) {
        alert(body.error || '파일 업로드에 실패했습니다.');
        return;
      }

      if (Array.isArray(body.files)) {
        setUploadedFiles(prev => [...prev, ...body.files].slice(0, 5));
      }
    } catch {
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) { alert('제목을 선택해주세요.'); return; }
    if (!groupName.trim()) { alert('단체명을 입력해주세요.'); return; }
    if (!managerName.trim()) { alert('담당자명을 입력해주세요.'); return; }
    if (!phone.trim() && !kakaoId.trim()) { alert('연락처(전화번호 또는 카카오톡 아이디)를 하나 이상 입력해주세요.'); return; }
    if (!password.trim()) { alert('비밀번호를 입력해주세요.'); return; }
    if (consent !== 'agree') { alert('개인정보 수집 및 이용에 동의해주세요.'); return; }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: inquiry, error: inquiryError } = await supabase
        .from('inquiries')
        .insert({
          user_id: user?.id ?? null,
          title: title.trim(),
          content: content.trim() || '',
          status: 'pending',
          group_name: groupName.trim(),
          manager_name: managerName.trim(),
          phone: phone.trim(),
          kakao_id: kakaoId.trim() || null,
          desired_date: desiredDate || null,
          expected_qty: expectedQty ? parseInt(expectedQty, 10) : null,
          fabric_color: fabricColor.trim() || null,
          password: password.trim(),
          file_urls: uploadedFiles.map(f => f.url),
        })
        .select()
        .single();

      if (inquiryError) throw inquiryError;

      if (selectedProducts.length > 0) {
        const inquiryProducts = selectedProducts.map(product => ({
          inquiry_id: inquiry.id,
          product_id: product.id,
        }));
        const { error: productsError } = await supabase
          .from('inquiry_products')
          .insert(inquiryProducts);
        if (productsError) throw productsError;
      }

      // Send email notification to admin (non-blocking)
      fetch('/api/inquiries/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          groupName: groupName.trim(),
          managerName: managerName.trim(),
          phone: phone.trim(),
          kakaoId: kakaoId.trim() || undefined,
          desiredDate: desiredDate || undefined,
          expectedQty: expectedQty ? parseInt(expectedQty, 10) : undefined,
          content: content.trim() || undefined,
          fabricColor: fabricColor.trim() || undefined,
          fileCount: uploadedFiles.length,
          productNames: selectedProducts.map(p => p.title),
        }),
      }).catch(() => {}); // email failure should not affect the user

      alert('문의가 등록되었습니다.');
      router.replace('/inquiries');
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      alert('문의 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-black transition';
  const selectClass =
    'px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-black transition appearance-none bg-white';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-4 py-4 flex items-center">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition mr-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold">디자인/견적</h1>
        </div>
      </header>

      <div className="w-full px-4 py-6 pb-24">
        <p className="text-sm text-gray-600 mb-6">
          작성해주시면 그래픽 시안 및 빠른 견적을 카카오톡으로 받아 보실 수 있습니다.
        </p>

        <form onSubmit={handleSubmit}>
          {/* ═══════ 기본정보 ═══════ */}
          <h2 className="text-base font-bold mb-2">기본정보</h2>
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-8">
            {/* 제품 */}
            <FormRow label="제품">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-sm bg-[#3B55A5] text-white hover:bg-[#2f4584] transition"
                >
                  제품선택
                </button>
                {selectedProducts.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedProducts.map(p => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-300 text-xs"
                      >
                        {p.title}
                        <button type="button" onClick={() => removeProduct(p.id)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FormRow>

            {/* 제목 */}
            <FormRow label="제목" required>
              <select
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={selectClass + ' w-full'}
                disabled={isSubmitting}
              >
                <option value="">제목을 선택해주세요</option>
                <option value="디자인/견적 문의합니다.">디자인/견적 문의합니다.</option>
                <option value="인쇄방법 문의">인쇄방법 문의</option>
                <option value="주문/배송 문의합니다.">주문/배송 문의합니다.</option>
                <option value="기타 문의">기타 문의</option>
              </select>
            </FormRow>

            {/* 단체명 */}
            <FormRow label="단체명" required>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className={inputClass}
                disabled={isSubmitting}
              />
            </FormRow>

            {/* 담당자명 */}
            <FormRow label="담당자명" required>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className={inputClass}
                disabled={isSubmitting}
              />
            </FormRow>

            {/* 연락처 */}
            <FormRow label="연락처" required>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="전화번호, 카카오톡 아이디, 이메일 등"
                  className={inputClass}
                  disabled={isSubmitting}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 shrink-0">카카오톡 아이디</span>
                  <input
                    type="text"
                    value={kakaoId}
                    onChange={(e) => setKakaoId(e.target.value)}
                    placeholder="카카오톡 아이디"
                    className={inputClass + ' flex-1'}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  ▶ 전화번호 또는 카카오톡 아이디 중 하나 이상 입력해주세요. 카카오톡을 통해 견적서와 시안을 받아보실 수 있습니다.
                </p>
                <p className="text-xs text-gray-500">
                  ※ 카카오톡 전화번호 친구 추가 허용이 되어 있지 않은 경우 카카오톡 아이디를 별도 기재 부탁드립니다.
                </p>
              </div>
            </FormRow>

            {/* 착용희망날짜 */}
            <FormRow label="착용희망날짜">
              <input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className={inputClass + ' max-w-[220px]'}
                disabled={isSubmitting}
              />
            </FormRow>

            {/* 예상수량 */}
            <FormRow label="예상수량">
              <input
                type="number"
                value={expectedQty}
                onChange={(e) => setExpectedQty(e.target.value)}
                min={1}
                className={inputClass + ' max-w-[220px]'}
                disabled={isSubmitting}
              />
            </FormRow>

            {/* 추가 내용 */}
            <FormRow label="추가 내용">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="추가 내용을 입력해주세요"
                rows={10}
                className={inputClass + ' resize-none'}
                disabled={isSubmitting}
                maxLength={2000}
              />
            </FormRow>
          </div>

          {/* ═══════ 색상 및 디자인 ═══════ */}
          <h2 className="text-base font-bold mb-2">색상 및 디자인</h2>
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-8">
            {/* 정보 안내 */}
            <FormRow label="정보 안내">
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                <li>프린팅 방식에 대한 지정이 없을 경우, 가장 적합한 방식으로 적용하여 시안을 전달합니다.</li>
                <li>시안 작업에 참고할 사진 및 이미지(jpg, png 등)가 있으시다면 같이 파일 첨부해주세요.</li>
                <li>이미지 원본 파일(ai 확장자)을 첨부해주시면 시안 작업이 빠르게 진행됩니다.</li>
                <li>용량을 초과할 경우 <span className='text-blue-600'>modoo.contact@gmail.com</span> 메일로 첨부해주세요.</li>
              </ul>
            </FormRow>

            {/* 원단 색상 */}
            <FormRow label="원단 색상">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={fabricColor}
                  onChange={(e) => setFabricColor(e.target.value)}
                  placeholder="원하시는 원단 색상을 입력해주세요"
                  className={inputClass}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  ▶ 원단을 잘 모르실 경우 색상만 적어주시면 알맞게 매치 해드리겠습니다.
                </p>
              </div>
            </FormRow>

            {/* 참고 이미지 및 파일 */}
            <FormRow label="참고 이미지 및 파일">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.ai"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleFileSelect(e.target.files);
                      e.currentTarget.value = '';
                    }}
                    disabled={isSubmitting || isUploading}
                  />
                  <button
                    type="button"
                    className="px-4 py-2 text-sm bg-[#3B55A5] text-white hover:bg-[#2f4584] transition shrink-0 disabled:bg-gray-400"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || isUploading || uploadedFiles.length >= 5}
                  >
                    {isUploading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        업로드 중...
                      </span>
                    ) : '파일 선택'}
                  </button>
                  <span className="text-xs text-gray-400">
                    {uploadedFiles.length === 0
                      ? '선택된 파일 없음 (최대 5개)'
                      : `${uploadedFiles.length}개 파일 업로드됨`}
                  </span>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {uploadedFiles.map((file, i) => (
                      <div key={file.path} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-red-500 hover:text-red-700 shrink-0"
                          disabled={isSubmitting}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormRow>
          </div>

          {/* ═══════ 개인정보 ═══════ */}
          <h2 className="text-base font-bold mb-2">개인정보</h2>
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-8">
            {/* 비밀번호 */}
            <FormRow label="비밀번호" required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass + ' max-w-[300px]'}
                disabled={isSubmitting}
              />
            </FormRow>

            {/* 개인정보 수집 및 이용 동의 */}
            <FormRow label="개인정보 수집 및 이용 동의" required>
              <div className="flex flex-col gap-3">
                <div className="border border-gray-200 p-3 max-h-[120px] overflow-y-auto text-xs text-gray-600">
                  <p className="font-medium mb-1">■ 개인정보의 수집·이용 목적</p>
                  <p>서비스 제공 및 계약의 이행, 구매 및 대금결제, 물품배송 또는 청구지 발송, 회원관리 등을 위한 목적</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                  <span>개인정보 수집 및 이용에 동의하십니까?</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="consent"
                      checked={consent === 'agree'}
                      onChange={() => setConsent('agree')}
                      className="accent-black"
                      disabled={isSubmitting}
                    />
                    동의함
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="consent"
                      checked={consent === 'disagree'}
                      onChange={() => setConsent('disagree')}
                      className="accent-black"
                      disabled={isSubmitting}
                    />
                    동의안함
                  </label>
                </div>
              </div>
            </FormRow>
          </div>

          {/* ═══════ Footer Buttons ═══════ */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.replace('/inquiries')}
              className="px-8 py-3 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition"
              disabled={isSubmitting}
            >
              목록
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 text-sm bg-[#3B55A5] text-white rounded-lg hover:bg-[#2f4584] transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-3 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition"
              disabled={isSubmitting}
            >
              취소
            </button>
          </div>
        </form>
      </div>

      {/* Product Selection Modal */}
      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleProductsConfirm}
        initialSelectedProducts={selectedProducts}
      />
    </div>
  );
}

export default function NewInquiryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InquiryForm />
    </Suspense>
  );
}
