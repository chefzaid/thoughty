import type { ProgressInfo } from '@huggingface/transformers';
import { SPEECH_MODEL } from './speechProtocol';
import type { LoadRecognizer } from './speechWorkerCore';

/** What the worker uses of transformers.js. */
export type SpeechLibrary = Pick<typeof import('@huggingface/transformers'), 'env' | 'pipeline'>;

type SpeechDevice = 'webgpu' | 'wasm';

/**
 * The model's precision per device, as transformers.js's own Whisper demos run it: on WebGPU a full-precision
 * encoder with a 4-bit decoder, on WebAssembly (the processor) 8-bit weights throughout, the smaller download.
 */
const DTYPES = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: 'q8',
} as const;

/** Whether this worker can use the graphics card: WebGPU is there and offers an adapter. */
export async function webGpuAvailable(gpu: { requestAdapter?: () => Promise<unknown> } | undefined): Promise<boolean> {
  try {
    return Boolean(await gpu?.requestAdapter?.());
  } catch {
    return false;
  }
}

/**
 * Loads Whisper with transformers.js, on WebGPU when the device has it and else on WebAssembly. Only the model's
 * files are downloaded (from Hugging Face, kept in the browser's Cache API); the ONNX runtime's WebAssembly comes
 * from this app's own origin (`wasmUrl`), and is not turned into a `blob:` script (`useWasmCache` off), so the CSP
 * needs only `'wasm-unsafe-eval'`. Recordings over 30 seconds are read in overlapping 30-second windows.
 */
export function whisperLoader(load: () => Promise<SpeechLibrary>, wasmUrl: string, webGpu: () => Promise<boolean>): LoadRecognizer {
  return async (onDownload) => {
    const { env, pipeline } = await load();
    env.allowLocalModels = false;
    env.useWasmCache = false;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { wasm: wasmUrl };
    const progress_callback = (info: ProgressInfo) => {
      if (info.status === 'progress_total') onDownload(info.loaded, info.total);
    };
    const create = (device: SpeechDevice) => pipeline('automatic-speech-recognition', SPEECH_MODEL, { device, dtype: DTYPES[device], progress_callback });

    let recognizer = (await webGpu()) ? await create('webgpu').catch(() => null) : null;
    recognizer ??= await create('wasm');
    const transcriber = recognizer;
    return async (samples, language) => {
      const output: unknown = await transcriber(samples, { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
      const parts = (Array.isArray(output) ? output : [output]) as readonly { readonly text?: unknown }[];
      return parts.map((part) => (typeof part.text === 'string' ? part.text : '')).join(' ');
    };
  };
}
