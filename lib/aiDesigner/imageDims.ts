/**
 * 원격 이미지의 natural 크기(px)를 헤더 일부만 받아 파싱한다 (PNG IHDR / JPEG SOF).
 * 목업 배치 수학에 필요. 모듈 레벨 캐시(서버리스 인스턴스 생존 동안 유지).
 */
const cache = new Map<string, { w: number; h: number }>();

function parsePng(buf: Uint8Array): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47];
  for (let i = 0; i < 4; i++) if (buf[i] !== sig[i]) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

function parseJpeg(buf: Uint8Array): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  const dv = new DataView(buf.buffer, buf.byteOffset);
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: dv.getUint16(off + 5), w: dv.getUint16(off + 7) };
    }
    off += 2 + dv.getUint16(off + 2);
  }
  return null;
}

export async function fetchImageDims(url: string): Promise<{ w: number; h: number } | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  try {
    // 앞부분만으로 대부분 파싱된다. JPEG SOF가 뒤에 있으면 전체 재요청.
    let res = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
    if (!res.ok && res.status !== 206) return null;
    let buf = new Uint8Array(await res.arrayBuffer());
    let dims = parsePng(buf) ?? parseJpeg(buf);
    if (!dims) {
      res = await fetch(url);
      if (!res.ok) return null;
      buf = new Uint8Array(await res.arrayBuffer());
      dims = parsePng(buf) ?? parseJpeg(buf);
    }
    if (dims && dims.w > 0 && dims.h > 0) {
      cache.set(url, dims);
      return dims;
    }
    return null;
  } catch {
    return null;
  }
}
