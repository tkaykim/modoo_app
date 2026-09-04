'use client';

/**
 * AI 디자이너 — 과잠(바시티 자켓 등 부위별 색상 상품) 디자이너 상담 접수 화면.
 *
 * 부위별 색·엠블럼·학번·명단처럼 위저드가 아직 자동으로 못 다루는 항목을 한 화면에서 받아
 * 기존 문의(inquiries) 경로로 넘긴다. 디자이너가 시안과 견적을 만들어 회신하고,
 * 이후 시안 확인·결제는 기존 흐름을 그대로 쓴다.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileUp, Loader2, Palette, Sparkles, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { trackGenerateLead } from '@/lib/gtm-events';
import { getQuantityRange } from '@/lib/gtm';
import type { PartLayerSide } from '@/lib/aiDesigner/catalogTypes';

const ELEMENT_OPTIONS = [
  { key: 'front-left-emblem', label: '왼쪽 가슴 엠블럼·로고', defaultOn: true },
  { key: 'front-right-number', label: '오른쪽 가슴 학번', defaultOn: true },
  { key: 'back-arch-name', label: '등판 학교·학과명 (아치형)', defaultOn: true },
  { key: 'back-emblem', label: '등판 엠블럼', defaultOn: false },
  { key: 'sleeve-initial', label: '소매 학번·이니셜', defaultOn: false },
] as const;

const MAX_FILES = 5;
const CONSENT_TEXT =
  '개인정보 수집 및 이용에 동의합니다. 입력하신 이름, 연락처 정보는 상담 및 시안·견적 안내 목적으로만 사용됩니다.';

interface UploadedFile {
  url: string;
  path: string;
  name: string;
}

/** 받침 유무에 따라 '은/는' 조사를 고른다 (한글이 아니면 '은(는)'). */
function topicJosa(word: string): string {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return /[0-9]$/.test(ch) ? '은' : '은(는)';
  return (code - 0xac00) % 28 === 0 ? '는' : '은';
}

function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

/** 레이어 PNG를 선택 색으로 물들인 간이 착장 미리보기 (에디터의 multiply 틴팅과 같은 원리) */
function PartColorPreview({ side, colors }: { side: PartLayerSide; colors: Record<string, string> }) {
  const layers = [...side.layers].filter((l) => !!l.imageUrl).sort((a, b) => a.zIndex - b.zIndex);
  if (layers.length === 0) return null;
  const ratio = side.imgW > 0 && side.imgH > 0 ? side.imgH / side.imgW : 614 / 508;
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden bg-[#f4f4f5] border border-gray-100"
      style={{ paddingTop: `${Math.min(ratio, 1.4) * 100}%` }}
      aria-label={`${side.sideName} 색상 미리보기`}
    >
      {layers.map((l) => {
        const hex = colors[l.id] || l.colorOptions[0]?.hex || '#ffffff';
        const mask = `url("${l.imageUrl}")`;
        return (
          <div
            key={l.id}
            className="absolute inset-0"
            style={{
              isolation: 'isolate',
              backgroundColor: hex,
              WebkitMaskImage: mask,
              maskImage: mask,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.imageUrl ?? ''}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{ mixBlendMode: 'multiply' }}
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function VarsityIntake({
  product,
  partLayers,
  presetLayerColors,
  sessionId,
  onBack,
}: {
  product: { id: string; title: string; base_price: number };
  partLayers: PartLayerSide[];
  presetLayerColors: Record<string, Record<string, string>> | null;
  sessionId: string | null;
  onBack: () => void;
}) {
  const { user, isAuthenticated } = useAuthStore();

  // 색을 고르는 기준 면 = 레이어가 가장 많은 면(보통 앞면). 같은 부위는 뒷면에도 같은 색을 적용한다.
  const primarySide = useMemo(
    () => [...partLayers].sort((a, b) => b.layers.length - a.layers.length)[0],
    [partLayers]
  );
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (!primarySide) return init;
    const preset = presetLayerColors?.[primarySide.sideId] ?? null;
    for (const l of primarySide.layers) {
      const presetHex = preset?.[l.id];
      const allowed = l.colorOptions.some((c) => c.hex.toLowerCase() === (presetHex ?? '').toLowerCase());
      init[l.id] = allowed && presetHex ? presetHex : (l.colorOptions[0]?.hex ?? '#ffffff');
    }
    return init;
  });

  const [schoolName, setSchoolName] = useState('');
  const [backText, setBackText] = useState('');
  const [elements, setElements] = useState<Set<string>>(
    () => new Set(ELEMENT_OPTIONS.filter((o) => o.defaultOn).map((o) => o.key))
  );
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [roster, setRoster] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [qtyTouched, setQtyTouched] = useState(false);
  const [desiredDate, setDesiredDate] = useState('');
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [kakaoId, setKakaoId] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ inquiryId: string; isMember: boolean } | null>(null);

  const rosterLines = useMemo(
    () => roster.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    [roster]
  );
  const totalQty = qtyTouched ? parseInt(qtyInput, 10) || 0 : rosterLines.length;

  const toggleElement = (key: string) =>
    setElements((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      setError(`파일은 최대 ${MAX_FILES}개까지 올릴 수 있습니다.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(list).slice(0, remaining).forEach((f) => fd.append('files', f));
      const res = await fetch('/api/inquiries/files/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '파일 업로드에 실패했습니다.');
      if (Array.isArray(data.files)) setFiles((prev) => [...prev, ...data.files].slice(0, MAX_FILES));
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!schoolName.trim()) return setError('학교·학과명을 입력해 주세요.');
    if (totalQty < 1) return setError('총 수량을 입력해 주세요.');
    if (!contactName.trim()) return setError('담당자 이름을 입력해 주세요.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('이메일 형식을 확인해 주세요.');
    if (!isAuthenticated && password.trim().length < 4) return setError('접수 조회용 비밀번호를 4자 이상 입력해 주세요.');
    if (!consent) return setError('개인정보 수집 및 이용에 동의해 주세요.');

    setSubmitting(true);
    try {
      const partColors = primarySide
        ? primarySide.layers.map((l) => {
            const hex = colors[l.id] ?? '';
            const opt = l.colorOptions.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
            return { layerId: l.id, layerName: l.name, hex, colorName: opt?.name ?? '' };
          })
        : [];
      const res = await fetch('/api/ai-designer/varsity-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          productId: product.id,
          partColors,
          schoolName: schoolName.trim(),
          backText: backText.trim(),
          elements: ELEMENT_OPTIONS.filter((o) => elements.has(o.key)).map((o) => o.label),
          roster,
          totalQty,
          desiredDate: desiredDate || undefined,
          note: note.trim(),
          contact: { name: contactName.trim(), email: email.trim(), phone: phone.trim(), kakaoId: kakaoId.trim() },
          password: password.trim() || undefined,
          fileUrls: files.map((f) => f.url),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '접수에 실패했습니다.');
      trackGenerateLead({
        form_type: 'quote',
        quantity_range: getQuantityRange(totalQty),
        desired_date: desiredDate || undefined,
        product_count: 1,
      });
      setDone({ inquiryId: data.inquiryId, isMember: !!data.isMember });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : '접수에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="py-6" data-testid="varsity-intake-done">
        <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-brand" aria-hidden />
          <h1 className="mt-3 text-xl font-black text-gray-900">과잠 상담 접수가 완료됐어요</h1>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            디자이너가 부위 색상·엠블럼·학번 배치를 확인해 시안과 견적을 만들어 드립니다.
            <br />
            보통 1영업일 안에 이메일 또는 카카오톡으로 안내드려요.
          </p>
          <p className="mt-3 text-[11px] text-gray-400">접수번호 {done.inquiryId.slice(0, 8).toUpperCase()}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={done.isMember ? '/inquiries' : '/inquiries/lookup'}
              className="w-full py-3 rounded-xl bg-brand text-white text-sm font-bold"
            >
              {done.isMember ? '내 문의 내역 보기' : '접수 내역 조회하기'}
            </Link>
            <Link href="/home" className="w-full py-3 rounded-xl bg-gray-100 text-gray-800 text-sm font-bold">
              홈으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="varsity-intake">
      <div className="rounded-2xl bg-brand-softer border border-brand-soft px-4 py-4">
        <div className="flex items-center gap-1.5 text-brand text-xs font-bold">
          <Sparkles className="w-4 h-4" aria-hidden /> 디자이너 상담 접수
        </div>
        <h1 className="mt-1.5 text-lg font-black text-gray-900 leading-snug [word-break:keep-all]">
          {product.title}{topicJosa(product.title)} 부위별 색상·엠블럼·학번이 많아
          <br />
          디자이너가 함께 잡아 드려요
        </h1>
        <p className="mt-1.5 text-[13px] text-gray-600 leading-relaxed">
          아래 항목만 남겨 주시면 시안과 견적을 만들어 보내드립니다. 결제는 시안 확인 후 진행돼요.
        </p>
      </div>

      {error && <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* 1. 부위별 색상 */}
      {primarySide && (
        <div className="mt-5">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-brand" aria-hidden /> 1. 부위별 색상
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">몸통·팔·쉬보리 색을 각각 고르세요. 같은 부위는 뒷면에도 똑같이 적용됩니다.</p>
          <div className="mt-3 grid grid-cols-[112px_1fr] gap-3 items-start">
            <PartColorPreview side={primarySide} colors={colors} />
            <div className="space-y-2.5">
              {[...primarySide.layers].sort((a, b) => a.zIndex - b.zIndex).map((l) => (
                <div key={l.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-800">{l.name}</span>
                    <span className="text-[11px] text-gray-500">
                      {l.colorOptions.find((c) => c.hex.toLowerCase() === (colors[l.id] ?? '').toLowerCase())?.name ?? ''}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {l.colorOptions.map((c) => {
                      const active = (colors[l.id] ?? '').toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={`${l.id}-${c.hex}`}
                          type="button"
                          onClick={() => setColors((prev) => ({ ...prev, [l.id]: c.hex }))}
                          aria-label={`${l.name} ${c.name}`}
                          aria-pressed={active}
                          className={`w-7 h-7 rounded-full border-2 transition ${
                            active ? 'border-brand scale-110' : isLightHex(c.hex) ? 'border-gray-300' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. 학교·학과명 + 넣을 요소 */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-gray-900">2. 학교·학과명과 넣을 요소</h2>
        <input
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder="예) 모두대학교 디자인학과"
          aria-label="학교·학과명"
          className="mt-2 w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ELEMENT_OPTIONS.map((o) => {
            const on = elements.has(o.key);
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => toggleElement(o.key)}
                aria-pressed={on}
                className={`px-3 h-8 rounded-full text-[12px] font-semibold border transition ${
                  on ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={backText}
          onChange={(e) => setBackText(e.target.value)}
          placeholder="등판 문구 (선택) 예) MODOO UNIV. / 2026"
          aria-label="등판 문구"
          className="mt-2.5 w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
      </div>

      {/* 3. 엠블럼·로고 파일 */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-gray-900">3. 엠블럼·로고 파일</h2>
        <p className="text-xs text-gray-500 mt-0.5">이미지·PDF·AI 파일, 최대 {MAX_FILES}개. 없으면 비워 두셔도 됩니다.</p>
        <label className="mt-2 flex items-center justify-center gap-2 h-12 rounded-xl border border-dashed border-gray-300 bg-white text-sm font-semibold text-gray-700 cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FileUp className="w-4 h-4" aria-hidden />}
          {uploading ? '업로드 중…' : '파일 올리기'}
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.ai"
            hidden
            disabled={uploading || files.length >= MAX_FILES}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={f.path} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100 text-xs text-gray-700">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`${f.name} 삭제`}
                  className="shrink-0 text-gray-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4. 명단·수량 */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-gray-900">4. 학번·이름 명단과 수량</h2>
        <p className="text-xs text-gray-500 mt-0.5">한 줄에 한 명씩 이름·학번·사이즈를 적어 주세요. 엑셀에서 복사해 붙여넣어도 됩니다.</p>
        <textarea
          value={roster}
          onChange={(e) => setRoster(e.target.value)}
          placeholder={'홍길동 24 M\n김민지 25 L'}
          rows={5}
          aria-label="학번·이름 명단"
          className="mt-2 w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
        />
        <div className="mt-2 flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-700">총 수량</label>
          <input
            type="number"
            min={1}
            value={qtyTouched ? qtyInput : rosterLines.length || ''}
            onChange={(e) => {
              setQtyTouched(true);
              setQtyInput(e.target.value);
            }}
            placeholder="0"
            aria-label="총 수량"
            className="w-24 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-right outline-none focus:border-brand"
          />
          <span className="text-xs text-gray-500">장{rosterLines.length > 0 && ` · 명단 ${rosterLines.length}명`}</span>
        </div>
      </div>

      {/* 5. 희망일·연락처 */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-gray-900">5. 희망일과 연락처</h2>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <input
            type="date"
            value={desiredDate}
            onChange={(e) => setDesiredDate(e.target.value)}
            aria-label="착용 희망일"
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
          />
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="담당자 이름 *"
            aria-label="담당자 이름"
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 *"
            aria-label="이메일"
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호 (선택)"
              aria-label="전화번호"
              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
            />
            <input
              type="text"
              value={kakaoId}
              onChange={(e) => setKakaoId(e.target.value)}
              placeholder="카카오톡 ID (선택)"
              aria-label="카카오톡 ID"
              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
            />
          </div>
          {!isAuthenticated && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="접수 조회용 비밀번호 (4자 이상) *"
              aria-label="접수 조회용 비밀번호"
              className="w-full h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
            />
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="추가 요청 (선택) 예) 엠블럼은 자수로, 등판은 학과 마스코트 넣고 싶어요"
            rows={3}
            aria-label="추가 요청"
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-brand"
          />
        </div>
        <label className="mt-3 flex items-start gap-2 text-[12px] text-gray-600 leading-relaxed">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold text-red-500">[필수]</span> {CONSENT_TEXT}
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || uploading}
          className="w-full py-3.5 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Sparkles className="w-4 h-4" aria-hidden />}
          {submitting ? '접수 중…' : '디자이너 상담 접수하기'}
        </button>
        <button type="button" onClick={onBack} className="w-full py-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold">
          다른 옷 고르기
        </button>
      </div>
    </section>
  );
}
