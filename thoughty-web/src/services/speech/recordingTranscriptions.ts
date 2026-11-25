import type { AttachmentsService } from '../api/attachmentsService';
import type { Attachment } from '../../types';
import { isAudioAttachment } from '../../utils/attachments';
import { deviceTranscriber, type DeviceTranscriber } from './deviceTranscriber';
import type { SpeechLanguage, SpeechProgress } from './speechProtocol';

/** Where a stored recording's transcription on this device is: waiting its turn, under way, failed, or kept. */
export type RecordingTranscription =
  | { readonly phase: 'queued' }
  | { readonly phase: 'preparing' }
  | SpeechProgress
  | { readonly phase: 'failed'; readonly problem: string }
  | { readonly phase: 'done'; readonly transcript: string };

export interface RecordingTranscriptionRequest {
  readonly attachments: readonly Pick<Attachment, 'id' | 'stored_filename' | 'mimetype'>[];
  /** Reads the recording with the session, and keeps the text (`PUT /api/attachments/{id}/transcript`). */
  readonly attachmentsService: Pick<AttachmentsService, 'downloadAttachment' | 'storeTranscript'>;
  readonly language: SpeechLanguage;
}

const UNDER_WAY = new Set<RecordingTranscription['phase']>(['queued', 'preparing', 'downloading', 'transcribing']);

/**
 * The transcriptions of stored recordings in the diaries set to "My own model only", run in the background on
 * this device, one after another: each recording is read from Thoughty, transcribed by the speech-recognition
 * model here, and only its text is sent back, kept as the recording's transcript. The recordings' cards follow
 * their progress (`useRecordingTranscription`), and it goes on while the writer moves around the app.
 */
export function createRecordingTranscriptions(transcriber: Pick<DeviceTranscriber, 'transcribe'>) {
  const states = new Map<number, RecordingTranscription>();
  const listeners = new Set<() => void>();
  let turn: Promise<void> = Promise.resolve();

  const set = (id: number, state: RecordingTranscription) => {
    states.set(id, state);
    for (const listener of listeners) listener();
  };

  const run = async (
    attachment: RecordingTranscriptionRequest['attachments'][number],
    { attachmentsService, language }: RecordingTranscriptionRequest,
  ): Promise<RecordingTranscription> => {
    set(attachment.id, { phase: 'preparing' });
    const audio = await attachmentsService.downloadAttachment(attachment.stored_filename);
    if (!audio) return { phase: 'failed', problem: 'deviceSpeechRecordingUnavailable' };
    const heard = await transcriber.transcribe(audio, { language, onProgress: (progress) => set(attachment.id, progress) });
    if (heard.text === null) return { phase: 'failed', problem: heard.problem };
    if (!heard.text) return { phase: 'failed', problem: 'deviceSpeechNoWords' };
    const stored = await attachmentsService.storeTranscript(attachment.id, heard.text);
    return stored.data === null
      ? { phase: 'failed', problem: stored.refusal ?? 'audioTranscriptionFailed' }
      : { phase: 'done', transcript: stored.data.transcript };
  };

  /** Starts transcribing these recordings (other attachments are left alone, and so is one already under way). */
  const transcribe = (request: RecordingTranscriptionRequest): void => {
    for (const attachment of request.attachments) {
      if (!isAudioAttachment(attachment.mimetype) || UNDER_WAY.has(states.get(attachment.id)?.phase ?? 'done')) continue;
      set(attachment.id, { phase: 'queued' });
      turn = turn.then(async () => {
        const outcome = await run(attachment, request).catch((): RecordingTranscription => ({ phase: 'failed', problem: 'deviceSpeechFailed' }));
        set(attachment.id, outcome);
      });
    }
  };

  const stateOf = (attachmentId: number): RecordingTranscription | null => states.get(attachmentId) ?? null;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { transcribe, stateOf, subscribe };
}

export type RecordingTranscriptions = ReturnType<typeof createRecordingTranscriptions>;

/** The page's one queue, on the page's one transcriber. */
export const recordingTranscriptions = createRecordingTranscriptions(deviceTranscriber);
