import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioTranscript from './AudioTranscript';
import type { Attachment } from '../../types';

const t = (key: string) => key;
const recording: Attachment = { id: 3, original_filename: 'voice-note.webm', stored_filename: 'voice.webm', mimetype: 'audio/webm', size: 10 };
const audio = new Blob(['voice'], { type: 'audio/webm' });

function renderTranscript(transcribe = vi.fn().mockResolvedValue({ data: 'Said to my own model', refusal: null })) {
  const attachmentsService = {
    transcribeAttachment: vi.fn(),
    downloadAttachment: vi.fn().mockResolvedValue(audio),
    storeTranscript: vi.fn().mockResolvedValue({ data: { transcript: 'Said to my own model', transcribed_at: '2026-11-24T10:00:00.000Z', cached: false }, refusal: null }),
  };
  render(
    <AudioTranscript
      attachment={recording}
      attachmentsService={attachmentsService as never}
      localAiService={{ transcribe }}
      isDark={false}
      t={t}
      aiMode="local"
    />,
  );
  return { attachmentsService, transcribe };
}

describe('AudioTranscript in a diary on the writer’s own model', () => {
  it('transcribes on that model and has Thoughty keep only the text, never asking Thoughty’s provider', async () => {
    const user = userEvent.setup();
    const { attachmentsService, transcribe } = renderTranscript();

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));

    expect(await screen.findByText('Said to my own model')).toBeInTheDocument();
    expect(attachmentsService.downloadAttachment).toHaveBeenCalledWith('voice.webm');
    expect(transcribe).toHaveBeenCalledWith(audio, 'voice-note.webm');
    expect(attachmentsService.storeTranscript).toHaveBeenCalledWith(3, 'Said to my own model');
    expect(attachmentsService.transcribeAttachment).not.toHaveBeenCalled();
  });

  it('says why there is no transcript, and lets the writer try again', async () => {
    const user = userEvent.setup();
    const transcribe = vi.fn()
      .mockResolvedValueOnce({ data: null, refusal: 'localModelNoTranscription' })
      .mockResolvedValueOnce({ data: 'Said to my own model', refusal: null });
    renderTranscript(transcribe);

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('localModelNoTranscription');

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(await screen.findByText('Said to my own model')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
