import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioTranscript from './AudioTranscript';
import type { Attachment } from '../../types';
import type { DeviceSpeechOptions, DeviceSpeechResult } from '../../services/speech/deviceTranscriber';
import { recordingTranscriptions } from '../../services/speech/recordingTranscriptions';

const transcribe = vi.hoisted(() => vi.fn<(audio: Blob, options: DeviceSpeechOptions) => Promise<DeviceSpeechResult>>());
vi.mock('../../services/speech/deviceTranscriber', () => ({ deviceTranscriber: { transcribe } }));

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key);
const audio = new Blob(['voice'], { type: 'audio/webm' });
let nextId = 30;

function renderTranscript() {
  const recording: Attachment = { id: nextId++, original_filename: 'voice-note.webm', stored_filename: 'voice.webm', mimetype: 'audio/webm', size: 10 };
  const attachmentsService = {
    transcribeAttachment: vi.fn(),
    downloadAttachment: vi.fn().mockResolvedValue(audio),
    storeTranscript: vi.fn().mockImplementation(async (_id: number, text: string) => ({
      data: { transcript: text, transcribed_at: '2026-11-25T10:00:00.000Z', cached: false },
      refusal: null,
    })),
  };
  render(<AudioTranscript attachment={recording} attachmentsService={attachmentsService as never} isDark={false} t={t} aiMode="local" />);
  return { attachmentsService, recording };
}

beforeEach(() => {
  transcribe.mockReset();
});

describe('AudioTranscript in a diary on the writer’s own model', () => {
  it('transcribes on this device, showing the model’s download and the work, and has Thoughty keep only the text', async () => {
    const user = userEvent.setup();
    let finish: (result: DeviceSpeechResult) => void = () => undefined;
    transcribe.mockImplementation((_audio, { onProgress }) => {
      onProgress?.({ phase: 'downloading', loaded: 12_400_000, total: 80_000_000 });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { attachmentsService, recording } = renderTranscript();

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));

    expect(await screen.findByRole('status')).toHaveTextContent('deviceSpeechDownloading {"loaded":12,"total":80}');
    expect(screen.getByRole('progressbar', { name: 'deviceSpeechDownloadLabel' })).toHaveAttribute('value', '12400000');
    expect(transcribe).toHaveBeenCalledWith(audio, expect.objectContaining({ language: 'en' }));
    act(() => transcribe.mock.calls[0]?.[1].onProgress?.({ phase: 'transcribing' }));
    expect(screen.getByRole('status')).toHaveTextContent('deviceSpeechTranscribing');

    await act(async () => finish({ text: 'Said on my laptop', problem: null }));
    expect(await screen.findByText('Said on my laptop')).toBeInTheDocument();
    expect(attachmentsService.downloadAttachment).toHaveBeenCalledWith('voice.webm');
    expect(attachmentsService.storeTranscript).toHaveBeenCalledWith(recording.id, 'Said on my laptop');
    expect(attachmentsService.transcribeAttachment).not.toHaveBeenCalled();
  });

  it('says why there is no transcript, and lets the writer try again', async () => {
    const user = userEvent.setup();
    transcribe
      .mockResolvedValueOnce({ text: null, problem: 'deviceSpeechOutOfMemory' })
      .mockResolvedValueOnce({ text: 'Said on my laptop', problem: null });
    renderTranscript();

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('deviceSpeechOutOfMemory');

    await user.click(screen.getByRole('button', { name: 'deviceSpeechRetry' }));
    expect(await screen.findByText('Said on my laptop')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('follows a transcription started in the background when the entry was saved', async () => {
    transcribe.mockResolvedValue({ text: 'Started on save', problem: null });
    const { attachmentsService, recording } = renderTranscript();

    act(() => recordingTranscriptions.transcribe({ attachments: [recording], attachmentsService, language: 'fr' }));

    expect(await screen.findByText('Started on save')).toBeInTheDocument();
    expect(transcribe).toHaveBeenCalledWith(audio, expect.objectContaining({ language: 'fr' }));
    expect(screen.queryByRole('button', { name: 'transcribeAudio' })).not.toBeInTheDocument();
  });
});
