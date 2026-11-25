import { afterEach, describe, expect, it, vi } from 'vitest';
import { canDecodeSpeech, decodeSpeechSamples } from './audioDecoding';

interface FakeBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

const contexts: { channels: number; length: number; rate: number }[] = [];
/** A recording's bytes (jsdom's Blob has no `arrayBuffer`). */
const recording = { arrayBuffer: async () => new ArrayBuffer(8) } as Blob;

/** A Web Audio API that decodes every recording as `decoded`, or refuses each one (null). */
function installContext(decoded: FakeBuffer | null) {
  const rendered = new Float32Array([0.25, 0.5]);
  class FakeOfflineAudioContext {
    readonly destination = {};
    constructor(channels: number, length: number, rate: number) {
      contexts.push({ channels, length, rate });
    }
    async decodeAudioData() {
      if (!decoded) throw new DOMException('Unable to decode audio data', 'EncodingError');
      return decoded;
    }
    createBufferSource() {
      return { buffer: null, connect: vi.fn(), start: vi.fn() };
    }
    async startRendering() {
      return { getChannelData: () => rendered };
    }
  }
  vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext);
  return rendered;
}

afterEach(() => {
  vi.unstubAllGlobals();
  contexts.length = 0;
});

describe('recording decoding for speech recognition', () => {
  it('decodes a mono recording at 16 kHz as it is', async () => {
    const samples = new Float32Array([0.1, 0.2]);
    installContext({ numberOfChannels: 1, length: 2, getChannelData: () => samples });

    expect(canDecodeSpeech()).toBe(true);
    await expect(decodeSpeechSamples(recording)).resolves.toBe(samples);
    expect(contexts).toEqual([{ channels: 1, length: 1, rate: 16_000 }]);
  });

  it('mixes a stereo recording down to one channel', async () => {
    const rendered = installContext({ numberOfChannels: 2, length: 32_000, getChannelData: () => new Float32Array(0) });

    await expect(decodeSpeechSamples(recording)).resolves.toBe(rendered);
    expect(contexts.at(-1)).toEqual({ channels: 1, length: 32_000, rate: 16_000 });
  });

  it('gives nothing for a format the browser cannot decode, or without Web Audio', async () => {
    installContext(null);
    await expect(decodeSpeechSamples(recording)).resolves.toBeNull();

    vi.stubGlobal('OfflineAudioContext', undefined);
    expect(canDecodeSpeech()).toBe(false);
    await expect(decodeSpeechSamples(recording)).resolves.toBeNull();
  });
});
