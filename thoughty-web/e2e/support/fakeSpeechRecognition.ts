import type { Page } from '@playwright/test';

/** What the fake speech-recognition model hears in the next recording: its text, or why it gives none. */
export type FakeSpeechReply = { readonly text: string } | { readonly problem: string };

/** A recording the fake model was sent: the language asked for and how many 16 kHz samples the page decoded. */
export interface HeardRecording {
  readonly language: string;
  readonly samples: number;
}

/**
 * Stands in for the speech-recognition worker (`src/services/speech/speechWorker.ts`), so no model is downloaded:
 * the page's `Worker` is wrapped before the app loads, and a worker started from `speechWorker` is a fake that
 * answers each recording with the next of `replies` (counted across page loads), in the worker's own messages. It first says the model is
 * downloading (39 of 78 MB) and waits for `releaseSpeech` before transcribing, so a spec sees each step. The app
 * itself is unchanged: it decodes each recording with the browser's Web Audio API and sends the samples as usual.
 */
export async function fakeSpeechRecognition(page: Page, replies: readonly FakeSpeechReply[]): Promise<void> {
  await page.addInitScript((planned: readonly FakeSpeechReply[]) => {
    const NativeWorker = globalThis.Worker;
    // The replies already given, kept across page loads in this tab
    const next = () => {
      const used = Number(sessionStorage.getItem('fakeSpeechReplies') ?? '0');
      sessionStorage.setItem('fakeSpeechReplies', String(used + 1));
      return planned[used];
    };
    const heard: HeardRecording[] = [];
    let waiting: (() => void)[] = [];

    class FakeSpeechWorker extends EventTarget {
      postMessage(request: { id: number; samples: Float32Array; language: string }) {
        const reply = next() ?? { problem: 'deviceSpeechFailed' };
        heard.push({ language: request.language, samples: request.samples.length });
        const say = (data: unknown) => this.dispatchEvent(new MessageEvent('message', { data }));
        setTimeout(() => {
          say({ type: 'progress', id: request.id, phase: 'downloading', loaded: 39_000_000, total: 78_000_000 });
          waiting.push(() => {
            say({ type: 'progress', id: request.id, phase: 'transcribing' });
            say('text' in reply ? { type: 'result', id: request.id, text: reply.text } : { type: 'error', id: request.id, problem: reply.problem });
          });
        }, 0);
      }

      terminate() {
        // Nothing to stop
      }
    }

    function SpeechAwareWorker(url: string | URL, options?: WorkerOptions) {
      return String(url).includes('speechWorker') ? new FakeSpeechWorker() : new NativeWorker(url, options);
    }
    Object.assign(globalThis, {
      Worker: SpeechAwareWorker,
      __fakeSpeech: {
        heard,
        waiting: () => waiting.length,
        release: () => {
          const ready = waiting;
          waiting = [];
          for (const answer of ready) answer();
        },
      },
    });
  }, replies);
}

interface FakeSpeechHandle {
  readonly heard: HeardRecording[];
  waiting(): number;
  release(): void;
}

/** Lets every recording the fake model is holding be transcribed, once it holds at least one. */
export async function releaseSpeech(page: Page): Promise<void> {
  await page.waitForFunction(() => (globalThis as unknown as { __fakeSpeech: FakeSpeechHandle }).__fakeSpeech.waiting() > 0);
  await page.evaluate(() => (globalThis as unknown as { __fakeSpeech: FakeSpeechHandle }).__fakeSpeech.release());
}

/** The recordings the fake model was sent, in order. */
export function heardRecordings(page: Page): Promise<HeardRecording[]> {
  return page.evaluate(() => [...(globalThis as unknown as { __fakeSpeech: FakeSpeechHandle }).__fakeSpeech.heard]);
}

/** A short WAV recording (half a second of a 440 Hz tone, 8 kHz mono) that the browser's Web Audio API decodes. */
export function toneWav(name: string): { name: string; mimeType: string; buffer: Buffer } {
  const rate = 8000;
  const samples = rate / 2;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * index) / rate) * 8000), 44 + index * 2);
  }
  return { name, mimeType: 'audio/wav', buffer: wav };
}
