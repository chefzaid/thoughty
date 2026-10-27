/**
 * Getting the drawn card out of the page: a PNG blob, a copy on the clipboard, or the device's
 * share sheet. Each one is offered only where the browser supports it.
 */

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The card could not be turned into an image.'));
    }, 'image/png');
  });
}

/** Whether the browser can put an image on the clipboard (the async Clipboard API with images). */
export function canCopyImage(): boolean {
  return typeof ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';
}

/**
 * Copies the PNG to the clipboard. The blob is handed over as a promise so Safari, which only
 * allows the write during the click, still accepts it while the image is being encoded.
 */
export async function copyImage(blob: Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

/** Whether the device's share sheet takes PNG files (the Web Share API with files). */
export function canShareImages(): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'card.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/** Shares the image; resolves to false when the person closed the share sheet without sharing. */
export async function shareImage(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}
