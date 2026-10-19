const LONGEST_SIDES = [4096, 3072, 2048, 1600];
const JPEG_QUALITY = 0.85;

function canvasFor(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function encodeJpeg(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob | null> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

/**
 * Re-encodes a photo as JPEG, scaled down until it fits in `maxBytes`. Returns
 * null when the browser cannot read the format (HEIC outside Safari, for one).
 */
export async function shrinkPhoto(photo: Blob, maxBytes: number): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(photo);
  } catch {
    return null;
  }

  try {
    for (const longestSide of LONGEST_SIDES) {
      const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
      const canvas = canvasFor(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!context) {
        return null;
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const jpeg = await encodeJpeg(canvas);
      if (jpeg && jpeg.size <= maxBytes) {
        return jpeg;
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
