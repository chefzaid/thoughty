import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { hasCrisisSignal } from '../../utils/crisisSignals';
import { scrollBehavior } from '../../utils/motion';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import SupportResourcesCard from '../SupportResources/SupportResourcesCard';
import EntryChatTurns from './EntryChatTurns';
import type { EntryChatState } from './useEntryChat';

/** The most entries one reply reads, as the API reads them. */
export const ENTRY_CHAT_MAX_ENTRIES = 50;

interface EntryChatDialogProps {
  readonly chat: EntryChatState;
  readonly onClose: () => void;
  /** Opens a cited entry in the reader, among the entries its reply read. */
  readonly onOpenEntry: (readIds: readonly number[], entryId: number) => void;
  readonly language: Language;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/**
 * Discusses the entries of the journal filters with the AI in a modal dialog: an optional date range first
 * (fixed once the conversation starts, until **New conversation**), then the messages, each reply citing
 * entries by number with buttons that open them. Focus starts in the message field and Escape closes it;
 * closing keeps the conversation for when it opens again on the same filters.
 */
export default function EntryChatDialog({ chat, onClose, onOpenEntry, language, theme, t }: EntryChatDialogProps) {
  const [input, setInput] = useState('');
  const [supportClosed, setSupportClosed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const field = useId();
  const isLight = theme === 'light';
  const started = chat.turns.length > 0;

  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: inputRef, onClose });

  // The writer's own words, never the AI's, call for the support resources
  const supportCalledFor = !supportClosed
    && hasCrisisSignal(...chat.turns.filter((turn) => turn.role === 'user').map((turn) => turn.content));

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: scrollBehavior() });
  }, [chat.turns, chat.loading, supportCalledFor]);

  const send = () => {
    if (!input.trim() || chat.loading) return;
    void chat.send(input);
    setInput('');
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };
  const startOver = () => {
    chat.reset();
    setSupportClosed(false);
    inputRef.current?.focus();
  };

  const reading = chat.reading && (chat.reading.count < chat.reading.total
    ? pluralPhrase(t, 'entryChatReadNewest', chat.reading.count, language, { total: chat.reading.total.toLocaleString(language) })
    : pluralPhrase(t, 'entryChatRead', chat.reading.count, language));
  const borderClass = isLight ? 'border-gray-200' : 'border-gray-700';
  const secondaryButtonClass = isLight ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-700 text-gray-200 hover:bg-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop: a pointer target only; keyboard users close with Escape or the close button. */}
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default" onClick={onClose} aria-hidden="true" tabIndex={-1} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full max-w-2xl mx-4 rounded-xl shadow-2xl border flex flex-col ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}
        style={{ maxHeight: '85vh' }}
      >
        <div className={`flex items-center justify-between gap-2 px-5 py-4 border-b ${borderClass}`}>
          <h3 id={titleId} className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>{t('entryChatTitle')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startOver}
              disabled={!started}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${secondaryButtonClass}`}
            >
              {t('entryChatNewConversation')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('closeDialog')}
              title={t('closeDialog')}
              className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-700 text-gray-400'}`}
            >
              <span className="codicon codicon-close" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={`px-5 py-3 border-b text-sm space-y-2 ${isLight ? 'bg-gray-50 border-gray-200 text-gray-600' : 'bg-gray-900/50 border-gray-700 text-gray-400'}`}>
          <p>{t('entryChatIntro', { max: ENTRY_CHAT_MAX_ENTRIES })}</p>
          <fieldset className="flex flex-wrap items-end gap-3" disabled={started} aria-describedby={started ? `${field}-locked` : undefined}>
            <legend className="mb-1 font-medium">{t('entryChatRange')}</legend>
            <label className="flex flex-col gap-1" htmlFor={`${field}-from`}>
              <span className="text-xs">{t('entryChatFrom')}</span>
              <input
                id={`${field}-from`}
                type="date"
                className={`setting-input ${theme} disabled:cursor-not-allowed disabled:opacity-60`}
                value={chat.range.from}
                max={chat.range.to || undefined}
                onChange={(event) => chat.setRange({ ...chat.range, from: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1" htmlFor={`${field}-to`}>
              <span className="text-xs">{t('entryChatTo')}</span>
              <input
                id={`${field}-to`}
                type="date"
                className={`setting-input ${theme} disabled:cursor-not-allowed disabled:opacity-60`}
                value={chat.range.to}
                min={chat.range.from || undefined}
                onChange={(event) => chat.setRange({ ...chat.range, to: event.target.value })}
              />
            </label>
          </fieldset>
          {started && <p id={`${field}-locked`} className="text-xs">{t('entryChatRangeLocked')}</p>}
          {reading && <p className="text-xs font-medium" aria-live="polite">{reading}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[200px]">
          {!started && !chat.loading && (
            <p className={`text-center text-sm italic ${mutedTextClass(!isLight)}`}>{t('entryChatNotKept')}</p>
          )}
          <EntryChatTurns turns={chat.turns} onOpenEntry={onOpenEntry} language={language} isLight={isLight} t={t} />
          {chat.loading && (
            <div className="flex justify-start">
              <div className={`px-4 py-2.5 rounded-2xl rounded-bl-md text-sm ${isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-300'}`}>
                {t('aiThinking')}
              </div>
            </div>
          )}
          {chat.error && (
            <div role="alert" className={`px-4 py-2.5 rounded-lg text-sm bg-red-500/10 border border-red-500/30 ${isLight ? 'text-red-700' : 'text-red-300'}`}>
              {t(chat.error)}
            </div>
          )}
          {supportCalledFor && (
            <SupportResourcesCard onClose={() => setSupportClosed(true)} theme={theme} t={t} headingLevel={4} />
          )}
          <div ref={endRef} />
        </div>

        <div className={`px-5 py-4 border-t ${borderClass}`}>
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('entryChatPlaceholder')}
              aria-label={t('aiChatMessageLabel')}
              rows={1}
              className={`privacy-text flex-1 resize-none rounded-lg px-4 py-2.5 text-sm border focus:ring-2 focus:ring-blue-500 outline-none ${
                isLight ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-600 text-gray-100'
              }`}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || chat.loading}
              aria-label={t('aiChatSend')}
              title={t('aiChatSend')}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="codicon codicon-send" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
