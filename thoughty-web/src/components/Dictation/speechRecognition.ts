import type { DictationTranslationKey } from '../../utils/translations.dictation';

/** One recognized phrase as the Web Speech API reports it: final, or still changing (interim). */
export interface RecognizedResult {
    readonly isFinal: boolean;
    readonly length: number;
    readonly [index: number]: { readonly transcript: string } | undefined;
}

export interface RecognitionResultEvent {
    /** The first result that changed; those before it were final in an earlier event. */
    readonly resultIndex: number;
    readonly results: { readonly length: number; readonly [index: number]: RecognizedResult | undefined };
}

/** The part of the browser's `SpeechRecognition` that dictation uses (TypeScript's DOM types leave it out). */
export interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: RecognitionResultEvent) => void) | null;
    onerror: ((event: { readonly error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** The browser's speech recognition (Chromium and Safari name it `webkitSpeechRecognition`), or null where there is none. */
export function speechRecognitionConstructor(scope: object = globalThis): SpeechRecognitionConstructor | null {
    const { SpeechRecognition, webkitSpeechRecognition } = scope as {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
    };
    const candidate = SpeechRecognition ?? webkitSpeechRecognition;
    return typeof candidate === 'function' ? candidate as SpeechRecognitionConstructor : null;
}

/** The final and interim text of the results that changed in one event. */
export function readResults(event: RecognitionResultEvent): { final: string; interim: string } {
    let final = '';
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (result?.isFinal) final += transcript;
        else interim += transcript;
    }
    return { final: final.trim(), interim: interim.trim() };
}

export type DictationErrorKey = Extract<DictationTranslationKey, `dictationError${string}`>;

/** The message for a recognition error, or null when dictation was stopped on purpose. */
export function dictationErrorKey(error: string): DictationErrorKey | null {
    switch (error) {
        case 'aborted':
            return null;
        case 'not-allowed':
            return 'dictationErrorDenied';
        case 'service-not-allowed':
            return 'dictationErrorService';
        case 'audio-capture':
            return 'dictationErrorNoMicrophone';
        case 'no-speech':
            return 'dictationErrorNoSpeech';
        case 'network':
            return 'dictationErrorNetwork';
        case 'language-not-supported':
            return 'dictationErrorLanguage';
        default:
            return 'dictationErrorFailed';
    }
}

/**
 * The words to insert between `before` and `after`: one space separates them from a word just
 * before, and from a word or number right after; a space or punctuation already there is kept as is.
 */
export function dictatedSnippet(before: string, after: string, transcript: string): string {
    const words = transcript.replaceAll(/\s+/g, ' ').trim();
    if (!words) return '';
    const lead = before !== '' && !/\s$/.test(before) ? ' ' : '';
    const trail = /^[\p{L}\p{N}]/u.test(after) ? ' ' : '';
    return `${lead}${words}${trail}`;
}

const NOTICE_STORAGE_KEY = 'thoughty.dictationNoticeSeen';

/** Whether this browser has shown the note on where speech goes; false when storage is unavailable, so the note shows again. */
export function readNoticeSeen(): boolean {
    try {
        return globalThis.localStorage?.getItem(NOTICE_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function saveNoticeSeen(): void {
    try {
        globalThis.localStorage?.setItem(NOTICE_STORAGE_KEY, '1');
    } catch {
        // The note then shows again next time, which is the safe side.
    }
}
