/**
 * The speech-recognition worker's entry, started by `deviceTranscriber.ts`: wires `speechWorkerCore` to the
 * worker's messages. transformers.js (and the ONNX runtime it carries) is imported only when the first recording
 * arrives, so neither is in the app's bundle; the runtime's WebAssembly is served from the app's origin.
 */
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import type { SpeechReply, SpeechRequest } from './speechProtocol';
import { createSpeechWorkerHandler } from './speechWorkerCore';
import { webGpuAvailable, whisperLoader } from './whisperRecognizer';

interface WorkerScope {
  readonly navigator: { readonly gpu?: { requestAdapter?: () => Promise<unknown> } };
  postMessage(message: SpeechReply): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<SpeechRequest>) => void): void;
}

const scope = globalThis as unknown as WorkerScope;
const handle = createSpeechWorkerHandler(
  whisperLoader(() => import('@huggingface/transformers'), wasmUrl, () => webGpuAvailable(scope.navigator.gpu)),
  (reply) => scope.postMessage(reply),
);
scope.addEventListener('message', (event) => void handle(event.data));
