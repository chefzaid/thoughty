import { useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { createMessagesService } from '../../services/api';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { mutedTextClass } from '../../utils/tintedText';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { MESSAGE_MAX_LENGTH } from './MessageComposer';
import { CONVERSATIONS_QUERY_KEY } from './useMessages';
import { useWritersToMessage } from './useWritersToMessage';

interface DiscussWithSomeoneDialogProps {
  readonly entry: {
    readonly id: number;
    readonly date: string;
    readonly title?: string | null;
    readonly visibility?: 'public' | 'private';
  };
  readonly isDark: boolean;
  readonly language: Language;
  readonly onClose: () => void;
  readonly t: TranslationFunction;
}

/**
 * "Discuss › With someone": sends one of the writer's public entries, with a message, to a writer they follow
 * who follows them back, then opens that conversation. Only an entry the other writer can already read in the
 * feed is shared, which the dialog says; a private entry is not offered, only the way to share it.
 */
export default function DiscussWithSomeoneDialog({ entry, isDark, language, onClose, t }: DiscussWithSomeoneDialogProps) {
  const service = useAuthenticatedService(createMessagesService);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const writers = useWritersToMessage();
  const isPublic = entry.visibility === 'public';
  const [writerId, setWriterId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const ruleId = useId();
  const fieldId = useId();
  const errorId = useId();
  const name = useId();

  // Focus starts in the message, or on Close when there is nothing to send
  useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: isPublic ? fieldRef : closeRef, onClose });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const body = text.trim();
    if (writerId === null || !body) {
      setError(t(writerId === null ? 'discussWithSomeoneChooseWriter' : 'discussWithSomeoneWriteMessage'));
      return;
    }
    setSending(true);
    setError('');
    const opened = await service.open(writerId);
    const sent = opened.data ? await service.send(opened.data.id, body, entry.id) : null;
    if (!opened.data || !sent?.data) {
      setSending(false);
      setError(t(opened.error ?? sent?.error ?? 'messageSendError'));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    onClose();
    navigate(`/messages?conversation=${opened.data.id}`);
  };

  const subject = [formatEntryDay(entry.date, language), entry.title?.trim()].filter(Boolean).join(' · ');
  const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
  const lineClass = isDark ? 'border-gray-700' : 'border-gray-200';
  const secondaryButtonClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';
  const fieldClass = isDark ? 'border-gray-600 bg-gray-900' : 'border-gray-300 bg-white';
  const choiceClass = isDark
    ? 'border-gray-600 hover:bg-gray-700 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-500/15'
    : 'border-gray-300 hover:bg-gray-100 has-[:checked]:border-sky-600 has-[:checked]:bg-sky-50';
  const errorClass = isDark ? 'text-red-300' : 'text-red-700';

  // Portaled to the body, so no transformed ancestor in the entry list confines the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: a pointer target only; keyboard users close with Escape or Cancel. */}
      <button type="button" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-hidden="true" tabIndex={-1} />
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ruleId}
        onSubmit={(event) => void submit(event)}
        noValidate
        className={`relative z-10 m-0 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border p-0 shadow-2xl ${panelClass}`}
      >
        <header className={`border-b px-5 py-4 ${lineClass}`}>
          <h3 id={titleId} className="text-lg font-semibold">{t('discussWithSomeoneTitle')}</h3>
          <p className={`mt-1 text-sm ${mutedTextClass(isDark)}`}>{subject}</p>
          <p id={ruleId} className={`mt-2 text-sm ${mutedTextClass(isDark)}`}>{t('discussWithSomeoneRule')}</p>
        </header>
        {isPublic ? (
          <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <div className="space-y-1">
              <label htmlFor={fieldId} className="block font-medium">{t('discussWithSomeoneMessage')}</label>
              <textarea
                ref={fieldRef}
                id={fieldId}
                value={text}
                rows={3}
                maxLength={MESSAGE_MAX_LENGTH}
                placeholder={t('discussWithSomeonePlaceholder')}
                onChange={(event) => {
                  setText(event.target.value);
                  setError('');
                }}
                className={`w-full rounded-lg border px-3 py-2 ${fieldClass}`}
              />
            </div>
            <fieldset className="m-0 space-y-2 border-0 p-0" aria-describedby={error ? errorId : undefined}>
              <legend className="mb-1 font-medium">{t('discussWithSomeoneWriters')}</legend>
              {writers.isPending && <p className={mutedTextClass(isDark)}>{t('loading')}</p>}
              {writers.isError && <p role="alert" className={errorClass}>{t('messagesLoadError')}</p>}
              {writers.data?.length === 0 && <p className={mutedTextClass(isDark)}>{t('discussWithSomeoneNoWriters')}</p>}
              {writers.data?.map((writer) => (
                <label key={writer.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${choiceClass}`}>
                  <input
                    type="radio"
                    name={name}
                    value={writer.id}
                    checked={writerId === writer.id}
                    onChange={() => {
                      setWriterId(writer.id);
                      setError('');
                    }}
                    className="h-4 w-4 accent-sky-600"
                  />
                  <span>{writer.username}</span>
                </label>
              ))}
            </fieldset>
            {error && <p id={errorId} role="alert" className={errorClass}>{error}</p>}
          </div>
        ) : (
          <p role="note" className="px-5 py-4 text-sm">{t('discussWithSomeoneNotPublic')}</p>
        )}
        <footer className={`flex justify-end gap-3 border-t px-5 py-4 ${lineClass}`}>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}
          >
            {isPublic ? t('cancel') : t('close')}
          </button>
          {isPublic && (
            <button
              type="submit"
              aria-disabled={sending}
              className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800 aria-disabled:cursor-wait aria-disabled:opacity-60"
            >
              {sending ? t('discussWithSomeoneSending') : t('discussWithSomeoneSend')}
            </button>
          )}
        </footer>
      </form>
    </div>,
    document.body,
  );
}
