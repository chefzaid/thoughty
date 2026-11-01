import type { Page } from '@playwright/test';

/** What a spec sees of the fake recognition sessions the page started. */
export interface FakeSpeechSession {
  readonly lang: string;
  readonly continuous: boolean;
  readonly interimResults: boolean;
  readonly started: boolean;
  readonly stopped: boolean;
}

interface FakeSpeechControl {
  sessions: FakeSpeechSession[];
  start(): void;
  interim(transcript: string): void;
  final(transcript: string): void;
  error(code: string): void;
  end(): void;
}

declare global {
  interface Window {
    __fakeSpeech?: FakeSpeechControl;
  }
}

/**
 * Replaces the browser's speech recognition with a fake before the app loads: no microphone, no
 * speech service. The spec then plays what the browser would report through `speech(page)`.
 * Stopping a session ends it at once, as Chrome does once it has handed over the last words.
 */
export async function installFakeSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Handler<T> = ((event: T) => void) | null;
    interface Result { isFinal: boolean; length: number; 0: { transcript: string } }

    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 0;
      started = false;
      stopped = false;
      onstart: Handler<Event> = null;
      onresult: Handler<{ resultIndex: number; results: Result[] }> = null;
      onerror: Handler<{ error: string }> = null;
      onend: Handler<Event> = null;
      results: Result[] = [];

      constructor() {
        control.sessions.push(this);
      }

      start() {
        this.started = true;
      }

      stop() {
        this.stopped = true;
        setTimeout(() => this.onend?.(new Event('end')), 0);
      }

      abort() {
        this.stopped = true;
      }

      emit(transcript: string, isFinal: boolean) {
        const last = this.results.at(-1);
        const index = last && !last.isFinal ? this.results.length - 1 : this.results.length;
        this.results[index] = { isFinal, length: 1, 0: { transcript } };
        this.onresult?.({ resultIndex: index, results: this.results });
      }
    }

    const latest = () => {
      const session = control.sessions.at(-1) as FakeRecognition | undefined;
      if (!session) throw new Error('No dictation was started');
      return session;
    };
    const control = {
      sessions: [] as FakeRecognition[],
      start: () => latest().onstart?.(new Event('start')),
      interim: (transcript: string) => latest().emit(transcript, false),
      final: (transcript: string) => latest().emit(transcript, true),
      error: (code: string) => latest().onerror?.({ error: code }),
      end: () => latest().onend?.(new Event('end')),
    };
    window.__fakeSpeech = control;
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true, writable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeRecognition, configurable: true, writable: true });
  });
}

/** Removes the browser's speech recognition, as in a browser without it (Firefox). */
export async function removeSpeechRecognition(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });
}

/** Plays the browser's side of the latest dictation session. */
export function speech(page: Page) {
  const call = (method: 'start' | 'interim' | 'final' | 'error' | 'end', value?: string) =>
    page.evaluate(([name, argument]) => {
      const control = window.__fakeSpeech;
      if (!control) throw new Error('The fake speech recognition is not installed');
      if (name === 'start' || name === 'end') control[name]();
      else control[name](argument ?? '');
    }, [method, value] as const);
  return {
    start: () => call('start'),
    interim: (transcript: string) => call('interim', transcript),
    final: (transcript: string) => call('final', transcript),
    error: (code: string) => call('error', code),
    end: () => call('end'),
    sessions: () => page.evaluate(() => (window.__fakeSpeech?.sessions ?? []).map(({ lang, continuous, interimResults, started, stopped }) => ({
      lang, continuous, interimResults, started, stopped,
    }))),
  };
}
