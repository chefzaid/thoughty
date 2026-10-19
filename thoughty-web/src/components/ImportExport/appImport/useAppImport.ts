import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppImportService } from '../../../services/api/appImportService';
import type { AppExport } from './appImportTypes';
import { readAppExport, UnsupportedExportError } from './readAppExport';
import { runAppImport, type AppImportOptions, type AppImportProgress, type AppImportSummary } from './runAppImport';

export type AppImportState =
  | { readonly step: 'idle' }
  | { readonly step: 'reading'; readonly fileName: string }
  | { readonly step: 'unreadable'; readonly unsupported: boolean }
  | { readonly step: 'ready'; readonly data: AppExport }
  | { readonly step: 'importing'; readonly data: AppExport; readonly progress: AppImportProgress }
  | { readonly step: 'done'; readonly summary: AppImportSummary | null; readonly error?: string };

/** Reads an export, then runs and follows the import; leaving the page stops it. */
export function useAppImport(service: AppImportService, onImported?: () => void) {
  const [state, setState] = useState<AppImportState>({ step: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const chooseFile = useCallback(async (file: File) => {
    setState({ step: 'reading', fileName: file.name });
    try {
      setState({ step: 'ready', data: await readAppExport(file) });
    } catch (error) {
      console.error('Reading the export failed:', error);
      setState({ step: 'unreadable', unsupported: error instanceof UnsupportedExportError });
    }
  }, []);

  const start = useCallback(async (data: AppExport, options: AppImportOptions) => {
    const run = new AbortController();
    controller.current = run;
    setState({ step: 'importing', data, progress: { phase: 'entries', done: 0, total: data.entries.length } });

    let summary: AppImportSummary | null = null;
    let error: string | undefined;
    try {
      summary = await runAppImport(
        data,
        options,
        service,
        (progress) => setState({ step: 'importing', data, progress }),
        run.signal,
      );
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    }
    controller.current = null;
    setState({ step: 'done', summary, error });
    onImported?.();
  }, [onImported, service]);

  const stop = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState({ step: 'idle' }), []);

  return { state, chooseFile, start, stop, reset };
}
