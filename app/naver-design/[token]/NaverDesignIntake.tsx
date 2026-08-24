'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProductDesigner from '@/app/components/canvas/ProductDesigner';
import { createClient } from '@/lib/supabase-client';
import type { UploadResult } from '@/lib/supabase-storage';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { ProductConfig, ProductSide } from '@/types/types';
import { Check, ChevronRight, FileWarning, Loader2, Save, Shirt } from 'lucide-react';

type DesignJob = {
  id: string;
  local_product_id: string | null;
  color_code: string | null;
  product_name: string;
  option_summary: string | null;
  quantity: number;
  status: string;
  canvas_state: Record<string, string>;
  product_color: string | null;
  customer_note: string | null;
  submitted_at: string | null;
  product: { id: string; title: string; configuration: ProductSide[] } | null;
  selectedColor: { name: string; hex: string; color_code: string } | null;
};

type IntakePayload = {
  session: {
    naver_order_id: string;
    buyer_name: string | null;
    status: string;
    job_count: number;
    submitted_job_count: number;
  };
  jobs: DesignJob[];
};

const STATUS_LABEL: Record<string, string> = {
  needs_mapping: '상품 연결 확인 중',
  draft: '디자인 시작 전',
  in_progress: '작성 중',
  submitted: '접수 완료',
  reviewed: '담당자 확인 완료',
  revision_requested: '수정 요청',
  approved: '디자인 확정',
  cancelled: '취소됨',
};

export default function NaverDesignIntake({ token }: { token: string }) {
  const [payload, setPayload] = useState<IntakePayload | null>(null);
  const [activeJob, setActiveJob] = useState<DesignJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [customerNote, setCustomerNote] = useState('');
  const restoredJobId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const {
    canvasVersion,
    productColor,
    saveAllCanvasState,
    restoreAllCanvasState,
    resetCanvasState,
    setActiveSide,
    setEditMode,
    setProductColor,
  } = useCanvasStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/naver-design/${encodeURIComponent(token)}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || '디자인 접수 정보를 불러오지 못했습니다.');
      setLoading(false);
      return;
    }
    setPayload(body);
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const config = useMemo<ProductConfig | null>(() => {
    if (!activeJob?.product?.configuration?.length) return null;
    return { productId: activeJob.product.id, sides: activeJob.product.configuration };
  }, [activeJob]);

  const persist = useCallback((submit = false): Promise<boolean> => {
    if (!activeJob || !config) return Promise.resolve(false);
    const jobId = activeJob.id;
    const requestBody = {
      canvasState: saveAllCanvasState(),
      productColor,
      customerNote,
      submit,
    };
    const operation = saveQueue.current.then(async () => {
      setSaveState('saving');
      setError(null);
      try {
        const response = await fetch(`/api/naver-design/${encodeURIComponent(token)}/jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setSaveState('error');
          setError(body.error || '디자인을 저장하지 못했습니다.');
          return false;
        }
        setSaveState('saved');
        setActiveJob((current) => current?.id === jobId ? { ...current, status: body.data.status, submitted_at: body.data.submittedAt } : current);
        return true;
      } catch {
        setSaveState('error');
        setError('네트워크 연결을 확인한 뒤 다시 저장해 주세요.');
        return false;
      }
    });
    saveQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [activeJob, config, customerNote, productColor, saveAllCanvasState, token]);

  useEffect(() => {
    if (!activeJob || !config || restoredJobId.current !== activeJob.id || canvasVersion === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(false); }, 2500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [activeJob, canvasVersion, config, persist]);

  useEffect(() => {
    if (!activeJob || !config || restoredJobId.current === activeJob.id) return;
    let cancelled = false;
    const prepare = async () => {
      setActiveSide(config.sides[0].id);
      setProductColor(activeJob.product_color || activeJob.selectedColor?.hex || '#FFFFFF');
      setCustomerNote(activeJob.customer_note || '');
      setEditMode(true);
      for (let attempt = 0; attempt < 80 && !cancelled; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const store = useCanvasStore.getState();
        const ready = config.sides.every((side) => store.canvasMap[side.id] && store.imageLoadedMap[side.id]);
        if (!ready) continue;
        if (activeJob.canvas_state && Object.keys(activeJob.canvas_state).length > 0) {
          await restoreAllCanvasState(activeJob.canvas_state);
        }
        restoredJobId.current = activeJob.id;
        setEditMode(true);
        return;
      }
      if (!cancelled) setError('편집기를 준비하지 못했습니다. 페이지를 새로고침해 주세요.');
    };
    void prepare();
    return () => { cancelled = true; };
  }, [activeJob, config, restoreAllCanvasState, setActiveSide, setEditMode, setProductColor]);

  const uploadFile = useCallback(async (file: File, assetKind: 'original' | 'processed'): Promise<UploadResult> => {
    if (!activeJob) return { success: false, error: '디자인 작업이 선택되지 않았습니다.' };
    const init = await fetch(`/api/naver-design/${encodeURIComponent(token)}/jobs/${activeJob.id}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, assetKind }),
    });
    const body = await init.json().catch(() => ({}));
    if (!init.ok) return { success: false, error: body.error || '업로드를 준비하지 못했습니다.' };
    const { path, signedToken, assetUrl } = body.data;
    const { error: uploadError } = await createClient().storage
      .from('naver-design-assets')
      .uploadToSignedUrl(path, signedToken, file, { contentType: file.type || 'application/octet-stream' });
    if (uploadError) return { success: false, error: uploadError.message };
    return { success: true, url: assetUrl, path };
  }, [activeJob, token]);

  const closeEditor = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const ok = await persist(false);
    if (!ok) return;
    restoredJobId.current = null;
    resetCanvasState();
    setActiveJob(null);
    await load();
  }, [load, persist, resetCanvasState]);

  const submit = useCallback(async () => {
    if (!window.confirm('현재 디자인을 담당자에게 접수할까요?')) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const ok = await persist(true);
    if (!ok) return;
    restoredJobId.current = null;
    resetCanvasState();
    setActiveJob(null);
    await load();
  }, [load, persist, resetCanvasState]);

  if (loading) return <StateCard icon={<Loader2 className="h-8 w-8 animate-spin" />} title="주문 정보를 불러오는 중입니다" />;
  if (error && !payload) return <StateCard icon={<FileWarning className="h-8 w-8" />} title={error} />;

  if (activeJob && config) {
    return (
      <main className="min-h-screen bg-[#EBEBEB]">
        <div className="fixed inset-x-0 top-11 z-90 flex min-h-14 items-center gap-2 border-b border-gray-200 bg-white/95 px-3 py-1.5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{activeJob.product_name}</p>
            <p className="truncate text-xs text-gray-500">{activeJob.option_summary || `${activeJob.quantity}개`}</p>
          </div>
          <span className="hidden text-xs text-gray-500 sm:inline">
            {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '자동 저장됨' : saveState === 'error' ? '저장 실패' : ''}
          </span>
          <button disabled={saveState === 'saving'} onClick={() => void persist(false)} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
            <Save className="h-4 w-4" /> 저장
          </button>
          <button disabled={saveState === 'saving'} onClick={() => void submit()} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
            <Check className="h-4 w-4" /> 접수
          </button>
        </div>
        {error && <div role="alert" className="fixed inset-x-3 top-[7.25rem] z-110 mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 shadow-lg">{error}</div>}
        <ProductDesigner
          config={config}
          layout="mobile"
          onExitEditMode={() => void closeEditor()}
          displayColor={activeJob.selectedColor?.name}
          hasColorOptions={false}
          uploadFile={uploadFile}
        />
        <div className="fixed inset-x-3 bottom-[calc(var(--editor-dock-bottom,7rem)+4.5rem)] z-40 mx-auto max-w-lg">
          <input
            value={customerNote}
            onChange={(event) => setCustomerNote(event.target.value)}
            placeholder="담당자에게 전달할 요청사항을 적어주세요"
            className="w-full rounded-xl border border-gray-300 bg-white/95 px-4 py-3 text-base shadow-lg outline-none focus:border-black"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f6f3] px-4 py-8 text-gray-900">
      <section className="mx-auto max-w-2xl">
        <div className="mb-8 rounded-3xl bg-black p-6 text-white shadow-xl">
          <p className="mb-2 text-sm text-white/60">네이버 주문 {payload?.session.naver_order_id}</p>
          <h1 className="text-2xl font-black">디자인 파일을 접수해 주세요</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">이미지와 텍스트를 직접 배치할 수 있으며 작업 내용은 자동으로 저장됩니다.</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#49d17d]" style={{ width: `${Math.round(((payload?.session.submitted_job_count || 0) / Math.max(payload?.session.job_count || 1, 1)) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/60">{payload?.session.submitted_job_count || 0} / {payload?.session.job_count || 0}개 접수 완료</p>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="space-y-3">
          {payload?.jobs.map((job) => {
            const unavailable = !job.product || job.status === 'needs_mapping';
            const submitted = ['submitted', 'reviewed', 'approved'].includes(job.status);
            return (
              <button
                key={job.id}
                disabled={unavailable || job.status === 'cancelled'}
                onClick={() => {
                  setError(null);
                  setSaveState('idle');
                  restoredJobId.current = null;
                  resetCanvasState();
                  setActiveJob(job);
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${submitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {submitted ? <Check className="h-6 w-6" /> : <Shirt className="h-6 w-6" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{job.product_name}</span>
                  <span className="mt-1 block truncate text-sm text-gray-500">{job.option_summary || `${job.quantity}개`}</span>
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${submitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {STATUS_LABEL[job.status] || job.status}
                  </span>
                </span>
                {!unavailable && <ChevronRight className="h-5 w-5 text-gray-400" />}
              </button>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs leading-5 text-gray-500">접수 후 담당자가 실제 인쇄 가능 여부와 위치를 확인해 안내드립니다.</p>
      </section>
    </main>
  );
}

function StateCard({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f6f3] px-4">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gray-100 text-gray-700">{icon}</div>
        <p className="font-bold text-gray-900">{title}</p>
      </div>
    </main>
  );
}
