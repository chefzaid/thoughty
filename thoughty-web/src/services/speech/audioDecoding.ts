import { SPEECH_SAMPLE_RATE } from './speechProtocol';

type OfflineContextConstructor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

/** The browser's offline audio context, which decodes and resamples without playing anything; null without one. */
function offlineContext(): OfflineContextConstructor | null {
  const constructor = (globalThis as { OfflineAudioContext?: OfflineContextConstructor }).OfflineAudioContext;
  return typeof constructor === 'function' ? constructor : null;
}

/** Whether this browser has the Web Audio API that turns a recording into samples for the model. */
export function canDecodeSpeech(): boolean {
  return offlineContext() !== null;
}

/**
 * A recording as the 16 kHz mono samples Whisper reads, decoded by the browser's Web Audio API (which resamples
 * to the context's rate) and mixed down to one channel; null when the browser cannot decode its format.
 */
export async function decodeSpeechSamples(audio: Blob): Promise<Float32Array | null> {
  const Context = offlineContext();
  if (!Context) return null;
  try {
    const decoded = await new Context(1, 1, SPEECH_SAMPLE_RATE).decodeAudioData(await audio.arrayBuffer());
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
    const mono = new Context(1, decoded.length, SPEECH_SAMPLE_RATE);
    const source = mono.createBufferSource();
    source.buffer = decoded;
    source.connect(mono.destination);
    source.start();
    return (await mono.startRendering()).getChannelData(0);
  } catch {
    return null;
  }
}
