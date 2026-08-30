/**
 * Receipt photos are downscaled to 1600 px on the long edge at JPEG quality 0.8
 * before they are stored, and the original is not kept (CLAUDE.md §8.1).
 *
 * This is the one place in the app that compresses anything. Our user has 32 GB
 * of storage and complains it is full; a 4 MB camera original per receipt would
 * fill it.
 */
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

export interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
  hash: string;
}

function targetSize(width: number, height: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_EDGE) return { width, height };
  const scale = MAX_EDGE / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  // Older Android WebViews: fall back to an <img> and an object URL.
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not decode the photo'));
      el.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('could not encode the photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** sha-256 of the bytes. Dedupes re-taken photos and is the sync idempotency key. */
export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const decoded = await decode(file);
  try {
    const { width, height } = targetSize(decoded.width, decoded.height);

    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });

    const context = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!context) throw new Error('could not open a canvas for the photo');

    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await toBlob(canvas);

    return { blob, width, height, hash: await hashBlob(blob) };
  } finally {
    decoded.close();
  }
}
