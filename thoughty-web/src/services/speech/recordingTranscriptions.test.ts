import { describe, expect, it, vi } from 'vitest';
import { createRecordingTranscriptions } from './recordingTranscriptions';
import type { DeviceSpeechOptions, DeviceSpeechResult } from './deviceTranscriber';

const audio = new Blob(['voice']);
const recording = (id: number, mimetype = 'audio/webm') => ({ id, stored_filename: `r${id}.webm`, mimetype });

/** Thoughty's attachments: the recording read, and its text kept (or refused with `refusal`). */
function service(refusal: string | null = null) {
  return {
    downloadAttachment: vi.fn().mockResolvedValue(audio),
    storeTranscript: vi.fn().mockImplementation(async (_id: number, text: string) => (
      refusal
        ? { data: null, refusal }
        : { data: { transcript: text, transcribed_at: '2026-11-25T10:00:00.000Z', cached: false }, refusal: null }
    )),
  };
}

describe('recording transcriptions in the background', () => {
  it('transcribes each recording in turn on this device and keeps its text, leaving other files alone', async () => {
    const transcribe = vi.fn(async (_audio: Blob, { onProgress }: DeviceSpeechOptions): Promise<DeviceSpeechResult> => {
      onProgress?.({ phase: 'transcribing' });
      return { text: 'Heard', problem: null };
    });
    const queue = createRecordingTranscriptions({ transcribe });
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    const attachmentsService = service();

    queue.transcribe({ attachments: [recording(1), recording(2, 'image/png'), recording(3)], attachmentsService, language: 'fr' });
    expect(queue.stateOf(1)).toEqual({ phase: 'queued' });
    expect(queue.stateOf(2)).toBeNull();

    await vi.waitFor(() => expect(queue.stateOf(3)).toEqual({ phase: 'done', transcript: 'Heard' }));
    expect(queue.stateOf(1)).toEqual({ phase: 'done', transcript: 'Heard' });
    expect(attachmentsService.downloadAttachment.mock.calls).toEqual([['r1.webm'], ['r3.webm']]);
    expect(attachmentsService.storeTranscript.mock.calls).toEqual([[1, 'Heard'], [3, 'Heard']]);
    expect(transcribe).toHaveBeenCalledWith(audio, expect.objectContaining({ language: 'fr' }));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    queue.transcribe({ attachments: [recording(4)], attachmentsService, language: 'en' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not start a recording again while it is under way, but does once it failed', async () => {
    let finish: (result: DeviceSpeechResult) => void = () => undefined;
    const transcribe = vi.fn(() => new Promise<DeviceSpeechResult>((resolve) => {
      finish = resolve;
    }));
    const queue = createRecordingTranscriptions({ transcribe });
    const attachmentsService = service();

    queue.transcribe({ attachments: [recording(1)], attachmentsService, language: 'en' });
    queue.transcribe({ attachments: [recording(1)], attachmentsService, language: 'en' });
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1));
    finish({ text: null, problem: 'deviceSpeechOutOfMemory' });
    await vi.waitFor(() => expect(queue.stateOf(1)).toEqual({ phase: 'failed', problem: 'deviceSpeechOutOfMemory' }));

    queue.transcribe({ attachments: [recording(1)], attachmentsService, language: 'en' });
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalledTimes(2));
  });

  it('says why a recording gave no text', async () => {
    const heard = vi.fn<() => Promise<DeviceSpeechResult>>().mockResolvedValue({ text: '', problem: null });
    const queue = createRecordingTranscriptions({ transcribe: heard });

    queue.transcribe({ attachments: [recording(1)], attachmentsService: service(), language: 'en' });
    await vi.waitFor(() => expect(queue.stateOf(1)).toEqual({ phase: 'failed', problem: 'deviceSpeechNoWords' }));

    const unavailable = { ...service(), downloadAttachment: vi.fn().mockResolvedValue(null) };
    queue.transcribe({ attachments: [recording(2)], attachmentsService: unavailable, language: 'en' });
    await vi.waitFor(() => expect(queue.stateOf(2)).toEqual({ phase: 'failed', problem: 'deviceSpeechRecordingUnavailable' }));

    heard.mockResolvedValue({ text: 'Too much', problem: null });
    queue.transcribe({ attachments: [recording(3)], attachmentsService: service('apiError_TRANSCRIPT_TOO_LONG'), language: 'en' });
    await vi.waitFor(() => expect(queue.stateOf(3)).toEqual({ phase: 'failed', problem: 'apiError_TRANSCRIPT_TOO_LONG' }));

    const offline = { ...service(), storeTranscript: vi.fn().mockResolvedValue({ data: null, refusal: null }) };
    queue.transcribe({ attachments: [recording(4)], attachmentsService: offline, language: 'en' });
    await vi.waitFor(() => expect(queue.stateOf(4)).toEqual({ phase: 'failed', problem: 'audioTranscriptionFailed' }));

    const broken = { ...service(), downloadAttachment: vi.fn().mockRejectedValue(new Error('boom')) };
    queue.transcribe({ attachments: [recording(5)], attachmentsService: broken, language: 'en' });
    await vi.waitFor(() => expect(queue.stateOf(5)).toEqual({ phase: 'failed', problem: 'deviceSpeechFailed' }));
  });
});
