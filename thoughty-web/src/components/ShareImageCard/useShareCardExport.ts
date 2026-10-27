import { useCallback, useState, type RefObject } from 'react';
import { downloadBlob } from '../../utils/downloadFile';
import { canvasToPngBlob, copyImage, shareImage } from './shareCardExport';

export interface ShareCardStatus {
  readonly tone: 'success' | 'error';
  /** A translation key. */
  readonly message: string;
}

interface ShareCardExportOptions {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly filename: string;
  readonly shareTitle: string;
}

/** The dialog's three ways out (download, copy, share), with one status message between them. */
export function useShareCardExport({ canvasRef, filename, shareTitle }: ShareCardExportOptions) {
  const [status, setStatus] = useState<ShareCardStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: (canvas: HTMLCanvasElement) => Promise<ShareCardStatus | null>, failure: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setStatus(null);
    try {
      setStatus(await action(canvas));
    } catch {
      setStatus({ tone: 'error', message: failure });
    } finally {
      setBusy(false);
    }
  }, [canvasRef]);

  const download = useCallback(() => run(async (canvas) => {
    downloadBlob(await canvasToPngBlob(canvas), filename);
    return { tone: 'success', message: 'shareImageDownloaded' };
  }, 'shareImageExportFailed'), [filename, run]);

  const copy = useCallback(() => run(async (canvas) => {
    await copyImage(canvasToPngBlob(canvas));
    return { tone: 'success', message: 'shareImageCopied' };
  }, 'shareImageCopyFailed'), [run]);

  const share = useCallback(() => run(async (canvas) => {
    const blob = await canvasToPngBlob(canvas);
    const shared = await shareImage(new File([blob], filename, { type: 'image/png' }), shareTitle);
    return shared ? { tone: 'success', message: 'shareImageShared' } : null;
  }, 'shareImageShareFailed'), [filename, run, shareTitle]);

  return { status, busy, download, copy, share };
}
