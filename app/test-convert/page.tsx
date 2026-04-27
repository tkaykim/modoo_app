'use client';

import { useState } from 'react';

type ConversionState =
  | { kind: 'idle' }
  | { kind: 'working'; message: string }
  | { kind: 'done'; pngUrl: string; widthPx: number; heightPx: number; elapsedMs: number; engine: string }
  | { kind: 'error'; message: string };

const MAX_BYTES = 50 * 1024 * 1024;

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/png');
  });
}

async function convertPsd(file: File, onProgress: (m: string) => void): Promise<HTMLCanvasElement> {
  onProgress('PSD 파싱 중…');
  const { readPsd } = await import('ag-psd');
  const buf = await file.arrayBuffer();
  const psd = readPsd(buf, { skipLayerImageData: true, skipThumbnail: true });
  if (!psd.canvas) throw new Error('PSD에 합성된 이미지가 없습니다');
  return psd.canvas as HTMLCanvasElement;
}

async function convertAi(file: File, onProgress: (m: string) => void): Promise<HTMLCanvasElement> {
  onProgress('PDF 엔진 로딩 중…');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  onProgress('AI/PDF 첫 페이지 렌더링 중…');
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

export default function TestConvertPage() {
  const [state, setState] = useState<ConversionState>({ kind: 'idle' });
  const [filename, setFilename] = useState<string>('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    if (file.size > MAX_BYTES) {
      setState({ kind: 'error', message: `파일이 50MB를 초과합니다 (${(file.size / 1024 / 1024).toFixed(1)}MB)` });
      return;
    }

    const ext = getExtension(file.name);
    const start = performance.now();
    try {
      let canvas: HTMLCanvasElement;
      let engine: string;
      if (ext === 'psd') {
        engine = 'ag-psd';
        canvas = await convertPsd(file, (m) => setState({ kind: 'working', message: m }));
      } else if (ext === 'ai') {
        engine = 'pdfjs-dist';
        canvas = await convertAi(file, (m) => setState({ kind: 'working', message: m }));
      } else {
        setState({ kind: 'error', message: 'PSD 또는 AI 파일만 지원합니다.' });
        return;
      }

      setState({ kind: 'working', message: 'PNG 인코딩 중…' });
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      const elapsedMs = Math.round(performance.now() - start);
      setState({ kind: 'done', pngUrl: url, widthPx: canvas.width, heightPx: canvas.height, elapsedMs, engine });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>클라이언트 변환 테스트 (.psd / .ai)</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        ag-psd로 PSD를, pdfjs-dist로 AI를 브라우저에서 직접 PNG로 변환합니다. CloudConvert 미사용.
      </p>

      <input
        type="file"
        accept=".psd,.ai"
        onChange={handleFile}
        style={{ marginBottom: 24 }}
      />

      {filename && <div style={{ marginBottom: 12, color: '#444' }}>선택된 파일: <code>{filename}</code></div>}

      {state.kind === 'working' && (
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fafafa' }}>
          ⏳ {state.message}
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: 16, border: '1px solid #f5b3b3', borderRadius: 8, background: '#fff5f5', color: '#a33' }}>
          ❌ {state.message}
        </div>
      )}

      {state.kind === 'done' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12, color: '#444' }}>
            ✅ 완료 ({state.engine}, {state.widthPx}×{state.heightPx}px, {state.elapsedMs}ms)
          </div>
          <a
            href={state.pngUrl}
            download={(filename.replace(/\.[^.]+$/, '') || 'converted') + '.png'}
            style={{ display: 'inline-block', padding: '8px 14px', background: '#111', color: '#fff', borderRadius: 6, textDecoration: 'none', marginBottom: 16 }}
          >
            PNG 다운로드
          </a>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, background: '#f5f5f5' }}>
            <img src={state.pngUrl} alt="converted preview" style={{ maxWidth: '100%', display: 'block' }} />
          </div>
        </div>
      )}
    </main>
  );
}
