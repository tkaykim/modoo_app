'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  BackgroundRemovalFlow,
  type FlowResult,
} from '@/app/components/background-removal/BackgroundRemovalFlow';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';
import { createClient } from '@/lib/supabase-client';
import type { ImageSlot } from '@/types/types';
import { trackDesignAction } from '@/lib/gtm-events';

type Step = 'pick' | 'crop' | 'bgremove' | 'uploading';

interface Props {
  slot: ImageSlot;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (url: string) => void;
}

const OUTPUT_LONG_EDGE = 1600; // px — output blob long-edge resolution

/**
 * Pick → simple aspect-ratio crop (drag/zoom) → optional bg removal via existing
 * BackgroundRemovalFlow → upload → onUploaded(url).
 */
const SlotImageCropper: React.FC<Props> = ({ slot, isOpen, onClose, onUploaded }) => {
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [bgRemove, setBgRemove] = useState<boolean>(slot.bg_removal_default ?? slot.accepts === 'logo');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);

  const cropBoxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setStep('pick');
      setFile(null);
      setImgUrl(null);
      setImgDims(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setError(null);
      setCroppedFile(null);
      setBgRemove(slot.bg_removal_default ?? slot.accepts === 'logo');
    }
  }, [isOpen, slot.bg_removal_default, slot.accepts]);

  // Object URL lifecycle
  useEffect(() => {
    if (!file) {
      setImgUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const aspect = slot.aspect_ratio || 1;

  // Crop box display dimensions (CSS pixels)
  const displayBoxW = 320;
  const displayBoxH = displayBoxW / aspect;

  // Compute base scale so the image covers the crop box
  const baseScale = useMemo(() => {
    if (!imgDims) return 1;
    return Math.max(displayBoxW / imgDims.w, displayBoxH / imgDims.h);
  }, [imgDims, displayBoxW, displayBoxH]);

  const effectiveScale = baseScale * zoom;

  const handleFilePick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      setFile(f);
      setStep('crop');
    };
    input.click();
  };

  // Drag-to-pan handlers
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const renderCroppedBlob = async (): Promise<File | null> => {
    if (!imgUrl || !imgDims) return null;
    // Output canvas at OUTPUT_LONG_EDGE on the longer side, preserving aspect.
    const outW = aspect >= 1 ? OUTPUT_LONG_EDGE : Math.round(OUTPUT_LONG_EDGE * aspect);
    const outH = aspect >= 1 ? Math.round(OUTPUT_LONG_EDGE / aspect) : OUTPUT_LONG_EDGE;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Map display crop box (displayBoxW × displayBoxH) → output canvas (outW × outH).
    // The image is rendered at effectiveScale around the box centre with pan offset.
    // Compute the source rect on the original image that maps onto the box.
    const srcW = displayBoxW / effectiveScale;
    const srcH = displayBoxH / effectiveScale;
    const cx = imgDims.w / 2 - pan.x / effectiveScale;
    const cy = imgDims.h / 2 - pan.y / effectiveScale;
    const sx = Math.max(0, cx - srcW / 2);
    const sy = Math.max(0, cy - srcH / 2);
    const clampedSrcW = Math.min(srcW, imgDims.w - sx);
    const clampedSrcH = Math.min(srcH, imgDims.h - sy);

    const im = new Image();
    await new Promise<void>((resolve, reject) => {
      im.onload = () => resolve();
      im.onerror = reject;
      im.src = imgUrl;
    });
    ctx.drawImage(im, sx, sy, clampedSrcW, clampedSrcH, 0, 0, outW, outH);

    return await new Promise<File | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        resolve(new File([blob], `slot-${slot.slot_id}-${Date.now()}.${ext}`, { type: blob.type || 'image/png' }));
      }, 'image/png', 0.95);
    });
  };

  const uploadAndDone = async (uploadFile: File) => {
    setStep('uploading');
    try {
      const supabase = createClient();
      const result = await uploadFileToStorage(
        supabase,
        uploadFile,
        STORAGE_BUCKETS.USER_DESIGNS,
        STORAGE_FOLDERS.IMAGES,
      );
      if (!result.success || !result.url) {
        setError(result.error || '업로드에 실패했습니다.');
        setStep('crop');
        return;
      }
      onUploaded(result.url);
      onClose();
    } catch (err) {
      console.error(err);
      setError('업로드 중 오류가 발생했습니다.');
      setStep('crop');
    }
  };

  const handleConfirmCrop = async () => {
    setError(null);
    const cropped = await renderCroppedBlob();
    if (!cropped) {
      setError('이미지 처리에 실패했습니다.');
      return;
    }
    setCroppedFile(cropped);
    trackDesignAction({ action_type: 'slot_crop_complete' });
    if (bgRemove) {
      setStep('bgremove');
    } else {
      void uploadAndDone(cropped);
    }
  };

  const handleBgComplete = async (result: FlowResult) => {
    const blob = result.blob;
    const finalFile = new File(
      [blob],
      `slot-${slot.slot_id}-bg-${Date.now()}.png`,
      { type: blob.type || 'image/png' },
    );
    if (result.usedRemoval) trackDesignAction({ action_type: 'slot_bg_remove_complete' });
    void uploadAndDone(finalFile);
  };

  const handleBgCancel = () => {
    if (croppedFile) void uploadAndDone(croppedFile);
    else setStep('crop');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 py-3.5 flex items-center justify-between border-b border-gray-200">
          <h3 className="text-base font-semibold">{slot.label} 교체</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'pick' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <p className="text-sm text-gray-600 text-center">
                {slot.accepts === 'logo' ? '로고 이미지를 선택해 주세요.' : '사진을 선택해 주세요.'}
              </p>
              <button
                onClick={handleFilePick}
                className="px-6 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800"
              >
                파일 선택
              </button>
              <p className="text-xs text-gray-400">권장 비율: {aspect.toFixed(2)} : 1</p>
            </div>
          )}

          {step === 'crop' && imgUrl && imgDims && (
            <div className="flex flex-col items-center gap-4">
              <div
                ref={cropBoxRef}
                className="relative overflow-hidden bg-gray-100 rounded-lg select-none touch-none"
                style={{ width: displayBoxW, height: displayBoxH, cursor: 'grab' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt="crop preview"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${effectiveScale})`,
                    transformOrigin: 'center center',
                    width: imgDims.w,
                    height: imgDims.h,
                    maxWidth: 'none',
                    pointerEvents: 'none',
                  }}
                />
                <div className="absolute inset-0 ring-1 ring-white/60 pointer-events-none" />
              </div>

              <div className="w-full">
                <label className="text-xs text-gray-500">확대</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <label className="flex items-center gap-2 text-sm self-start">
                <input
                  type="checkbox"
                  checked={bgRemove}
                  onChange={(e) => setBgRemove(e.target.checked)}
                />
                <span>배경 제거하기</span>
                {slot.accepts === 'logo' && <span className="text-xs text-gray-400">(로고 권장)</span>}
              </label>

              {error && <p className="text-sm text-red-500 self-start">{error}</p>}

              <div className="flex gap-2 w-full">
                <button
                  onClick={handleFilePick}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
                >
                  다른 사진
                </button>
                <button
                  onClick={handleConfirmCrop}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {step === 'bgremove' && croppedFile && (
            <BackgroundRemovalFlow
              initialFile={croppedFile}
              onComplete={handleBgComplete}
              onCancel={handleBgCancel}
            />
          )}

          {step === 'uploading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="size-8 animate-spin text-gray-500" />
              <p className="text-sm text-gray-600">이미지를 저장하고 있습니다...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlotImageCropper;
