import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { Config, TranslationFunction } from '../../types';
import { normalizeFontSize, resolveFontColor, resolveFontFamily } from '../../types/config';
import { resolveLanguage } from '../../utils/language';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { isPrivacyBlurShortcut } from '../PrivacyBlur/privacyBlur';
import { useQuietMode } from '../QuietMode/quietMode';
import ReaderEntry from './ReaderEntry';
import { READER_TRIGGER_ATTRIBUTE } from './readerTrigger';
import { useEntryReaderPage } from './useEntryReaderPage';
import './EntryReader.css';

/** The reading text is larger than the journal's, as a page held at reading distance. */
const TEXT_SCALE = 1.2;
/** Marks the page while the reader is open, so that printing shows the entry being read and not the app. */
const ACTIVE_CLASS = 'entry-reader-active';

interface EntryReaderProps {
  /** The filters read (a reader scope). */
  readonly scope: string;
  /** The entry shown; null for the first one. */
  readonly entryId: number | null;
  /** Shows another entry of the reading (null for its first), in the address. */
  readonly onShow: (entryId: number | null) => void;
  readonly onClose: () => void;
  readonly config: Config;
  readonly t: TranslationFunction;
}

/** Keys the reader leaves to fields and players: their arrows move a caret or a playhead. */
function ownsArrowKeys(target: EventTarget): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'AUDIO', 'VIDEO'].includes(target.tagName));
}

/**
 * A quiet reader over the journal: one entry at a time, oldest first, with only its day, its text and the
 * previous and next buttons (or the left and right arrows). The writer's font, else a book serif, at a larger
 * size and line height. Each entry turned to is announced politely, with its place unless quiet mode is on.
 */
export default function EntryReader({ scope, entryId, onShow, onClose, config, t }: EntryReaderProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const hintId = useId();
  const headingId = useId();
  const quiet = useQuietMode();
  const language = resolveLanguage(config.language);
  const theme = config.theme === 'light' ? 'light' : 'dark';
  const { page, current, loading, error, retry } = useEntryReaderPage(scope, entryId);
  // Pressing on past the first or last entry says so, until another entry is shown
  const [edge, setEdge] = useState<{ key: 'readerFirst' | 'readerLast'; entryId: number } | null>(null);

  // Focus goes back to what opened the reader, else (after a reload) to the journal's Read button. This runs
  // once the journal is on the page and before the dialog moves focus into itself.
  useLayoutEffect(() => {
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement && active !== document.body
      ? active
      : document.querySelector<HTMLElement>(`[${READER_TRIGGER_ATTRIBUTE}]`);
  }, []);
  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: pageRef, onClose, returnFocusRef });

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = document.body.style.overflow;
    root.classList.add(ACTIVE_CLASS);
    document.body.style.overflow = 'hidden';
    return () => {
      root.classList.remove(ACTIVE_CLASS);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const shown = current ? page : null;
  const shownId = shown?.entry.id ?? null;
  // The first entry's own ID goes in the address, so a reload stays on it
  useEffect(() => {
    if (entryId === null && shownId !== null) onShow(shownId);
  }, [entryId, onShow, shownId]);
  // Each entry starts at its top
  useEffect(() => {
    if (shownId !== null) pageRef.current?.scrollTo?.({ top: 0 });
  }, [shownId]);

  const date = shown ? formatEntryDay(shown.entry.date, language) : '';
  let announcement = '';
  if (shown && edge?.entryId === shownId) announcement = t(edge.key);
  else if (shown) announcement = quiet ? t('readerShownQuiet', { date }) : t('readerShown', { position: shown.position, total: shown.total, date });

  const turn = (to: number | null | undefined, edgeKey: 'readerFirst' | 'readerLast') => {
    if (to) onShow(to);
    else if (shownId !== null) setEdge({ key: edgeKey, entryId: shownId });
  };
  const previous = () => turn(shown?.previousId, 'readerFirst');
  const next = () => turn(shown?.nextId, 'readerLast');

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    // Only keys pressed in the reader itself: a picture preview opened from it handles its own
    const inReader = dialogRef.current?.contains(event.target as Node) ?? false;
    if (plain && inReader && !ownsArrowKeys(event.target) && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') previous();
      else next();
    }
    // Journal shortcuts (pages, search, new entry) never act behind the reader; Esc and Tab still reach
    // the dialog's own handling, and the privacy blur still blurs the text.
    if (event.key !== 'Escape' && event.key !== 'Tab' && !isPrivacyBlurShortcut(event)) {
      event.stopPropagation();
    }
  };

  const atStart = !shown?.previousId;
  const atEnd = !shown?.nextId;
  const notFound = error === 'apiError_ENTRY_READER_NOT_FOUND';

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('readerTitle')}
      aria-describedby={hintId}
      lang={language}
      className={`entry-reader ${theme}`}
      onKeyDown={handleKeyDown}
    >
      <header className="entry-reader-bar">
        <p id={hintId} className="entry-reader-hint">{t('readerHint')}</p>
        <button type="button" className="entry-reader-button" onClick={onClose}>{t('readerClose')}</button>
      </header>
      <div ref={pageRef} className="entry-reader-page" tabIndex={-1} aria-busy={loading}>
        <div
          className="entry-reader-sheet"
          style={{
            color: resolveFontColor(config.fontColor, theme),
            fontFamily: resolveFontFamily(config.fontFamily && config.fontFamily !== 'system' ? config.fontFamily : 'serif'),
            fontSize: `${normalizeFontSize(config.fontSize) * TEXT_SCALE}px`,
          }}
        >
          {error && (
            <div role="alert" className="entry-reader-status">
              <p>{t(error)}</p>
              <button type="button" className="entry-reader-button" onClick={() => (notFound ? onShow(null) : void retry())}>
                {t(notFound ? 'readerStartOver' : 'readerRetry')}
              </button>
            </div>
          )}
          {!error && !page && <p className="entry-reader-status">{t('readerLoading')}</p>}
          {!error && page && <ReaderEntry key={page.entry.id} entry={page.entry} headingId={headingId} language={language} theme={theme} t={t} />}
        </div>
      </div>
      <nav className="entry-reader-nav" aria-label={t('readerPages')}>
        <button type="button" className="entry-reader-button" aria-disabled={atStart} onClick={previous}>
          <span aria-hidden="true">‹ </span>{t('readerPrevious')}
        </button>
        <button type="button" className="entry-reader-button" aria-disabled={atEnd} onClick={next}>
          {t('readerNext')}<span aria-hidden="true"> ›</span>
        </button>
      </nav>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>,
    document.body,
  );
}
