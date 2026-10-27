import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeech, type SpeechEntry } from './useSpeech';

interface FakeUtterance {
  text: string;
  lang: string;
  voice: unknown;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

const synth = globalThis.speechSynthesis;
const speakMock = synth.speak as ReturnType<typeof vi.fn>;
const spoken: FakeUtterance[] = [];

const entry = (id: number, extra: Partial<SpeechEntry> = {}): SpeechEntry => ({
  id, content: `Entry ${id}`, date: '2026-08-01', ...extra,
});

const voice = (voiceURI: string, lang: string, isDefault = false) =>
  ({ voiceURI, lang, name: voiceURI, default: isDefault }) as SpeechSynthesisVoice;

function finishCurrent() {
  act(() => spoken.at(-1)?.onend?.());
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useSpeech per-entry language and continuation', () => {
  beforeEach(() => {
    spoken.length = 0;
    speakMock.mockReset().mockImplementation((utterance: FakeUtterance) => spoken.push(utterance));
    (synth.cancel as ReturnType<typeof vi.fn>).mockReset();
    (synth.getVoices as ReturnType<typeof vi.fn>).mockReset().mockReturnValue([
      voice('en-chosen', 'en-GB'),
      voice('en-default', 'en-US', true),
      voice('fr-default', 'fr-FR', true),
    ]);
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

  it('reads an entry in its own language with that language\'s voice, keeping the chosen voice for the reader\'s language', () => {
    const { result } = renderHook(() => useSpeech({ language: 'en', readDates: true, voiceUri: 'en-chosen' }));

    act(() => result.current.speakFromEntry([entry(1, { language: 'fr' }), entry(2)], 1));
    expect(spoken[0]!.lang).toBe('fr-FR');
    expect((spoken[0]!.voice as SpeechSynthesisVoice).voiceURI).toBe('fr-default');
    expect(spoken[0]!.text).toMatch(/^samedi 1 août 2026\. Entry 1$/);

    finishCurrent();
    expect(spoken[1]!.lang).toBe('en-US');
    expect((spoken[1]!.voice as SpeechSynthesisVoice).voiceURI).toBe('en-chosen');
  });

  it('asks for more entries after the last one and reads them in order until none are left', async () => {
    const loadMore = vi.fn()
      .mockResolvedValueOnce([entry(3), entry(4)])
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useSpeech({ language: 'en', readDates: false }));

    act(() => result.current.speakFromEntry([entry(1), entry(2)], 2, loadMore));
    expect(result.current.activeEntryId).toBe(2);

    finishCurrent();
    expect(loadMore).toHaveBeenCalledWith(2);
    expect(result.current.speaking).toBe(true);
    await flush();
    expect(result.current.activeEntryId).toBe(3);

    finishCurrent();
    finishCurrent();
    expect(loadMore).toHaveBeenLastCalledWith(4);
    await flush();

    expect(spoken.map((utterance) => utterance.text)).toEqual(['Entry 2', 'Entry 3', 'Entry 4']);
    expect(result.current.speaking).toBe(false);
    expect(result.current.activeEntryId).toBeNull();
  });

  it('ignores more entries that arrive after the reading was stopped', async () => {
    let resolveMore: (entries: SpeechEntry[]) => void = () => undefined;
    const loadMore = vi.fn(() => new Promise<SpeechEntry[]>((resolve) => { resolveMore = resolve; }));
    const { result } = renderHook(() => useSpeech({ language: 'en', readDates: false }));

    act(() => result.current.speakFromEntry([entry(1)], 1, loadMore));
    finishCurrent();
    act(() => result.current.stop());
    resolveMore([entry(2)]);
    await flush();

    expect(spoken).toHaveLength(1);
    expect(result.current.speaking).toBe(false);
  });

  it('stops reading on when the page unmounts while more entries load', async () => {
    let resolveMore: (entries: SpeechEntry[]) => void = () => undefined;
    const loadMore = vi.fn(() => new Promise<SpeechEntry[]>((resolve) => { resolveMore = resolve; }));
    const { result, unmount } = renderHook(() => useSpeech({ language: 'en', readDates: false }));

    act(() => result.current.speakFromEntry([entry(1)], 1, loadMore));
    finishCurrent();
    unmount();
    resolveMore([entry(2)]);
    await flush();

    expect(spoken).toHaveLength(1);
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('ends the reading when loading more entries fails', async () => {
    const loadMore = vi.fn().mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useSpeech({ language: 'en', readDates: false }));

    act(() => result.current.speakFromEntry([entry(1)], 1, loadMore));
    finishCurrent();
    await flush();

    expect(result.current.speaking).toBe(false);
  });

  it('a new reading replaces one still waiting for more entries', async () => {
    let resolveMore: (entries: SpeechEntry[]) => void = () => undefined;
    const loadMore = vi.fn(() => new Promise<SpeechEntry[]>((resolve) => { resolveMore = resolve; }));
    const { result } = renderHook(() => useSpeech({ language: 'en', readDates: false }));

    act(() => result.current.speakFromEntry([entry(1)], 1, loadMore));
    finishCurrent();
    act(() => result.current.speakEntry(entry(9)));
    resolveMore([entry(2)]);
    await flush();

    expect(spoken.map((utterance) => utterance.text)).toEqual(['Entry 1', 'Entry 9']);
    expect(result.current.activeEntryId).toBe(9);
  });

  it('does not advance when an utterance is interrupted', () => {
    const { result } = renderHook(() => useSpeech({ language: 'en', readDates: false }));

    act(() => result.current.speakFromEntry([entry(1), entry(2)], 1));
    act(() => spoken[0]!.onerror?.({ error: 'interrupted' }));

    expect(spoken).toHaveLength(1);
  });
});

describe('useSpeech without speech synthesis', () => {
  it('reports itself unsupported and does nothing', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis')!;
    Reflect.deleteProperty(globalThis, 'speechSynthesis');
    try {
      const { result, unmount } = renderHook(() => useSpeech({ language: 'en', readDates: false }));
      expect(result.current.supported).toBe(false);
      act(() => result.current.speakEntry(entry(1)));
      expect(result.current.speaking).toBe(false);
      act(() => result.current.stop());
      unmount();
    } finally {
      Object.defineProperty(globalThis, 'speechSynthesis', original);
    }
  });
});
