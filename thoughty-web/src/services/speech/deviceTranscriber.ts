import { canDecodeSpeech, decodeSpeechSamples } from './audioDecoding';
import type { DeviceSpeechProblem, SpeechLanguage, SpeechProgress, SpeechReply, SpeechRequest } from './speechProtocol';

export type DeviceSpeechResult = { readonly text: string; readonly problem: null } | { readonly text: null; readonly problem: DeviceSpeechProblem };

export interface DeviceSpeechOptions {
  readonly language: SpeechLanguage;
  readonly onProgress?: (progress: SpeechProgress) => void;
}

/** What the page needs of a worker, so tests can stand in for it. */
export type SpeechWorker = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener'>;

/** The model is let go this long after the last recording, giving its memory back (it reloads from the cache). */
const IDLE_MS = 60_000;

/** Whether this device can run the speech-recognition model: WebAssembly, Web Workers and Web Audio. */
export function isDeviceSpeechSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof Worker === 'function' && canDecodeSpeech();
}

/** The worker the app's build bundles apart (`speechWorker.ts`, with transformers.js loaded inside it on demand). */
function startSpeechWorker(): SpeechWorker {
  return new Worker(new URL('./speechWorker.ts', import.meta.url), { type: 'module', name: 'thoughty-speech' });
}

interface Pending {
  readonly resolve: (result: DeviceSpeechResult) => void;
  readonly onProgress?: (progress: SpeechProgress) => void;
}

/**
 * Transcribes recordings on this device, one at a time: each is decoded here to 16 kHz mono and sent to the
 * speech-recognition worker, which loads the model the first time and answers with the text. Nothing but the
 * model's files is downloaded, and the recording does not leave the device. The worker starts with the first
 * recording and stops a minute after the last, or when it fails (the next recording starts a new one).
 */
export function createDeviceTranscriber(startWorker: () => SpeechWorker = startSpeechWorker, supported = isDeviceSpeechSupported, idleMs = IDLE_MS) {
  let worker: SpeechWorker | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let nextId = 1;
  let turn: Promise<unknown> = Promise.resolve();
  const pending = new Map<number, Pending>();

  const stop = (problem: DeviceSpeechProblem | null) => {
    worker?.terminate();
    worker = null;
    for (const { resolve } of pending.values()) resolve({ text: null, problem: problem ?? 'deviceSpeechFailed' });
    pending.clear();
  };

  const answer = ({ data: reply }: MessageEvent<SpeechReply>) => {
    const request = pending.get(reply.id);
    if (!request) return;
    if (reply.type === 'progress') {
      request.onProgress?.(reply.phase === 'downloading' ? { phase: 'downloading', loaded: reply.loaded, total: reply.total } : { phase: 'transcribing' });
      return;
    }
    pending.delete(reply.id);
    request.resolve(reply.type === 'result' ? { text: reply.text, problem: null } : { text: null, problem: reply.problem });
  };

  const running = (): SpeechWorker | null => {
    if (worker) return worker;
    try {
      worker = startWorker();
    } catch {
      return null;
    }
    worker.addEventListener('message', answer as EventListener);
    // A worker that cannot load (or crashes, out of memory) says so to every recording waiting on it
    worker.addEventListener('error', () => stop('deviceSpeechUnsupported'));
    worker.addEventListener('messageerror', () => stop('deviceSpeechFailed'));
    return worker;
  };

  const run = async (audio: Blob, { language, onProgress }: DeviceSpeechOptions): Promise<DeviceSpeechResult> => {
    if (!supported()) return { text: null, problem: 'deviceSpeechUnsupported' };
    const samples = await decodeSpeechSamples(audio);
    if (!samples) return { text: null, problem: 'deviceSpeechUnreadableAudio' };
    const target = running();
    if (!target) return { text: null, problem: 'deviceSpeechUnsupported' };
    if (idleTimer) clearTimeout(idleTimer);
    const id = nextId++;
    const result = new Promise<DeviceSpeechResult>((resolve) => pending.set(id, { resolve, onProgress }));
    const request: SpeechRequest = { type: 'transcribe', id, samples, language };
    target.postMessage(request);
    const answered = await result;
    idleTimer = setTimeout(() => stop(null), idleMs);
    return answered;
  };

  /** The text of a recording, transcribed after any the device is already working on. */
  const transcribe = (audio: Blob, options: DeviceSpeechOptions): Promise<DeviceSpeechResult> => {
    const result = turn.then(() => run(audio, options));
    turn = result.catch(() => undefined);
    return result;
  };

  return { transcribe };
}

export type DeviceTranscriber = ReturnType<typeof createDeviceTranscriber>;

/** The page's one transcriber, so a single worker (and a single copy of the model) serves every recording. */
export const deviceTranscriber = createDeviceTranscriber();
