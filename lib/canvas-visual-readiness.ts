type CanvasObjectLike = {
  type?: string;
  visible?: boolean;
  opacity?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  excludeFromExport?: boolean;
  data?: { id?: string; supabaseUrl?: string; originalFileUrl?: string };
  src?: string;
  text?: string;
  getElement?: () => {
    complete?: boolean;
    naturalWidth?: number;
    naturalHeight?: number;
    width?: number;
    height?: number;
  };
  getObjects?: () => CanvasObjectLike[];
};

type CanvasLike = {
  getObjects?: () => CanvasObjectLike[];
  requestRenderAll?: () => void;
};

function isUserObject(object: CanvasObjectLike): boolean {
  return !object.excludeFromExport && object.data?.id !== 'background-product-image';
}

function hasVisibleBounds(object: CanvasObjectLike): boolean {
  const width = Math.abs((object.width || 0) * (object.scaleX ?? 1));
  const height = Math.abs((object.height || 0) * (object.scaleY ?? 1));
  return width > 0.5 && height > 0.5;
}

export function isCanvasObjectVisuallyReady(object: CanvasObjectLike): boolean {
  if (object.visible === false || (object.opacity ?? 1) <= 0 || !hasVisibleBounds(object)) {
    return false;
  }

  const type = (object.type || '').toLowerCase();
  if (type === 'image' || type === 'fabricimage') {
    const element = object.getElement?.();
    if (!element || element.complete === false) return false;

    const width = element.naturalWidth ?? element.width ?? 0;
    const height = element.naturalHeight ?? element.height ?? 0;
    return width > 1 && height > 1;
  }

  const children = object.getObjects?.();
  if (children?.length) return children.some(isCanvasObjectVisuallyReady);

  if (type.includes('text')) return Boolean(object.text?.trim());
  return true;
}

export function countVisuallyReadyUserObjects(canvas: CanvasLike | undefined): number {
  if (!canvas?.getObjects) return 0;
  return canvas.getObjects().filter(
    (object) => isUserObject(object) && isCanvasObjectVisuallyReady(object)
  ).length;
}

export async function waitForCanvasVisualReadiness(
  canvas: CanvasLike | undefined,
  expectedObjects: number,
  timeoutMs = 4000
): Promise<boolean> {
  if (expectedObjects === 0) return true;

  const deadline = Date.now() + timeoutMs;
  do {
    canvas?.requestRenderAll?.();
    if (countVisuallyReadyUserObjects(canvas) >= expectedObjects) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);

  return false;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('이미지를 읽을 수 없습니다.'));
    reader.readAsDataURL(blob);
  });
}

function isImageRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const type = String((value as Record<string, unknown>).type || '').toLowerCase();
  return type === 'image' || type === 'fabricimage';
}

async function inlineImageSources(
  value: unknown,
  cache: Map<string, Promise<string | null>>
): Promise<void> {
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (isImageRecord(record)) {
    const data = record.data && typeof record.data === 'object'
      ? record.data as Record<string, unknown>
      : {};
    const sources = [...new Set([record.src, data.supabaseUrl, data.originalFileUrl]
      .filter((candidate): candidate is string => typeof candidate === 'string' && /^https?:\/\//.test(candidate)))];

    for (const source of sources) {
      let pending = cache.get(source);
      if (!pending) {
        pending = (async () => {
          try {
            const response = await fetch(source, { cache: 'reload', mode: 'cors' });
            if (!response.ok) return null;
            const blob = await response.blob();
            if (!blob.type.startsWith('image/') || blob.size < 32) return null;
            return await blobToDataUrl(blob);
          } catch {
            return null;
          }
        })();
        cache.set(source, pending);
      }

      const dataUrl = await pending;
      if (dataUrl) {
        record.src = dataUrl;
        break;
      }
    }
  }

  const children = record.objects;
  if (Array.isArray(children)) {
    await Promise.all(children.map((child) => inlineImageSources(child, cache)));
  }

  if (record.clipPath) await inlineImageSources(record.clipPath, cache);
}

export async function prepareViewerCanvasState(raw: unknown): Promise<string> {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const cloned = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
  await inlineImageSources(cloned, new Map());
  return JSON.stringify(cloned);
}
