import type { DeviceSpeechProblem, SpeechLanguage, SpeechReply, SpeechRequest } from './speechProtocol';

/** A loaded speech-recognition model: the text it hears in 16 kHz mono samples. */
export type Recognize = (samples: Float32Array, language: SpeechLanguage) => Promise<string>;

/** Loads the model, telling how many bytes of its files have come so far (the first time it downloads them). */
export type LoadRecognizer = (onDownload: (loaded: number, total: number) => void) => Promise<Recognize>;

const OUT_OF_MEMORY = /out of memory|\boom\b|memory access out of bounds|cannot enlarge memory|allocation failed|bad_alloc|array buffer allocation/i;
const UNSUPPORTED = /webassembly|no available backend|wasm-unsafe-eval|not supported/i;
const DOWNLOAD = /failed to fetch|networkerror|network error|could not locate file|load failed|dynamically imported module|importing a module script/i;

/** What an error thrown while loading or running the model means for the writer. */
export function speechProblemOf(error: unknown): DeviceSpeechProblem {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (error instanceof RangeError || OUT_OF_MEMORY.test(message)) return 'deviceSpeechOutOfMemory';
  if (UNSUPPORTED.test(message)) return 'deviceSpeechUnsupported';
  if (DOWNLOAD.test(message)) return 'deviceSpeechDownloadFailed';
  return 'deviceSpeechFailed';
}

/**
 * The worker's answer to each recording the page sends: the model is loaded once (its download progress told to
 * the recording that started it), then each recording is transcribed in turn. A failure is said and forgets the
 * model, so the next try loads it again instead of reusing one that may be broken.
 */
export function createSpeechWorkerHandler(loadRecognizer: LoadRecognizer, post: (reply: SpeechReply) => void) {
  let recognizer: Promise<Recognize> | null = null;
  let downloadingFor = 0;

  return async (request: SpeechRequest): Promise<void> => {
    const { id } = request;
    try {
      downloadingFor = id;
      recognizer ??= loadRecognizer((loaded, total) => post({ type: 'progress', id: downloadingFor, phase: 'downloading', loaded, total }));
      const recognize = await recognizer;
      post({ type: 'progress', id, phase: 'transcribing' });
      const text = await recognize(request.samples, request.language);
      post({ type: 'result', id, text: text.trim() });
    } catch (error) {
      recognizer = null;
      post({ type: 'error', id, problem: speechProblemOf(error) });
    }
  };
}
