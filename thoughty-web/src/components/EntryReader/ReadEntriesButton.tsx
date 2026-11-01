import { useId } from 'react';

import type { TranslationFunction } from '../../types';
import { tintedTextClass } from '../../utils/tintedText';
import { READER_TRIGGER_ATTRIBUTE } from './readerTrigger';

interface ReadEntriesButtonProps {
  /** Whether the filtered list has no entry, so there is nothing to read. */
  readonly listEmpty: boolean;
  /** Opens the reader on the current filters. */
  readonly onRead: () => void;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/**
 * "Read" in the journal filter tools: reads the entries of the current filters like a book, oldest first.
 * With nothing to read it stays reachable, dimmed, and says why.
 */
export default function ReadEntriesButton({ listEmpty, onRead, theme, t }: ReadEntriesButtonProps) {
  const hintId = useId();
  const hint = t(listEmpty ? 'readerEmpty' : 'readerOpenHint');

  return (
    <>
      <button
        type="button"
        {...{ [READER_TRIGGER_ATTRIBUTE]: '' }}
        onClick={() => { if (!listEmpty) onRead(); }}
        aria-disabled={listEmpty}
        aria-haspopup="dialog"
        aria-label={t('readerOpen')}
        aria-describedby={hintId}
        title={hint}
        className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 text-sm font-medium transition-all ${tintedTextClass('amber', theme)} ${listEmpty ? 'cursor-not-allowed opacity-50' : 'hover:bg-amber-500/20'}`}
      >
        <span className="codicon codicon-book" aria-hidden="true" />
        {t('reader')}
      </button>
      <span id={hintId} className="sr-only">{hint}</span>
    </>
  );
}
