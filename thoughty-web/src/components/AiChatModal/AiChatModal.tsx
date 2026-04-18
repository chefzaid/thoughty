import { useState, useRef, useEffect, useCallback } from 'react';
import type { Entry } from '../../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatModalProps {
  readonly entry: Entry;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSend: (entryContent: string, messages: ChatMessage[]) => Promise<string | null>;
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string) => string;
}

function AiChatModal({ entry, isOpen, onClose, onSend, theme = 'dark', t }: AiChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLight = theme === 'light';

  // Reset state when entry changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setInput('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, entry.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, loading]);

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

    const reply = await onSend(entry.content, updatedMessages);

    setLoading(false);

    if (reply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } else {
      setError(t('aiChatError'));
    }
  }, [input, loading, messages, entry.content, onSend, t]);

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
          {messages.length === 0 && !loading && (
            <p className={`text-center text-sm italic ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('aiChatPlaceholder')}
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : isLight
                      ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                      : 'bg-gray-700 text-gray-200 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
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
              className={`flex-1 resize-none rounded-lg px-4 py-2.5 text-sm border focus:ring-2 focus:ring-blue-500 outline-none ${
                isLight
                  ? 'bg-gray-50 border-gray-300 text-gray-900'
                  : 'bg-gray-900 border-gray-600 text-gray-100'
              }`}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
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
