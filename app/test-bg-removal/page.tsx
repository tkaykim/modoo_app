'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BackgroundRemovalFlow,
  clearBackgroundRemovalCache,
  preloadBackgroundRemoval,
  type DesignerRequestPayload,
  type FlowResult,
  type ModelKey,
} from '@/app/components/background-removal/BackgroundRemovalFlow';

type DemoMode = 'page' | 'modal';
type ForceModel = ModelKey | 'auto';
type AppliedImage = {
  url: string;
  usedRemoval: boolean;
  attempts: number;
  designerPending: boolean;
};

const checkerStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
  backgroundColor: '#fff',
};

export default function TestBgRemovalPage() {
  const [mode, setMode] = useState<DemoMode>('page');
  const [forceModel, setForceModel] = useState<ForceModel>('auto');
  const [chromaTolerance, setChromaTolerance] = useState(8);
  const [devInfo, setDevInfo] = useState<string>('');

  const flowProps = {
    forceModel: forceModel === 'auto' ? undefined : forceModel,
    chromaTolerance,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">배경 제거 통합 데모</h1>
        <p className="mt-1 text-sm text-gray-500">
          실제 prod 도입 전, 사용자 흐름을 두 가지 통합 시나리오로 미리 경험해보세요.
        </p>
      </header>

      <div className="mb-8 inline-flex rounded-full border bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('page')}
          className={`rounded-full px-4 py-1.5 transition ${
            mode === 'page' ? 'bg-black text-white' : 'text-gray-700'
          }`}
        >
          단독 페이지
        </button>
        <button
          type="button"
          onClick={() => setMode('modal')}
          className={`rounded-full px-4 py-1.5 transition ${
            mode === 'modal' ? 'bg-black text-white' : 'text-gray-700'
          }`}
        >
          에디터 안 모달
        </button>
      </div>

      {mode === 'page' ? <PageDemo {...flowProps} /> : <ModalDemo {...flowProps} />}

      <DevPanel
        forceModel={forceModel}
        setForceModel={setForceModel}
        chromaTolerance={chromaTolerance}
        setChromaTolerance={setChromaTolerance}
        info={devInfo}
        onPrefetch={async () => {
          setDevInfo('prefetch 시작…');
          const m = forceModel === 'auto' ? 'isnet_quint8' : forceModel;
          await preloadBackgroundRemoval(m);
          setDevInfo(`prefetch 완료 (${m})`);
        }}
        onClearCache={async () => {
          setDevInfo('캐시 삭제 중…');
          const r = await clearBackgroundRemovalCache();
          setDevInfo(`캐시 삭제 — ${r}. 새로고침 후 다시 다운로드됩니다.`);
        }}
      />
      <IntegrationGuide />
    </div>
  );
}

// =====================================================================
// Demo 1: Standalone page (own dedicated route, e.g. /tools/bg-remove)
// =====================================================================

type FlowOverrides = { forceModel?: ModelKey; chromaTolerance: number };

function PageDemo({ forceModel, chromaTolerance }: FlowOverrides) {
  const [applied, setApplied] = useState<AppliedImage | null>(null);
  const [key, setKey] = useState(0);

  function handleComplete(r: FlowResult) {
    const url = URL.createObjectURL(r.blob);
    setApplied({
      url,
      usedRemoval: r.usedRemoval,
      attempts: r.attempts,
      designerPending: !!r.designerPending,
    });
  }

  function reset() {
    if (applied) URL.revokeObjectURL(applied.url);
    setApplied(null);
    setKey((k) => k + 1);
  }

  if (applied) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-700">
            <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">
          {applied.designerPending ? '캔버스에 자리 잡아두었어요' : '디자인에 추가되었어요'}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {applied.designerPending
            ? '디자이너 작업이 완료되면 깨끗한 이미지로 자동 교체됩니다'
            : applied.usedRemoval
              ? `배경을 정리한 이미지로 적용 (시도 ${applied.attempts}회)`
              : '원본 이미지 그대로 적용'}
        </p>
        <div className="relative mx-auto my-5 aspect-video max-w-md overflow-hidden rounded-xl border bg-gray-50">
          <div className="flex h-full items-center justify-center" style={checkerStyle}>
            <img
              src={applied.url}
              alt="추가된 이미지"
              className={`max-h-full max-w-full object-contain ${
                applied.designerPending ? 'opacity-50' : ''
              }`}
            />
          </div>
          {applied.designerPending && (
            <>
              <div className="pointer-events-none absolute inset-0 ring-2 ring-amber-500" />
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-white shadow">
                디자이너 작업 중
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium"
        >
          처음부터 다시
        </button>
      </div>
    );
  }

  return (
    <BackgroundRemovalFlow
      key={key}
      forceModel={forceModel}
      chromaTolerance={chromaTolerance}
      onComplete={handleComplete}
      onDesignerRequest={async (p) => {
        console.log('[demo] designer request', p);
      }}
    />
  );
}

// =====================================================================
// Demo 2: Editor-integrated modal (mimics real editor toolbar)
// =====================================================================

type CanvasItem = {
  id: number;
  url: string;
  usedRemoval: boolean;
  designerPending: boolean;
};

function ModalDemo({ forceModel, chromaTolerance }: FlowOverrides) {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  function log(msg: string) {
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} · ${msg}`, ...prev].slice(0, 8));
  }

  function onClickAddImage() {
    log('이미지 추가 버튼 클릭 — 파일 선택창 열림');
    fileInputRef.current?.click();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    log(`파일 선택: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
    setPickedFile(f);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setPickedFile(null);
  }

  function onComplete(r: FlowResult) {
    const url = URL.createObjectURL(r.blob);
    const id = ++idRef.current;
    setItems((prev) => [
      ...prev,
      { id, url, usedRemoval: r.usedRemoval, designerPending: !!r.designerPending },
    ]);
    log(
      r.designerPending
        ? '캔버스 추가 (디자이너 작업 중 placeholder)'
        : r.usedRemoval
          ? `캔버스 추가 (배경 제거됨, ${r.attempts}회 시도)`
          : '캔버스 추가 (원본 그대로)',
    );
    closeModal();
  }

  function simulateDesignerDelivery(id: number) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, designerPending: false, usedRemoval: true } : it)),
    );
    log(`디자이너 작업 결과 도착 → placeholder 교체 (id=${id})`);
  }

  function onDesignerRequest(p: DesignerRequestPayload) {
    log(`디자이너 요청 접수: ${p.name} / ${p.contact}`);
    // In prod: POST to /api/designer-request with file upload
  }

  function removeItem(id: number) {
    setItems((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  // Prefetch on hover/focus of "이미지 추가" — mimics "디자인하기" prefetch timing
  function onAddImageHover() {
    void preloadBackgroundRemoval();
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        가짜 에디터 화면입니다. 우상단 <strong>&quot;이미지 추가&quot;</strong> 버튼을 눌러 실제 통합 흐름을 경험해보세요.
        버튼에 커서를 올리면 백그라운드 prefetch가 시작됩니다.
      </div>

      {/* Mock editor surface */}
      <div className="overflow-hidden rounded-2xl border bg-gray-100">
        <div className="flex items-center justify-between border-b bg-white px-4 py-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">티셔츠 디자이너</span>
            <span className="text-xs text-gray-400">앞면</span>
          </div>
          <div className="flex items-center gap-1">
            <MockTool icon="T" label="텍스트" />
            <button
              type="button"
              onClick={onClickAddImage}
              onMouseEnter={onAddImageHover}
              onFocus={onAddImageHover}
              className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="M21 15l-5-5-9 9" />
              </svg>
              이미지 추가
            </button>
            <MockTool icon="◇" label="도형" />
          </div>
        </div>

        <div className="relative flex aspect-video items-center justify-center bg-gray-50 p-8">
          <div
            className="relative h-full w-full max-w-lg rounded-2xl border-2 border-dashed border-gray-300"
            style={checkerStyle}
          >
            {items.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 text-xs text-gray-400">
                여기에 이미지가 추가됩니다 · 투명 영역은 체커보드로 표시돼요
              </div>
            )}
            {items.map((it, idx) => (
              <div
                key={it.id}
                className="absolute"
                style={{
                  top: `${20 + idx * 18}%`,
                  left: `${15 + idx * 18}%`,
                  width: '40%',
                  height: '40%',
                }}
              >
                <div className="group relative h-full w-full overflow-hidden">
                  <img
                    src={it.url}
                    alt=""
                    className={`h-full w-full object-contain ${
                      it.designerPending ? 'opacity-50' : ''
                    }`}
                  />
                  {it.designerPending && (
                    <>
                      <div className="pointer-events-none absolute inset-0 ring-2 ring-amber-500 ring-offset-1" />
                      <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white shadow">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        디자이너 작업 중
                      </div>
                      <button
                        type="button"
                        onClick={() => simulateDesignerDelivery(it.id)}
                        className="absolute bottom-1 left-1/2 hidden -translate-x-1/2 rounded-full bg-black/80 px-2 py-0.5 text-[10px] text-white group-hover:block"
                      >
                        결과 도착 시뮬레이션
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white group-hover:flex"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />

      {/* Event log */}
      <div className="mt-4 rounded-lg border bg-white p-3 text-xs">
        <div className="mb-1 font-semibold text-gray-700">이벤트 로그</div>
        {eventLog.length === 0 ? (
          <div className="text-gray-400">아직 이벤트 없음</div>
        ) : (
          <ul className="space-y-0.5 font-mono text-gray-600">
            {eventLog.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      {/* The actual modal */}
      {modalOpen && pickedFile && (
        <Modal onClose={closeModal} title="이미지 추가하기">
          <BackgroundRemovalFlow
            initialFile={pickedFile}
            forceModel={forceModel}
            chromaTolerance={chromaTolerance}
            onComplete={onComplete}
            onCancel={closeModal}
            onDesignerRequest={onDesignerRequest}
          />
        </Modal>
      )}
    </div>
  );
}

function MockTool({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-400"
    >
      <span className="font-mono">{icon}</span>
      {label}
    </button>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
        <h2 className="mb-4 pr-8 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// =====================================================================
// Dev panel — fine-grained controls (tolerance, force model, prefetch)
// =====================================================================

function DevPanel({
  forceModel,
  setForceModel,
  chromaTolerance,
  setChromaTolerance,
  info,
  onPrefetch,
  onClearCache,
}: {
  forceModel: ForceModel;
  setForceModel: (m: ForceModel) => void;
  chromaTolerance: number;
  setChromaTolerance: (n: number) => void;
  info: string;
  onPrefetch: () => void;
  onClearCache: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => e.currentTarget.open !== open && setOpen(e.currentTarget.open)}
      className="mt-8 rounded-lg border bg-gray-50 px-4 py-3 text-xs"
    >
      <summary className="cursor-pointer select-none font-mono text-gray-600">
        ⚙ developer mode — 모델 / 임계값 / prefetch
      </summary>
      <div className="mt-3 space-y-4 text-gray-700">
        <div>
          <div className="mb-1 font-semibold">모델 강제 지정</div>
          <div className="flex flex-wrap gap-1">
            {(['auto', 'isnet_quint8', 'isnet_fp16', 'isnet'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForceModel(m)}
                className={`rounded border px-2 py-0.5 font-mono ${
                  forceModel === m
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            <code>auto</code>: 시도마다 quint8 → fp16 → isnet 자동 escalation. 그 외: 모든 시도에 같은 모델 사용.
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-semibold">chroma-key 허용오차 (tolerance)</span>
            <span className="font-mono tabular-nums">{chromaTolerance}</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={chromaTolerance}
            onChange={(e) => setChromaTolerance(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 text-[11px] text-gray-500">
            단색 배경 감지 시 어디까지 배경으로 간주할지. 5~8 권장. 키우면 더 많은 픽셀이 배경으로
            처리됨(피사체까지 사라질 수 있음).
          </div>
        </div>

        <div>
          <div className="mb-1 font-semibold">캐시 / prefetch</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPrefetch}
              className="rounded border border-gray-300 bg-white px-2 py-1"
            >
              지금 prefetch
            </button>
            <button
              type="button"
              onClick={onClearCache}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-red-700"
            >
              모델 캐시 삭제
            </button>
          </div>
          {info && <div className="mt-2 font-mono text-[11px] text-gray-600">{info}</div>}
        </div>
      </div>
    </details>
  );
}

// =====================================================================
// Integration guide (developer-facing reference at bottom of page)
// =====================================================================

function IntegrationGuide() {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => e.currentTarget.open !== open && setOpen(e.currentTarget.open)}
      className="mt-12 rounded-lg border bg-gray-50 px-4 py-3 text-xs"
    >
      <summary className="cursor-pointer select-none font-mono text-gray-600">
        🛠 prod 통합 가이드 (개발자)
      </summary>
      <div className="mt-3 space-y-3 text-gray-700">
        <p>
          <strong>재사용 컴포넌트 위치:</strong>{' '}
          <code className="rounded bg-white px-1.5 py-0.5">
            app/components/background-removal/BackgroundRemovalFlow.tsx
          </code>
        </p>
        <div>
          <strong>모달로 띄우는 흐름 (Toolbar.tsx 패턴):</strong>
          <pre className="mt-1 overflow-x-auto rounded bg-white p-3 font-mono text-[11px] leading-relaxed">{`// 1) 파일 선택 → convertToPNG 까지 기존 흐름 유지
const file = await pickAndConvert(); // 기존 lib/imageConvert

// 2) 배경제거 모달 오픈 — initialFile 로 전달
setBgRemovalFile(file);
setBgModalOpen(true);

// 3) onComplete 에서 기존 업로드/canvas 추가 흐름으로 이어가기
<BackgroundRemovalFlow
  initialFile={bgRemovalFile}
  onComplete={async ({ blob, usedRemoval, designerPending }) => {
    const finalFile = new File([blob], 'image.png', { type: 'image/png' });
    const url = await uploadToSupabase(finalFile);
    const fabricImg = await addImageToCanvas(url);   // 기존 fabric.FabricImage.fromURL
    if (designerPending) {
      // 메타데이터로 식별 → 디자이너 결과 도착 시 fabric 객체를 찾아 교체
      fabricImg.set({ data: { designerJobId, designerPending: true }, opacity: 0.5 });
      // 시각 표식: 노란 테두리 + 디자이너 배지(별도 fabric 그룹으로 추가)
    }
    setBgModalOpen(false);
  }}
  onCancel={() => setBgModalOpen(false)}
  onDesignerRequest={async (payload) => {
    await fetch('/api/designer-request', { method: 'POST', body: ... });
  }}
/>`}</pre>
        </div>
        <div>
          <strong>Prefetch 시점:</strong> 사용자가 디자인 화면에 진입하거나 &quot;이미지 추가&quot; 버튼에 hover/focus 할 때
          <pre className="mt-1 overflow-x-auto rounded bg-white p-3 font-mono text-[11px]">{`import { preloadBackgroundRemoval } from '@/app/components/background-removal/BackgroundRemovalFlow';

// 디자인하기 진입 시
useEffect(() => { void preloadBackgroundRemoval(); }, []);`}</pre>
        </div>
        <ul className="list-disc pl-5">
          <li>
            <strong>modoo_app 에디터</strong>: <code>app/components/canvas/Toolbar.tsx</code> 의{' '}
            <code>handleAddImageClick → addImage</code> 사이에 모달 삽입.{' '}
            <code>convertToPNG</code> 직후 / Supabase 업로드 직전이 적절.
          </li>
          <li>
            <strong>modoo_admin</strong>: 어드민 에디터에도 동일 컴포넌트를 그대로 import 해서 재사용.
            (CLAUDE.md 메모리: 신규 라우트 사용 시 useAdminAuth 화이트리스트 등록 필요)
          </li>
          <li>
            <strong>API</strong>: <code>onDesignerRequest</code> 핸들러에서 file + 메타데이터를
            업로드하고 별도 RPC/이메일/슬랙으로 디자인팀에 전달. 응답으로 받은{' '}
            <code>designerJobId</code>를 fabric 객체에 저장해두면 결과 도착 시 교체할 때
            식별자로 사용 가능.
          </li>
          <li>
            <strong>디자이너 작업 중 placeholder</strong>:{' '}
            <code>onComplete</code>가 <code>designerPending: true</code>로 호출되면 원본 이미지가
            placeholder로 캔버스에 올라옴. fabric 객체에{' '}
            <code>data.designerPending = true</code> 저장 + opacity 50% + 외곽선/배지 표시.
            저장(serialization) 시에도 이 메타데이터 보존 필요.
          </li>
          <li>
            <strong>결과 교체 흐름</strong>: 디자이너가 작업한 PNG를 백엔드에서 알림(웹훅 또는 polling).
            클라이언트는 캔버스에서 <code>data.designerJobId</code>가 일치하는 fabric 객체를 찾아{' '}
            <code>setSrc(newUrl)</code>로 교체하고 placeholder 표식 제거. 위치/크기/회전은 그대로
            유지되어 고객이 미리 잡아둔 레이아웃을 다시 작업하지 않아도 됨.
          </li>
        </ul>
      </div>
    </details>
  );
}
