/**
 * The messages between the page and the speech-recognition worker (`speechWorker.ts`), which transcribes
 * recordings on the writer's device for the diaries set to "My own model only".
 */

/** The languages the app speaks, which the recording is transcribed in (Whisper in transformers.js detects none). */
export type SpeechLanguage = 'en' | 'fr';

/** Why a recording gave no text on this device. */
export type DeviceSpeechProblem =
  /** No WebAssembly, no Web Worker or no Web Audio here, or the worker could not start. */
  | 'deviceSpeechUnsupported'
  /** The speech-recognition model (or the library) could not be downloaded. */
  | 'deviceSpeechDownloadFailed'
  /** The device ran out of memory loading the model or transcribing. */
  | 'deviceSpeechOutOfMemory'
  /** This browser cannot decode the recording's format. */
  | 'deviceSpeechUnreadableAudio'
  /** The model heard no words. */
  | 'deviceSpeechNoWords'
  /** Thoughty could not hand the stored recording to this page. */
  | 'deviceSpeechRecordingUnavailable'
  | 'deviceSpeechFailed';

/** A recording to transcribe: 16 kHz mono samples. */
export interface SpeechRequest {
  readonly type: 'transcribe';
  readonly id: number;
  readonly samples: Float32Array;
  readonly language: SpeechLanguage;
}

/** How far a transcription has gone: the model's first download (bytes so far of all its files), then the work. */
export type SpeechProgress =
  | { readonly phase: 'downloading'; readonly loaded: number; readonly total: number }
  | { readonly phase: 'transcribing' };

export type SpeechReply =
  | ({ readonly type: 'progress'; readonly id: number } & SpeechProgress)
  | { readonly type: 'result'; readonly id: number; readonly text: string }
  | { readonly type: 'error'; readonly id: number; readonly problem: DeviceSpeechProblem };

/**
 * The Whisper model, run by transformers.js: `whisper-base` (74 M parameters) understands English and French well
 * enough for a diary where `whisper-tiny` often does not in French, and stays small enough for a phone, where
 * `whisper-small` would be several hundred megabytes. Its files come from Hugging Face and stay in this browser's
 * Cache API (`transformers-cache`) after the first download.
 */
export const SPEECH_MODEL = 'onnx-community/whisper-base';

/** The sample rate Whisper reads. */
export const SPEECH_SAMPLE_RATE = 16_000;

/** The language to transcribe in for the app's language code (`t('languageCode')`, `config.language`). */
export function speechLanguage(code: string | null | undefined): SpeechLanguage {
  return code === 'fr' ? 'fr' : 'en';
}
