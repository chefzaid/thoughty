import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeech } from './useSpeech';

describe('useSpeech', () => {
  let onendCallback: (() => void) | null;
  const synth = globalThis.speechSynthesis;
  const speakMock = synth.speak as ReturnType<typeof vi.fn>;
  const cancelMock = synth.cancel as ReturnType<typeof vi.fn>;
  const addEventListenerMock = synth.addEventListener as ReturnType<typeof vi.fn>;
  const removeEventListenerMock = synth.removeEventListener as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onendCallback = null;

    // Reset the global mock methods for each test
    (synth.speak as ReturnType<typeof vi.fn>).mockReset().mockImplementation((utterance: { onend: (() => void) | null }) => {
      onendCallback = utterance.onend;
    });
    (synth.cancel as ReturnType<typeof vi.fn>).mockReset();
    (synth.getVoices as ReturnType<typeof vi.fn>).mockReset().mockReturnValue([]);
    (synth.addEventListener as ReturnType<typeof vi.fn>).mockReset();
    (synth.removeEventListener as ReturnType<typeof vi.fn>).mockReset();

    // Mock SpeechSynthesisUtterance
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string;
      lang = '';
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    });
  });

  it('returns initial state with speaking=false', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    expect(result.current.speaking).toBe(false);
    expect(result.current.activeEntryId).toBeNull();
    expect(typeof result.current.speakEntry).toBe('function');
    expect(typeof result.current.speakFromEntry).toBe('function');
    expect(typeof result.current.stop).toBe('function');
  });

  it('registers voiceschanged listener on mount', () => {
    renderHook(() => useSpeech({ language: 'en', readDates: false }));
    expect(addEventListenerMock).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );
    unmount();
    expect(removeEventListenerMock).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
    expect(cancelMock).toHaveBeenCalled();
  });

  it('speakEntry sets speaking=true and calls speechSynthesis.speak', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Hello world', date: '2024-01-15' });
    });

    expect(result.current.speaking).toBe(true);
    expect(speakMock).toHaveBeenCalled();
  });

  it('speakEntry without readDates uses only content text', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Test content', date: '2024-01-15' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.text).toBe('Test content');
  });

  it('speakEntry with readDates prepends formatted date', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: true })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Test content', date: '2024-01-15' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.text).toContain('Test content');
    // Date should be prepended with locale formatting
    expect(utterance.text).toContain('.');
    expect(utterance.text.length).toBeGreaterThan('Test content'.length);
  });

  it('speakEntry sets correct language for French', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'fr', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Bonjour', date: '2024-01-15' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.lang).toBe('fr-FR');
  });

  it('speakEntry sets correct language for English', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Hello', date: '2024-01-15' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.lang).toBe('en-US');
  });

  it('stop cancels speech and resets state', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Hello', date: '2024-01-15' });
    });

    expect(result.current.speaking).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.speaking).toBe(false);
    expect(result.current.activeEntryId).toBeNull();
    expect(cancelMock).toHaveBeenCalled();
  });

  it('speakFromEntry starts from the given entry id', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    const entries = [
      { id: 1, content: 'First', date: '2024-01-15' },
      { id: 2, content: 'Second', date: '2024-01-16' },
      { id: 3, content: 'Third', date: '2024-01-17' },
    ];

    act(() => {
      result.current.speakFromEntry(entries, 2);
    });

    expect(result.current.speaking).toBe(true);
    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.text).toBe('Second');
  });

  it('speakFromEntry does nothing if startId is not found', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakFromEntry(
        [{ id: 1, content: 'First', date: '2024-01-15' }],
        999
      );
    });

    expect(result.current.speaking).toBe(false);
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('advances to next entry when onend fires', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    const entries = [
      { id: 1, content: 'First', date: '2024-01-15' },
      { id: 2, content: 'Second', date: '2024-01-16' },
    ];

    act(() => {
      result.current.speakFromEntry(entries, 1);
    });

    expect(speakMock).toHaveBeenCalledTimes(1);

    // Trigger onend to advance to next entry
    act(() => {
      onendCallback?.();
    });

    expect(speakMock).toHaveBeenCalledTimes(2);
    const secondUtterance = speakMock.mock.calls[1]![0];
    expect(secondUtterance.text).toBe('Second');
  });

  it('stops speaking when queue is exhausted after onend', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Only entry', date: '2024-01-15' });
    });

    expect(result.current.speaking).toBe(true);

    // Trigger onend — queue is now empty
    act(() => {
      onendCallback?.();
    });

    expect(result.current.speaking).toBe(false);
    expect(result.current.activeEntryId).toBeNull();
  });

  it('handles onerror by advancing to next entry', () => {
    let onerrorCallback: ((e: { error: string }) => void) | null = null;
    speakMock.mockImplementation((utterance) => {
      onendCallback = utterance.onend;
      onerrorCallback = utterance.onerror;
    });

    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    const entries = [
      { id: 1, content: 'First', date: '2024-01-15' },
      { id: 2, content: 'Second', date: '2024-01-16' },
    ];

    act(() => {
      result.current.speakFromEntry(entries, 1);
    });

    // Trigger non-canceled error
    act(() => {
      onerrorCallback?.({ error: 'network' });
    });

    expect(speakMock).toHaveBeenCalledTimes(2);
  });

  it('handles onerror with canceled error by not advancing', () => {
    let onerrorCallback: ((e: { error: string }) => void) | null = null;
    speakMock.mockImplementation((utterance) => {
      onendCallback = utterance.onend;
      onerrorCallback = utterance.onerror;
    });

    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Hello', date: '2024-01-15' });
    });

    act(() => {
      onerrorCallback?.({ error: 'canceled' });
    });

    // Should not have called speak again after the canceled error
    expect(speakMock).toHaveBeenCalledTimes(1);
  });

  it('selects voice matching language prefix when available', () => {
    const frenchVoice = { lang: 'fr-FR', default: false, name: 'French Voice', voiceURI: 'french-voice' };
    const englishVoice = { lang: 'en-US', default: true, name: 'English Voice', voiceURI: 'english-voice' };
    (synth.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([frenchVoice, englishVoice]);

    // Re-render to pick up voices
    const { result } = renderHook(() =>
      useSpeech({ language: 'fr', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Bonjour', date: '2024-01-15' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.voice).toBe(frenchVoice);
  });

  it('prefers the saved voice when its URI is available', () => {
    const defaultEnglishVoice = { lang: 'en-US', default: true, name: 'English Voice', voiceURI: 'english-default' };
    const preferredEnglishVoice = { lang: 'en-GB', default: false, name: 'English Voice 2', voiceURI: 'english-preferred' };
    (synth.getVoices as ReturnType<typeof vi.fn>).mockReturnValue([defaultEnglishVoice, preferredEnglishVoice]);

    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false, voiceUri: 'english-preferred' })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Hello', date: '2024-01-15' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    expect(utterance.voice).toBe(preferredEnglishVoice);
  });

  it('handles invalid date gracefully in formatDateForSpeech', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: true })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'Test', date: 'invalid-date' });
    });

    const utterance = speakMock.mock.calls[0]![0];
    // Should fall back to the raw date string
    expect(utterance.text).toContain('invalid-date');
  });

  it('calling speakEntry while already speaking stops previous speech', () => {
    const { result } = renderHook(() =>
      useSpeech({ language: 'en', readDates: false })
    );

    act(() => {
      result.current.speakEntry({ id: 1, content: 'First', date: '2024-01-15' });
    });

    act(() => {
      result.current.speakEntry({ id: 2, content: 'Second', date: '2024-01-16' });
    });

    // cancel should have been called (at least once for the stop before new speak)
    expect(cancelMock).toHaveBeenCalled();
    // The last utterance should be "Second"
    const lastCall = speakMock.mock.calls.at(-1)?.[0];
    expect(lastCall.text).toBe('Second');
  });
});
