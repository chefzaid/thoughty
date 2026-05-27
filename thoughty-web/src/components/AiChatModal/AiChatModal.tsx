import { useState, useRef, useEffect, useCallback } from 'react';
import type { Entry } from '../../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildTranscript(entry: Entry, messages: ChatMessage[]): string {
  const entryTags = entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : 'Tags: None';
  const transcriptLines = messages.flatMap((message) => [
    `${message.role === 'user' ? 'User' : 'Assistant'}:`,
    message.content,
    '',
  ]);

  return [
    'Thoughty AI Chat Transcript',
    '',
    `Entry ID: ${entry.id}`,
    `Date: ${entry.date}`,
    entryTags,
    '',
    'Entry:',
    entry.content,
    '',
    'Conversation:',
    '',
    ...transcriptLines,
  ].join('\n').trimEnd();
}

function downloadTranscript(entry: Entry, messages: ChatMessage[]): void {
  const transcript = buildTranscript(entry, messages);
  const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeDate = entry.date.replace(/[^0-9-]/g, '-') || 'entry';

  anchor.href = url;
  anchor.download = `thoughty_ai_chat_${safeDate}_entry-${entry.id}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

interface AiChatModalProps {
  readonly entry: Entry;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSend: (entryId: number, entryContent: string, messages: ChatMessage[]) => Promise<string | null>;
  readonly onLoadHistory: (entryId: number) => Promise<ChatMessage[]>;
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string) => string;
}

function AiChatModal({ entry, isOpen, onClose, onSend, onLoadHistory, theme = 'dark', t }: AiChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLight = theme === 'light';

  // Load persisted history from the API when the modal opens or the active entry changes.
  useEffect(() => {
    if (!isOpen) {
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;

    setMessages([]);
    setInput('');
    setError('');
    setLoading(false);
    setHistoryLoading(true);

    void onLoadHistory(entry.id)
      .then((loadedMessages) => {
        if (!cancelled) {
          setMessages(loadedMessages);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entry.id, isOpen, onLoadHistory]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, loading, historyLoading]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setError('');
    setLoading(true);

    const reply = await onSend(entry.id, entry.content, updatedMessages);

    setLoading(false);

    if (reply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } else {
      setError(t('aiChatError'));
    }
  }, [entry.content, entry.id, input, loading, messages, onSend, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!isOpen) return null;

  const entryPreview = entry.content.length > 200
    ? entry.content.slice(0, 200) + '...'
    : entry.content;
  const assistantMessageClassName = isLight
    ? 'bg-gray-100 text-gray-800 rounded-bl-md'
    : 'bg-gray-700 text-gray-200 rounded-bl-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-4 rounded-xl shadow-2xl border flex flex-col ${
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
        }`}
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isLight ? 'border-gray-200' : 'border-gray-700'
        }`}>
          <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
            {t('aiChat')}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadTranscript(entry, messages)}
              disabled={historyLoading || messages.length === 0}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isLight
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {t('exportChatHistory')}
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-700 text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Entry context */}
        <div className={`px-5 py-3 border-b text-sm ${
          isLight ? 'bg-gray-50 border-gray-200 text-gray-600' : 'bg-gray-900/50 border-gray-700 text-gray-400'
        }`}>
          <span className="font-medium">{entry.date}</span>
          {entry.tags.length > 0 && (
            <span className="ml-2 text-xs opacity-70">#{entry.tags.join(' #')}</span>
          )}
          <p className="mt-1 whitespace-pre-wrap line-clamp-3">{entryPreview}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[200px]">
          {historyLoading && (
            <p className={`text-center text-sm italic ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('aiLoadingHistory')}
            </p>
          )}
          {messages.length === 0 && !loading && !historyLoading && (
            <p className={`text-center text-sm italic ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('aiChatPlaceholder')}
            </p>
          )}
          {messages.map((msg, i) => {
            const messageKey = `${msg.role}:${msg.content}:${messages.slice(0, i).filter((candidate) => (
              candidate.role === msg.role && candidate.content === msg.content
            )).length}`;

            return (
              <div
                key={messageKey}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : assistantMessageClassName
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className={`px-4 py-2.5 rounded-2xl rounded-bl-md text-sm ${
                isLight ? 'bg-gray-100 text-gray-500' : 'bg-gray-700 text-gray-400'
              }`}>
                {t('aiThinking')}
              </div>
            </div>
          )}
          {error && (
            <div className="px-4 py-2.5 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`px-5 py-4 border-t ${isLight ? 'border-gray-200' : 'border-gray-700'}`}>
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('aiChatPlaceholder')}
              rows={1}
              disabled={historyLoading}
              className={`flex-1 resize-none rounded-lg px-4 py-2.5 text-sm border focus:ring-2 focus:ring-blue-500 outline-none ${
                isLight
                  ? 'bg-gray-50 border-gray-300 text-gray-900'
                  : 'bg-gray-900 border-gray-600 text-gray-100'
              }`}
            />
            <button
              onClick={handleSend}
              disabled={historyLoading || !input.trim() || loading}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiChatModal;
