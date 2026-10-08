/** Kart yazı maskeleri (1024 × 1456, tek kanal). Orijinal örnekte gömülü bir maskeydi
 * (bkz. lettering.original.ts); burada metinler lettering-draw.js içinde çalışma anında çizilir. */
import { drawBackLettering, drawLettering } from './lettering-draw.js';

export const letteringSize = [1024, 1456] as const;

function rasterize(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Uint8Array<ArrayBuffer> {
  const [width, height] = letteringSize;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable for card lettering');
  draw(ctx, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const pixels = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = rgba[i * 4];
  return pixels;
}

/** Ön yüz yazıları. */
export const letteringPixels = () => rasterize(drawLettering);
/** Arka yüz (iletişim) yazıları. */
export const letteringBackPixels = () => rasterize(drawBackLettering);
