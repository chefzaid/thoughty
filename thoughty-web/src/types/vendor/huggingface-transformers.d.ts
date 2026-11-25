/**
 * The part of `@huggingface/transformers` (transformers.js) the speech-recognition worker uses, which TypeScript
 * reads in place of the package's own typings (`paths` in tsconfig.json): those import `sharp`'s, which load
 * Node's global types into the whole app (`setTimeout` answering a Node `Timeout`). Vite still bundles the package
 * itself. Kept to the shapes of transformers.js 4.3.
 */
declare module '@huggingface/transformers' {
  export type ProgressInfo =
    | { status: 'initiate' | 'download' | 'done'; name: string; file: string }
    | { status: 'progress'; name: string; file: string; progress: number; loaded: number; total: number }
    | { status: 'progress_total'; name: string; progress: number; loaded: number; total: number }
    | { status: 'ready'; task: string; model: string };

  export interface PretrainedOptions {
    device?: 'webgpu' | 'wasm';
    dtype?: string | Record<string, string>;
    progress_callback?: (info: ProgressInfo) => void;
  }

  export interface SpeechRecognitionOptions {
    language?: string;
    task?: 'transcribe' | 'translate';
    chunk_length_s?: number;
    stride_length_s?: number;
  }

  export type AutomaticSpeechRecognitionPipeline = (
    audio: Float32Array,
    options?: SpeechRecognitionOptions,
  ) => Promise<{ text: string } | { text: string }[]>;

  export function pipeline(
    task: 'automatic-speech-recognition',
    model: string,
    options?: PretrainedOptions,
  ): Promise<AutomaticSpeechRecognitionPipeline>;

  export const env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    useWasmCache: boolean;
    backends: { onnx: { wasm?: { wasmPaths?: string | { wasm?: string; mjs?: string } } } };
  };
}
