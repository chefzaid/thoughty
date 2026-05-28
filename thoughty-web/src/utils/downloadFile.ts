export function downloadBlob(blob: Blob, filename: string): void {
  const url = globalThis.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  if (typeof anchor.remove === 'function') {
    anchor.remove();
  } else {
    document.body.removeChild(anchor);
  }

  globalThis.URL.revokeObjectURL(url);
}