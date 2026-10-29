import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction as TranslationFn } from '../../types';
import { canCopyImage, canShareImages } from './shareCardExport';
import { cardFilename, formatCardDate, toCardText } from './shareCardLayout';
import { drawShareCard } from './shareCardRenderer';
import ShareImageOptions, { type ShareImageChoices } from './ShareImageOptions';
import { useCardLogo } from './useCardLogo';
import { useShareCardExport } from './useShareCardExport';

/** The parts of an entry the card is made from; journal entries and feed entries both have them. */
export interface ShareableEntry {
  readonly content: string;
  readonly format?: 'plain' | 'markdown';
  readonly title?: string | null;
  readonly date: string;
  readonly visibility?: 'public' | 'private';
}

interface ShareImageDialogProps {
  readonly isOpen: boolean;
  readonly entry: ShareableEntry;
  /** Text the person had selected in the entry; the card starts with it instead of the whole entry. */
  readonly initialExcerpt?: string;
  readonly isDark: boolean;
  readonly language: string;
  readonly onClose: () => void;
  readonly t: TranslationFn;
}

const BRAND = 'Thoughty';

/**
 * Shares an entry as a picture: a card drawn on a canvas in the browser, previewed here and
 * downloaded, copied or handed to the device's share sheet as a PNG. Nothing leaves the device
 * until the person chooses where to post it.
 */
export default function ShareImageDialog(props: ShareImageDialogProps) {
  // Mounting the panel on open starts every opening from the entry, with fresh choices.
  return props.isOpen ? <ShareImagePanel {...props} /> : null;
}

function ShareImagePanel({ entry, initialExcerpt, isDark, language, onClose, t }: ShareImageDialogProps) {
  const wholeText = useMemo(() => toCardText(entry.content, entry.format), [entry.content, entry.format]);
  const [choices, setChoices] = useState<ShareImageChoices>(() => ({
    text: initialExcerpt?.trim() || wholeText,
    includeTitle: Boolean(entry.title?.trim()),
    showMark: true,
    theme: isDark ? 'dark' : 'light',
    size: 'square',
  }));
  const [altText, setAltText] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleId = useId();
  const logo = useCardLogo();
  const date = formatCardDate(entry.date, language);
  const filename = cardFilename(entry.date);
  const exporter = useShareCardExport({ canvasRef, filename, shareTitle: entry.title?.trim() || BRAND });
  const copySupported = useMemo(canCopyImage, []);
  const shareSupported = useMemo(canShareImages, []);

  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: closeRef, onClose });

  const text = choices.text.trim();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layout = drawShareCard(canvas, {
      text,
      title: choices.includeTitle ? entry.title ?? undefined : undefined,
      date,
      theme: choices.theme,
      size: choices.size,
      showMark: choices.showMark,
      markLabel: BRAND,
    }, logo);
    const shown = layout ? layout.quote.lines.join(' ') : text;
    setAltText(t('shareImagePreviewAlt', { text: shown, date }));
  }, [choices, date, entry.title, logo, t, text]);

  const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
  const secondaryButtonClass = isDark
    ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
    : 'border-gray-300 text-gray-700 hover:bg-gray-100';
  const actionsDisabled = exporter.busy || text === '';
  let statusClass = isDark ? 'text-green-300' : 'text-green-700';
  if (exporter.status?.tone === 'error') statusClass = isDark ? 'text-red-300' : 'text-red-700';

  // Portaled to the body, so no transformed ancestor in the entry list confines the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: a pointer target only; keyboard users close with Escape or the Close button. */}
      <button type="button" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-hidden="true" tabIndex={-1} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 m-0 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border p-0 shadow-2xl ${panelClass}`}
      >
        <header className={`flex items-center justify-between border-b px-5 py-4 ${borderClass}`}>
          <h3 id={titleId} className="text-lg font-semibold">{t('shareAsImage')}</h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-500/10 hover:text-gray-300"
            title={t('close')}
            aria-label={t('close')}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="grid gap-5 overflow-y-auto px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex items-start justify-center">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={altText}
              data-testid="share-image-preview"
              className={`h-auto max-h-[60vh] w-auto max-w-full rounded-lg border shadow-lg ${borderClass}`}
            />
          </div>
          <div className="space-y-4">
            {entry.visibility === 'private' && (
              <p role="note" className={`rounded border px-3 py-2 text-sm ${isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
                {t('shareImagePrivateNote')}
              </p>
            )}
            <ShareImageOptions
              choices={choices}
              wholeText={wholeText}
              hasTitle={Boolean(entry.title?.trim())}
              isDark={isDark}
              onChange={(changes) => setChoices((current) => ({ ...current, ...changes }))}
              t={t}
            />
            {text === '' && <p className={`text-sm ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>{t('shareImageEmpty')}</p>}
            {!copySupported && !shareSupported && (
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('shareImageUnsupported')}</p>
            )}
            <output aria-live="polite" className={`block min-h-[1.25rem] text-sm ${statusClass}`}>
              {exporter.status ? t(exporter.status.message) : ''}
            </output>
          </div>
        </div>
        <footer className={`flex flex-wrap justify-end gap-3 border-t px-5 py-4 ${borderClass}`}>
          <button type="button" onClick={onClose} className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}>
            {t('close')}
          </button>
          {shareSupported && (
            <button type="button" onClick={() => void exporter.share()} disabled={actionsDisabled} className={`rounded border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${secondaryButtonClass}`}>
              {t('shareImageShare')}
            </button>
          )}
          {copySupported && (
            <button type="button" onClick={() => void exporter.copy()} disabled={actionsDisabled} className={`rounded border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${secondaryButtonClass}`}>
              {t('shareImageCopy')}
            </button>
          )}
          <button
            type="button"
            onClick={() => void exporter.download()}
            disabled={actionsDisabled}
            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('shareImageDownload')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
