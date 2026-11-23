import { useId, useState } from 'react';

import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { tintedTextClass } from '../../utils/tintedText';
import EntryChatDialog from './EntryChatDialog';
import { useEntryChat } from './useEntryChat';

interface DiscussEntriesButtonProps {
  /** The journal filters as a reader scope: the entries the conversation reads. */
  readonly scope: string;
  /** Whether the filtered list has no entry, so there is nothing to discuss. */
  readonly listEmpty: boolean;
  /** Whether the conversation reads all diaries and leaves those with AI off out, which it then says. */
  readonly aiOffLeftOut?: boolean;
  /** Opens an entry a reply cites in the reader, among the entries that reply read. */
  readonly onOpenEntry: (readIds: readonly number[], entryId: number) => void;
  readonly language: Language;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/**
 * "Discuss" in the journal filter tools: a conversation with the AI about the entries of the current filters.
 * The conversation outlives the dialog, so opening a cited entry and coming back finds it again; other filters
 * start a new one. With nothing to discuss the button stays reachable, dimmed, and says why.
 */
export default function DiscussEntriesButton({ scope, listEmpty, aiOffLeftOut = false, onOpenEntry, language, theme = 'dark', t }: DiscussEntriesButtonProps) {
  const [open, setOpen] = useState(false);
  const chat = useEntryChat(scope);
  const hintId = useId();
  const hint = t(listEmpty ? 'entryChatEmpty' : 'entryChatOpenHint');

  const openEntry = (readIds: readonly number[], entryId: number) => {
    setOpen(false);
    onOpenEntry(readIds, entryId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { if (!listEmpty) setOpen(true); }}
        aria-disabled={listEmpty}
        aria-haspopup="dialog"
        aria-describedby={hintId}
        title={hint}
        className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border border-violet-500/50 bg-violet-500/10 px-4 text-sm font-medium transition-all ${tintedTextClass('violet', theme)} ${listEmpty ? 'cursor-not-allowed opacity-50' : 'hover:bg-violet-500/20'}`}
      >
        <span className="codicon codicon-comment-discussion" aria-hidden="true" />
        {t('entryChatOpen')}
      </button>
      <span id={hintId} className="sr-only">{hint}</span>
      {open && (
        <EntryChatDialog chat={chat} aiOffLeftOut={aiOffLeftOut} onClose={() => setOpen(false)} onOpenEntry={openEntry} language={language} theme={theme} t={t} />
      )}
    </>
  );
}
