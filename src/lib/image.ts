// Photo handling that happens in the browser: reading GPS from the photo, shrinking it,
// blurring faces and number plates, and a fingerprint used to spot the same problem reported twice.
import exifr from 'exifr';

export interface Prepared { canvas: HTMLCanvasElement; width: number; height: number; gps: { lat: number; lng: number } | null }

const MAX_SIDE = 1280;

export async function prepare(file: Blob): Promise<Prepared> {
  let gps: Prepared['gps'] = null;
  try {
    const g = await exifr.gps(file);
    if (g && Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) gps = { lat: g.latitude, lng: g.longitude };
  } catch { /* no EXIF: that's fine */ }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return { canvas, width: canvas.width, height: canvas.height, gps };
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.8) => c.toDataURL('image/jpeg', q);
export const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/**
 * Pixelates rectangles (boxes are [ymin, xmin, ymax, xmax] on a 0–1000 scale, as Gemini returns them).
 * Pixelating rather than a CSS blur works in every browser and can't be undone from the saved image.
 */
export function pixelate(src: HTMLCanvasElement, boxes: number[][]): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  for (const [y0, x0, y1, x1] of boxes) {
    const pad = 0.12;
    let x = (x0 / 1000) * src.width, y = (y0 / 1000) * src.height, w = ((x1 - x0) / 1000) * src.width, h = ((y1 - y0) / 1000) * src.height;
    x -= w * pad; y -= h * pad; w *= 1 + 2 * pad; h *= 1 + 2 * pad;
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(src.width - x, w); h = Math.min(src.height - y, h);
    if (w < 2 || h < 2) continue;
    const cell = Math.max(6, Math.round(Math.max(w, h) / 9));
    const tiny = document.createElement('canvas');
    tiny.width = Math.max(1, Math.round(w / cell)); tiny.height = Math.max(1, Math.round(h / cell));
    tiny.getContext('2d')!.drawImage(out, x, y, w, h, 0, 0, tiny.width, tiny.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }
  return out;
}

/** 64-bit difference hash: similar photos get similar fingerprints, even after resizing or recompression. */
export function fingerprint(src: HTMLCanvasElement): string {
  const c = document.createElement('canvas'); c.width = 9; c.height = 8;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  const g = (x: number, y: number) => { const i = (y * 9 + x) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += g(x, y) > g(x + 1, y) ? '1' : '0';
  let hex = ''; for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Turns a tap on the shown image into a box for manual blurring. */
export function tapBox(px: number, py: number, shownW: number, shownH: number, sizeFrac = 0.12): [number, number, number, number] {
  const cx = (px / shownW) * 1000, cy = (py / shownH) * 1000, r = sizeFrac * 1000 / 2;
  return [Math.max(0, cy - r), Math.max(0, cx - r), Math.min(1000, cy + r), Math.min(1000, cx + r)];
}
