import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSpeechLang } from '../../utils/speechVoices';
import {
    dictationErrorKey,
    readResults,
    speechRecognitionConstructor,
    type DictationErrorKey,
    type SpeechRecognitionLike,
} from './speechRecognition';

interface DictationOptions {
    /** The app language (`en` or `fr`); speech is recognized as `en-US` or `fr-FR`. */
    readonly language: string;
    /** Receives each phrase once the browser settles on it. */
    readonly onFinal: (transcript: string) => void;
}

export type DictationAnnouncement = 'dictationStarted' | 'dictationStopped' | '';

/** The one dictation running on the page: starting another stops it, so two fields never listen at once. */
let active: { readonly recognition: SpeechRecognitionLike; readonly stop: () => void } | null = null;

function clearActive(recognition: SpeechRecognitionLike): void {
    if (active?.recognition === recognition) active = null;
}

/** Stops whatever dictation is running, for a view (focus mode) that opens over the field it writes into. */
export function stopActiveDictation(): void {
    active?.stop();
}

/**
 * Live dictation through the browser's own speech recognition (Web Speech API): no server and no AI
 * key. It listens only between a press of start and stop (or Escape, or the browser ending it), and
 * never starts or restarts by itself. Interim words are kept apart; final ones go to `onFinal`.
 */
export function useDictation({ language, onFinal }: DictationOptions) {
    const Recognition = useMemo(() => speechRecognitionConstructor(), []);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const onFinalRef = useRef(onFinal);
    onFinalRef.current = onFinal;
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState('');
    const [error, setError] = useState<DictationErrorKey | null>(null);
    const [announcement, setAnnouncement] = useState<DictationAnnouncement>('');

    const stop = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;
        recognitionRef.current = null;
        clearActive(recognition);
        // The browser still hands over the words heard so far, then ends
        recognition.stop();
        setListening(false);
        setInterim('');
    }, []);

    const start = useCallback(() => {
        if (!Recognition || recognitionRef.current) return;
        active?.stop();
        const recognition = new Recognition();
        // Whether this session is still the field's own (not replaced by a newer one after a stop)
        const isLatest = () => recognitionRef.current === recognition || recognitionRef.current === null;
        recognition.lang = getSpeechLang(language);
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setAnnouncement('dictationStarted');
        recognition.onresult = (event) => {
            const { final, interim: changing } = readResults(event);
            if (final) onFinalRef.current(final);
            if (recognitionRef.current === recognition) setInterim(changing);
        };
        recognition.onerror = (event) => {
            const key = dictationErrorKey(event.error);
            if (key && isLatest()) setError(key);
        };
        recognition.onend = () => {
            if (!isLatest()) return;
            recognitionRef.current = null;
            clearActive(recognition);
            setListening(false);
            setInterim('');
            setAnnouncement('dictationStopped');
        };
        recognitionRef.current = recognition;
        active = { recognition, stop };
        setError(null);
        setInterim('');
        setListening(true);
        try {
            recognition.start();
        } catch {
            recognitionRef.current = null;
            clearActive(recognition);
            setListening(false);
            setError('dictationErrorFailed');
        }
    }, [Recognition, language, stop]);

    // Escape stops dictation wherever focus is, and does nothing else (focus mode stays open)
    useEffect(() => {
        if (!listening) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            stop();
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [listening, stop]);

    // Leaving the page or the field ends dictation for good
    useEffect(() => () => {
        const recognition = recognitionRef.current;
        if (!recognition) return;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
        recognitionRef.current = null;
        clearActive(recognition);
    }, []);

    return { supported: Recognition !== null, listening, interim, error, announcement, start, stop };
}
