import { describe, expect, it, vi } from 'vitest';
import { createSpeechWorkerHandler, speechProblemOf, type LoadRecognizer } from './speechWorkerCore';
import type { SpeechReply, SpeechRequest } from './speechProtocol';
import { speechLanguage } from './speechProtocol';

const request = (id: number): SpeechRequest => ({ type: 'transcribe', id, samples: new Float32Array(16), language: 'fr' });

describe('speech worker', () => {
  it('loads the model once, telling its download to the recording that started it, then transcribes each recording', async () => {
    const replies: SpeechReply[] = [];
    const recognize = vi.fn().mockResolvedValueOnce('  Bonjour.  ').mockResolvedValueOnce('Encore.');
    const load = vi.fn<LoadRecognizer>(async (onDownload) => {
      onDownload(10, 100);
      return recognize;
    });
    const handle = createSpeechWorkerHandler(load, (reply) => replies.push(reply));

    await handle(request(1));
    await handle(request(2));

    expect(load).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledWith(expect.any(Float32Array), 'fr');
    expect(replies).toEqual([
      { type: 'progress', id: 1, phase: 'downloading', loaded: 10, total: 100 },
      { type: 'progress', id: 1, phase: 'transcribing' },
      { type: 'result', id: 1, text: 'Bonjour.' },
      { type: 'progress', id: 2, phase: 'transcribing' },
      { type: 'result', id: 2, text: 'Encore.' },
    ]);
  });

  it('says why a recording gave no text, and loads the model again for the next one', async () => {
    const replies: SpeechReply[] = [];
    const load = vi.fn<LoadRecognizer>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(vi.fn().mockRejectedValue(new RangeError('Array buffer allocation failed')))
      .mockResolvedValueOnce(vi.fn().mockResolvedValue('Heard'));
    const handle = createSpeechWorkerHandler(load, (reply) => replies.push(reply));

    await handle(request(1));
    await handle(request(2));
    await handle(request(3));

    expect(load).toHaveBeenCalledTimes(3);
    expect(replies.filter((reply) => reply.type !== 'progress')).toEqual([
      { type: 'error', id: 1, problem: 'deviceSpeechDownloadFailed' },
      { type: 'error', id: 2, problem: 'deviceSpeechOutOfMemory' },
      { type: 'result', id: 3, text: 'Heard' },
    ]);
  });

  it('names what an error means for the writer', () => {
    expect(speechProblemOf(new Error('Aborted(OOM)'))).toBe('deviceSpeechOutOfMemory');
    expect(speechProblemOf(new Error('memory access out of bounds'))).toBe('deviceSpeechOutOfMemory');
    expect(speechProblemOf(new Error('no available backend found. ERR: [wasm] RuntimeError'))).toBe('deviceSpeechUnsupported');
    expect(speechProblemOf(new Error("WebAssembly.instantiate(): Refused to compile because 'wasm-unsafe-eval' is not allowed"))).toBe('deviceSpeechUnsupported');
    expect(speechProblemOf(new Error('Could not locate file: "https://huggingface.co/onnx-community/whisper-base/resolve/main/config.json".'))).toBe('deviceSpeechDownloadFailed');
    expect(speechProblemOf(new TypeError('Failed to fetch dynamically imported module'))).toBe('deviceSpeechDownloadFailed');
    expect(speechProblemOf(new Error('Something else'))).toBe('deviceSpeechFailed');
    expect(speechProblemOf('a string')).toBe('deviceSpeechFailed');
  });

  it('transcribes in the app’s language, English for any other', () => {
    expect(speechLanguage('fr')).toBe('fr');
    expect(speechLanguage('en')).toBe('en');
    expect(speechLanguage(undefined)).toBe('en');
  });
});
