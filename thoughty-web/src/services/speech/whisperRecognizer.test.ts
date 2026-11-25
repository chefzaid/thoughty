import { describe, expect, it, vi } from 'vitest';
import type { PretrainedOptions } from '@huggingface/transformers';
import { webGpuAvailable, whisperLoader, type SpeechLibrary } from './whisperRecognizer';

function library(pipeline: (task: string, model: string, options: PretrainedOptions) => Promise<unknown>) {
  const env = { allowLocalModels: true, useBrowserCache: true, useWasmCache: true, backends: { onnx: { wasm: {} as { wasmPaths?: unknown } } } };
  return { env, pipeline: vi.fn(pipeline) } as unknown as SpeechLibrary & { pipeline: ReturnType<typeof vi.fn> };
}

describe('Whisper with transformers.js', () => {
  it('loads Whisper on WebAssembly with the runtime from the app’s origin, telling the download, and reads long recordings in windows', async () => {
    const recognizer = vi.fn().mockResolvedValue({ text: ' Hello there.' });
    const lib = library(async (_task, _model, options: PretrainedOptions) => {
      options.progress_callback?.({ status: 'progress', name: 'm', file: 'f', progress: 5, loaded: 5, total: 100 });
      options.progress_callback?.({ status: 'progress_total', name: 'm', progress: 5, loaded: 5, total: 100 });
      return recognizer;
    });
    const onDownload = vi.fn();

    const recognize = await whisperLoader(async () => lib, '/assets/ort.wasm', async () => false)(onDownload);

    expect(lib.env).toMatchObject({ allowLocalModels: false, useWasmCache: false, backends: { onnx: { wasm: { wasmPaths: { wasm: '/assets/ort.wasm' } } } } });
    expect(lib.pipeline).toHaveBeenCalledWith('automatic-speech-recognition', 'onnx-community/whisper-base', expect.objectContaining({ device: 'wasm', dtype: 'q8' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith(5, 100);
    await expect(recognize(new Float32Array(4), 'fr')).resolves.toBe(' Hello there.');
    expect(recognizer).toHaveBeenCalledWith(expect.any(Float32Array), { language: 'fr', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  });

  it('uses the graphics card when it can, and the processor when WebGPU fails to load', async () => {
    const parts = vi.fn().mockResolvedValue([{ text: 'One.' }, { text: 'Two.' }, {}]);
    const onGpu = library(async () => parts);
    await expect((await whisperLoader(async () => onGpu, 'w', async () => true)(vi.fn()))(new Float32Array(1), 'en')).resolves.toBe('One. Two. ');
    expect(onGpu.pipeline).toHaveBeenCalledWith('automatic-speech-recognition', expect.any(String), expect.objectContaining({
      device: 'webgpu',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    }));

    const fallback = library(async (_task, _model, options: PretrainedOptions) => {
      if (options.device === 'webgpu') throw new Error('no adapter');
      return parts;
    });
    await whisperLoader(async () => fallback, 'w', async () => true)(vi.fn());
    expect(fallback.pipeline.mock.calls.map(([, , options]) => (options as PretrainedOptions).device)).toEqual(['webgpu', 'wasm']);
  });

  it('leaves the runtime’s paths alone where the library has no WebAssembly backend', async () => {
    const lib = library(async () => vi.fn());
    (lib.env.backends.onnx as { wasm?: unknown }).wasm = undefined;
    await whisperLoader(async () => lib, 'w', async () => false)(vi.fn());
    expect(lib.env.backends.onnx.wasm).toBeUndefined();
  });

  it('sees WebGPU only where it offers an adapter', async () => {
    await expect(webGpuAvailable(undefined)).resolves.toBe(false);
    await expect(webGpuAvailable({})).resolves.toBe(false);
    await expect(webGpuAvailable({ requestAdapter: async () => null })).resolves.toBe(false);
    await expect(webGpuAvailable({ requestAdapter: async () => { throw new Error('blocked'); } })).resolves.toBe(false);
    await expect(webGpuAvailable({ requestAdapter: async () => ({}) })).resolves.toBe(true);
  });
});
