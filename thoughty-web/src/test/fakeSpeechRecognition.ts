import { act } from '@testing-library/react';
import type { RecognitionResultEvent, RecognizedResult, SpeechRecognitionLike } from '../components/Dictation/speechRecognition';

/**
 * A stand-in for the browser's SpeechRecognition: `start()` records the session, and the test then
 * plays what the browser would report (results, errors, the end) through `FakeSpeechRecognition.latest`.
 */
export class FakeSpeechRecognition implements SpeechRecognitionLike {
    static instances: FakeSpeechRecognition[] = [];
    /** What the next `start()` does: start normally, or throw as a browser does when it cannot. */
    static failNextStart = false;

    static get latest(): FakeSpeechRecognition {
        const last = FakeSpeechRecognition.instances.at(-1);
        if (!last) throw new Error('No speech recognition was created');
        return last;
    }

    static reset(): void {
        FakeSpeechRecognition.instances = [];
        FakeSpeechRecognition.failNextStart = false;
    }

    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 0;
    onstart: (() => void) | null = null;
    onresult: ((event: RecognitionResultEvent) => void) | null = null;
    onerror: ((event: { readonly error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    started = false;
    stopped = false;
    aborted = false;
    /** Every result of the session so far, as the browser keeps them. */
    private readonly results: RecognizedResult[] = [];

    constructor() {
        FakeSpeechRecognition.instances.push(this);
    }

    start(): void {
        if (FakeSpeechRecognition.failNextStart) {
            FakeSpeechRecognition.failNextStart = false;
            throw new Error('InvalidStateError');
        }
        this.started = true;
    }

    stop(): void {
        this.stopped = true;
    }

    abort(): void {
        this.aborted = true;
    }

    /** The browser has the microphone and starts listening. */
    emitStart(): void {
        act(() => this.onstart?.());
    }

    /** An interim phrase, replacing the one being heard. */
    emitInterim(transcript: string): void {
        this.emit(transcript, false);
    }

    /** The phrase being heard becomes final. */
    emitFinal(transcript: string): void {
        this.emit(transcript, true);
    }

    emitError(error: string): void {
        act(() => this.onerror?.({ error }));
    }

    emitEnd(): void {
        act(() => this.onend?.());
    }

    private emit(transcript: string, isFinal: boolean): void {
        const last = this.results.at(-1);
        const index = last && !last.isFinal ? this.results.length - 1 : this.results.length;
        this.results[index] = { isFinal, length: 1, 0: { transcript } };
        const results = this.results;
        act(() => this.onresult?.({ resultIndex: index, results }));
    }
}

/** Installs the fake as the browser's (Chromium's prefixed name, as Chrome has it) until `uninstall` runs. */
export function installFakeSpeechRecognition(): () => void {
    FakeSpeechRecognition.reset();
    const scope = globalThis as { webkitSpeechRecognition?: unknown };
    scope.webkitSpeechRecognition = FakeSpeechRecognition;
    return () => {
        delete scope.webkitSpeechRecognition;
        FakeSpeechRecognition.reset();
    };
}
