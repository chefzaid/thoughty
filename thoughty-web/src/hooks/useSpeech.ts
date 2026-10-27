import { useState, useCallback, useRef, useEffect } from 'react';
import { getPreferredSpeechVoice, getSpeechLang } from '../utils/speechVoices';

export interface SpeechEntry {
  id: number;
  content: string;
  date: string;
  /** The entry's own language when known; the reader's language is used otherwise. */
  language?: string;
}

/**
 * Supplies the entries that follow `afterId` once a "read from here" queue runs out,
 * for example by loading the next page of a list. Resolves to an empty list at the end.
 */
export type LoadMoreSpeechEntries = (afterId: number) => Promise<SpeechEntry[]>;

interface SpeechOptions {
  language: string;
  readDates: boolean;
  voiceUri?: string;
}

interface UseSpeechReturn {
  /** Whether the browser offers speech synthesis at all. */
  supported: boolean;
  speaking: boolean;
  activeEntryId: number | null;
  speakEntry: (entry: SpeechEntry) => void;
  speakFromEntry: (entries: SpeechEntry[], startId: number, loadMore?: LoadMoreSpeechEntries) => void;
  stop: () => void;
}

function getSynth(): SpeechSynthesis | null {
  return 'speechSynthesis' in globalThis ? globalThis.speechSynthesis : null;
}

function formatDateForSpeech(dateStr: string, lang: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(getSpeechLang(lang), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildUtteranceText(entry: SpeechEntry, language: string, readDates: boolean): string {
  const parts: string[] = [];
  if (readDates) {
    parts.push(formatDateForSpeech(entry.date, language));
  }
  parts.push(entry.content);
  return parts.join('. ');
}

function buildUtterance(
  entry: SpeechEntry,
  options: SpeechOptions,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisUtterance {
  const language = entry.language ?? options.language;
  const utterance = new SpeechSynthesisUtterance(buildUtteranceText(entry, language, options.readDates));
  utterance.lang = getSpeechLang(language);
  // The chosen voice speaks the reader's language; another language gets that language's default voice.
  const sameLanguage = utterance.lang === getSpeechLang(options.language);
  const voice = getPreferredSpeechVoice(voices, language, sameLanguage ? options.voiceUri : undefined);
  if (voice) utterance.voice = voice;
  return utterance;
}

export function useSpeech(options: SpeechOptions): UseSpeechReturn {
  const [speaking, setSpeaking] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
  const queueRef = useRef<SpeechEntry[]>([]);
  const loadMoreRef = useRef<LoadMoreSpeechEntries | undefined>(undefined);
  const lastEntryIdRef = useRef<number | null>(null);
  /** Bumped on every start and stop, so a late "load more" answer from an earlier reading is ignored. */
  const sessionRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const supported = getSynth() !== null;

  // Voices may load asynchronously — trigger a re-read when available
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const synth = getSynth();
    if (!synth) return undefined;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
    };
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => {
      sessionRef.current += 1;
      queueRef.current = [];
      loadMoreRef.current = undefined;
      synth.removeEventListener('voiceschanged', loadVoices);
      synth.cancel();
    };
  }, []);

  const finish = useCallback(() => {
    queueRef.current = [];
    loadMoreRef.current = undefined;
    lastEntryIdRef.current = null;
    setSpeaking(false);
    setActiveEntryId(null);
  }, []);

  const speakNext = useCallback((session: number) => {
    if (session !== sessionRef.current) return;

    const entry = queueRef.current.shift();
    if (!entry) {
      const loadMore = loadMoreRef.current;
      const lastId = lastEntryIdRef.current;
      if (!loadMore || lastId === null) {
        finish();
        return;
      }
      loadMore(lastId).then(
        (more) => {
          if (session !== sessionRef.current) return;
          if (more.length === 0) {
            finish();
            return;
          }
          queueRef.current = [...more];
          speakNext(session);
        },
        () => {
          if (session === sessionRef.current) finish();
        },
      );
      return;
    }

    lastEntryIdRef.current = entry.id;
    setActiveEntryId(entry.id);

    const utterance = buildUtterance(entry, optionsRef.current, voicesRef.current);
    utterance.onend = () => speakNext(session);
    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') speakNext(session);
    };

    getSynth()?.speak(utterance);
  }, [finish]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    getSynth()?.cancel();
    finish();
  }, [finish]);

  const start = useCallback(
    (queue: SpeechEntry[], loadMore?: LoadMoreSpeechEntries) => {
      if (!getSynth()) return;
      stop();
      queueRef.current = queue;
      loadMoreRef.current = loadMore;
      setSpeaking(true);
      speakNext(sessionRef.current);
    },
    [stop, speakNext]
  );

  const speakEntry = useCallback((entry: SpeechEntry) => start([entry]), [start]);

  const speakFromEntry = useCallback(
    (entries: SpeechEntry[], startId: number, loadMore?: LoadMoreSpeechEntries) => {
      const startIndex = entries.findIndex((e) => e.id === startId);
      if (startIndex === -1) return;
      start(entries.slice(startIndex), loadMore);
    },
    [start]
  );

  return { supported, speaking, activeEntryId, speakEntry, speakFromEntry, stop };
}
