import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import type { TranslationFunction } from '../../types';

/** How long a message may be, as the API takes it. */
export const MESSAGE_MAX_LENGTH = 2000;

interface MessageComposerProps {
  readonly username: string;
  /** Sends the text; resolves to null once sent, or to the translation key of why it was not. */
  readonly onSend: (body: string) => Promise<string | null>;
  readonly t: TranslationFunction;
}

/** The field a message is written in: Enter sends it, Shift+Enter starts a new line; it empties once sent. */
export default function MessageComposer({ username, onSend, t }: MessageComposerProps) {
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = text.trim();

  const send = async () => {
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const failure = await onSend(body);
    setSending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setText('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <form className="messages-composer" onSubmit={submit}>
      <label htmlFor={fieldId} className="sr-only">{t('messagesComposerLabel', { username })}</label>
      <textarea
        id={fieldId}
        value={text}
        rows={2}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder={t('messagesComposerPlaceholder')}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={sendOnEnter}
      />
      <button type="submit" className="messages-send" disabled={!body || sending}>
        <span className="codicon codicon-send" aria-hidden="true" />
        <span>{sending ? t('messagesSending') : t('messagesSend')}</span>
      </button>
      <p id={hintId} className="messages-composer-hint">{t('messagesComposerHint')}</p>
      {error && <p id={errorId} className="messages-error" role="alert">{t(error)}</p>}
    </form>
  );
}
