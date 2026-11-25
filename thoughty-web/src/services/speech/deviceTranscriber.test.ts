import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceTranscriber, isDeviceSpeechSupported, type SpeechWorker } from './deviceTranscriber';
import type { SpeechReply, SpeechRequest } from './speechProtocol';

const decodeSpeechSamples = vi.hoisted(() => vi.fn<(audio: Blob) => Promise<Float32Array | null>>());
const canDecodeSpeech = vi.hoisted(() => vi.fn(() => true));
vi.mock('./audioDecoding', () => ({ decodeSpeechSamples, canDecodeSpeech }));

/** A worker that answers each recording as `answer` says. */
class FakeWorker implements SpeechWorker {
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  readonly requests: SpeechRequest[] = [];
  terminated = false;
  constructor(private readonly answer: (request: SpeechRequest, reply: (message: SpeechReply) => void) => void) {}
  addEventListener(type: string, listener: unknown) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener as (event: unknown) => void]);
  }
  postMessage(message: SpeechRequest) {
    this.requests.push(message);
    this.answer(message, (reply) => this.emit('message', { data: reply }));
  }
  terminate() {
    this.terminated = true;
  }
  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const audio = new Blob(['voice']);

beforeEach(() => {
  decodeSpeechSamples.mockResolvedValue(new Float32Array([0.1, 0.2]));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('device transcriber', () => {
  it('sends the decoded recording to the worker and tells its progress until the text comes', async () => {
    const worker = new FakeWorker((request, reply) => {
      reply({ type: 'progress', id: request.id, phase: 'downloading', loaded: 1, total: 4 });
      reply({ type: 'progress', id: request.id, phase: 'transcribing' });
      reply({ type: 'progress', id: 999, phase: 'transcribing' });
      reply({ type: 'result', id: request.id, text: 'Heard here' });
    });
    const onProgress = vi.fn();
    const { transcribe } = createDeviceTranscriber(() => worker, () => true);

    await expect(transcribe(audio, { language: 'fr', onProgress })).resolves.toEqual({ text: 'Heard here', problem: null });
    expect(worker.requests).toEqual([{ type: 'transcribe', id: 1, samples: new Float32Array([0.1, 0.2]), language: 'fr' }]);
    expect(onProgress.mock.calls).toEqual([[{ phase: 'downloading', loaded: 1, total: 4 }], [{ phase: 'transcribing' }]]);
  });

  it('transcribes one recording at a time, with one worker, and lets it go once idle', async () => {
    vi.useFakeTimers();
    const replies: ((message: SpeechReply) => void)[] = [];
    const worker = new FakeWorker((request, reply) => {
      replies.push(() => reply({ type: 'result', id: request.id, text: `text ${request.id}` }));
    });
    const start = vi.fn(() => worker);
    const { transcribe } = createDeviceTranscriber(start, () => true, 1000);

    const first = transcribe(audio, { language: 'en' });
    const second = transcribe(audio, { language: 'en' });
    await vi.waitFor(() => expect(worker.requests).toHaveLength(1));
    replies[0]?.({} as SpeechReply);
    await expect(first).resolves.toEqual({ text: 'text 1', problem: null });
    await vi.waitFor(() => expect(worker.requests).toHaveLength(2));
    replies[1]?.({} as SpeechReply);
    await expect(second).resolves.toEqual({ text: 'text 2', problem: null });
    expect(start).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(worker.terminated).toBe(true);
  });

  it('says why a recording gave no text: the worker’s reason, an unreadable recording, an unsupported device', async () => {
    const failing = new FakeWorker((request, reply) => reply({ type: 'error', id: request.id, problem: 'deviceSpeechDownloadFailed' }));
    await expect(createDeviceTranscriber(() => failing, () => true).transcribe(audio, { language: 'en' }))
      .resolves.toEqual({ text: null, problem: 'deviceSpeechDownloadFailed' });

    decodeSpeechSamples.mockResolvedValueOnce(null);
    await expect(createDeviceTranscriber(() => failing, () => true).transcribe(audio, { language: 'en' }))
      .resolves.toEqual({ text: null, problem: 'deviceSpeechUnreadableAudio' });

    await expect(createDeviceTranscriber(() => failing, () => false).transcribe(audio, { language: 'en' }))
      .resolves.toEqual({ text: null, problem: 'deviceSpeechUnsupported' });

    const cannotStart = () => {
      throw new Error('Workers are blocked');
    };
    await expect(createDeviceTranscriber(cannotStart, () => true).transcribe(audio, { language: 'en' }))
      .resolves.toEqual({ text: null, problem: 'deviceSpeechUnsupported' });
  });

  it('tells every waiting recording when the worker fails, and starts a new one for the next', async () => {
    const workers: FakeWorker[] = [];
    const start = () => {
      const worker = new FakeWorker((request, reply) => {
        if (workers.length > 1) reply({ type: 'result', id: request.id, text: 'Back' });
      });
      workers.push(worker);
      return worker;
    };
    const { transcribe } = createDeviceTranscriber(start, () => true);

    const crashed = transcribe(audio, { language: 'en' });
    await vi.waitFor(() => expect(workers[0]?.requests).toHaveLength(1));
    workers[0]?.emit('error', new Event('error'));
    await expect(crashed).resolves.toEqual({ text: null, problem: 'deviceSpeechUnsupported' });
    expect(workers[0]?.terminated).toBe(true);

    await expect(transcribe(audio, { language: 'en' })).resolves.toEqual({ text: 'Back', problem: null });

    const garbled = new FakeWorker(() => undefined);
    const pending = createDeviceTranscriber(() => garbled, () => true).transcribe(audio, { language: 'en' });
    await vi.waitFor(() => expect(garbled.requests).toHaveLength(1));
    garbled.emit('messageerror', new Event('messageerror'));
    await expect(pending).resolves.toEqual({ text: null, problem: 'deviceSpeechFailed' });
  });

  it('runs where WebAssembly, Web Workers and Web Audio are all there', () => {
    vi.stubGlobal('Worker', class {});
    expect(isDeviceSpeechSupported()).toBe(true);
    canDecodeSpeech.mockReturnValueOnce(false);
    expect(isDeviceSpeechSupported()).toBe(false);
    vi.stubGlobal('Worker', undefined);
    expect(isDeviceSpeechSupported()).toBe(false);
    vi.unstubAllGlobals();
  });
});
