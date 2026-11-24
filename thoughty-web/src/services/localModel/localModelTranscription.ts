import { answered, failed, headers, readJson, send, statusProblem, type LocalModelProblem, type LocalModelResult } from './localModelClient';
import type { LocalModelSettings } from './localModelSettings';

/** A speech-to-text model on a laptop's processor can take minutes for a long recording. */
const TRANSCRIPTION_TIMEOUT_MS = 300_000;
/** The test loads the model on a server that has not used it yet, which takes longer than listing models. */
const TRANSCRIPTION_TEST_TIMEOUT_MS = 60_000;

/** The problem a refused transcription names: the endpoint missing, the model unknown, or the recording too large. */
async function transcriptionProblem(response: Response): Promise<LocalModelProblem> {
  if (response.status === 413) return 'localModelRecordingTooLarge';
  const problem = await statusProblem(response);
  if (problem === 'localModelNotOpenAi') return 'localModelNoTranscription';
  return problem === 'localModelModelNotFound' ? 'localModelTranscriptionModelNotFound' : problem;
}

/** One second of silence as a 16 kHz mono WAV: the smallest recording every speech-to-text server takes. */
export function silentWav(): Blob {
  const samples = 16_000;
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return new Blob([view.buffer], { type: 'audio/wav' });
}

/**
 * The text of a recording, from the writer's own OpenAI-compatible speech-to-text endpoint
 * (`POST {baseUrl}/audio/transcriptions`, `multipart/form-data` with the file and the model). Only the browser
 * sends the recording there; an empty text is the model hearing no words.
 */
export async function transcribeWithLocalModel(
  settings: LocalModelSettings,
  audio: Blob,
  filename: string,
  timeoutMs = TRANSCRIPTION_TIMEOUT_MS,
): Promise<LocalModelResult<string>> {
  if (!settings.transcriptionModel) return failed('localModelTranscriptionModelRequired');
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', settings.transcriptionModel);
  form.append('response_format', 'json');
  const result = await send(
    `${settings.baseUrl}/audio/transcriptions`,
    { method: 'POST', headers: headers(settings, false), body: form },
    timeoutMs,
    transcriptionProblem,
  );
  if (result.data === null) return result;
  const body = (await readJson(result.data)) as { text?: unknown } | null;
  return typeof body?.text === 'string' ? answered(body.text.trim()) : failed('localModelUnreadable');
}

/** Whether the writer's server transcribes with their speech-to-text model: it is sent a second of silence. */
export async function testLocalTranscription(settings: LocalModelSettings): Promise<LocalModelResult<true>> {
  const result = await transcribeWithLocalModel(settings, silentWav(), 'thoughty-test.wav', TRANSCRIPTION_TEST_TIMEOUT_MS);
  return result.data === null ? result : answered(true as const);
}
