import { describe, expect, it, vi } from 'vitest';
import { transcribeStoredRecording } from './localTranscript';

const recording = { id: 9, original_filename: 'note.webm', stored_filename: 'stored-9.webm' };
const audio = new Blob(['voice'], { type: 'audio/webm' });

function services({ download = audio as Blob | null, text = { data: 'Dear sister', refusal: null } as never, stored = { data: { transcript: 'Dear sister', transcribed_at: '2026-11-24T10:00:00Z', cached: false }, refusal: null } as never } = {}) {
  return {
    attachmentsService: { downloadAttachment: vi.fn().mockResolvedValue(download), storeTranscript: vi.fn().mockResolvedValue(stored) },
    localAiService: { transcribe: vi.fn().mockResolvedValue(text) },
  };
}

describe('transcribeStoredRecording', () => {
  it('reads the recording from Thoughty, has the writer’s model transcribe it, and hands Thoughty only the text', async () => {
    const { attachmentsService, localAiService } = services();

    await expect(transcribeStoredRecording(recording, attachmentsService, localAiService)).resolves.toEqual({ data: 'Dear sister', refusal: null });

    expect(attachmentsService.downloadAttachment).toHaveBeenCalledWith('stored-9.webm');
    expect(localAiService.transcribe).toHaveBeenCalledWith(audio, 'note.webm');
    expect(attachmentsService.storeTranscript).toHaveBeenCalledWith(9, 'Dear sister');
  });

  it('says when the recording cannot be read, and sends nothing to the model', async () => {
    const { attachmentsService, localAiService } = services({ download: null });

    await expect(transcribeStoredRecording(recording, attachmentsService, localAiService)).resolves.toEqual({ data: null, refusal: 'localModelRecordingUnavailable' });
    expect(localAiService.transcribe).not.toHaveBeenCalled();
  });

  it('passes on why the model gave no text, and keeps nothing', async () => {
    const { attachmentsService, localAiService } = services({ text: { data: null, refusal: 'localModelNoTranscription' } as never });

    await expect(transcribeStoredRecording(recording, attachmentsService, localAiService)).resolves.toEqual({ data: null, refusal: 'localModelNoTranscription' });
    expect(attachmentsService.storeTranscript).not.toHaveBeenCalled();
  });

  it('passes on Thoughty’s refusal to keep the text', async () => {
    const { attachmentsService, localAiService } = services({ stored: { data: null, refusal: 'apiError_TRANSCRIPT_TOO_LONG' } as never });

    await expect(transcribeStoredRecording(recording, attachmentsService, localAiService)).resolves.toEqual({ data: null, refusal: 'apiError_TRANSCRIPT_TOO_LONG' });
  });
});
