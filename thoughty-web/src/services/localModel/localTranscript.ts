import type { AiAnswer } from '../api/aiTypes';
import type { AttachmentsService } from '../api/attachmentsService';
import type { Attachment } from '../../types';
import type { LocalAiService } from './localAiService';

/**
 * Transcribes a stored recording of a diary on the writer's own model: this page reads the recording from
 * Thoughty (with the session, from Thoughty's own address), sends it to the writer's speech-to-text model, and
 * hands Thoughty's server only the text, which keeps it as the recording's transcript.
 */
export async function transcribeStoredRecording(
  attachment: Pick<Attachment, 'id' | 'original_filename' | 'stored_filename'>,
  attachmentsService: Pick<AttachmentsService, 'downloadAttachment' | 'storeTranscript'>,
  localAiService: Pick<LocalAiService, 'transcribe'>,
): Promise<AiAnswer<string>> {
  const audio = await attachmentsService.downloadAttachment(attachment.stored_filename);
  if (!audio) return { data: null, refusal: 'localModelRecordingUnavailable' };
  const text = await localAiService.transcribe(audio, attachment.original_filename);
  if (text.data === null) return text;
  const stored = await attachmentsService.storeTranscript(attachment.id, text.data);
  return stored.data === null ? stored : { data: stored.data.transcript, refusal: null };
}
