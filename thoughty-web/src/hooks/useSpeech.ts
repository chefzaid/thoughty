import { useState, useCallback, useRef, useEffect } from 'react';
import { getPreferredSpeechVoice, getSpeechLang } from '../utils/speechVoices';

export interface SpeechEntry {
  id: number;
  content: string;
  date: string;
}

interface SpeechOptions {
  language: string;
  readDates: boolean;
  voiceUri?: string;
}

interface UseSpeechReturn {
  speaking: boolean;
  activeEntryId: number | null;
  speakEntry: (entry: SpeechEntry) => void;
  speakFromEntry: (entries: SpeechEntry[], startId: number) => void;
  stop: () => void;
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

function buildUtteranceText(entry: SpeechEntry, options: SpeechOptions): string {
  const parts: string[] = [];
  if (options.readDates) {
    parts.push(formatDateForSpeech(entry.date, options.language));
  }
  parts.push(entry.content);
  return parts.join('. ');
}

export function useSpeech(options: SpeechOptions): UseSpeechReturn {
  const [speaking, setSpeaking] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
  const queueRef = useRef<SpeechEntry[]>([]);
  const stoppedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Voices may load asynchronously — trigger a re-read when available
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const synth = globalThis.speechSynthesis;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
    };
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      synth.cancel();
    };
  }, []);

  const speakNext = useCallback(() => {
    if (stoppedRef.current || queueRef.current.length === 0) {
      setSpeaking(false);
      setActiveEntryId(null);
      queueRef.current = [];
      return;
    }

    const entry = queueRef.current.shift();
    if (!entry) return;
    setActiveEntryId(entry.id);

    const utterance = new SpeechSynthesisUtterance(
      buildUtteranceText(entry, optionsRef.current)
    );
    utterance.lang = getSpeechLang(optionsRef.current.language);
    const voice = getPreferredSpeechVoice(
      voicesRef.current,
      optionsRef.current.language,
      optionsRef.current.voiceUri,
    );
    if (voice) utterance.voice = voice;

    utterance.onend = () => speakNext();
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') speakNext();
    };

    globalThis.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    queueRef.current = [];
    globalThis.speechSynthesis.cancel();
    setSpeaking(false);
    setActiveEntryId(null);
  }, []);

  const speakEntry = useCallback(
    (entry: SpeechEntry) => {
      stop();
      stoppedRef.current = false;
      queueRef.current = [entry];
      setSpeaking(true);
      speakNext();
    },
    [stop, speakNext]
  );

  const speakFromEntry = useCallback(
    (entries: SpeechEntry[], startId: number) => {
      const startIndex = entries.findIndex((e) => e.id === startId);
      if (startIndex === -1) return;

      stop();
      stoppedRef.current = false;
      queueRef.current = entries.slice(startIndex);
      setSpeaking(true);
      speakNext();
    },
    [stop, speakNext]
  );

  return { speaking, activeEntryId, speakEntry, speakFromEntry, stop };
}
