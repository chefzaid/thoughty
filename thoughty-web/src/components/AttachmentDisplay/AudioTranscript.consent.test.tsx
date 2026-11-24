import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioTranscript from './AudioTranscript';
import { AiConsentContext } from '../DiaryAi/aiConsentContext';
import type { RequestAiConsent } from '../DiaryAi/aiConsent';
import type { Attachment } from '../../types';

const readAudioDuration = vi.fn();
vi.mock('../../utils/audioDuration', () => ({ readAudioDuration: (url: string | null) => readAudioDuration(url) }));

const t = (key: string) => key;
const recording: Attachment = { id: 3, original_filename: 'voice-note.mp3', stored_filename: 'voice.mp3', mimetype: 'audio/mpeg', size: 10 };

function renderTranscript(requestConsent: RequestAiConsent | undefined, aiMode: 'on' | 'ask' = 'ask') {
  const transcribeAttachment = vi.fn().mockResolvedValue({ transcript: 'Said aloud', transcribed_at: '2026-11-23T10:00:00.000Z', cached: false });
  render(
    <AiConsentContext.Provider value={requestConsent}>
      <AudioTranscript
        attachment={recording}
        attachmentsService={{ transcribeAttachment } as never}
        localAiService={{ transcribe: vi.fn() }}
        isDark={false}
        t={t}
        aiMode={aiMode}
        sourceUrl="blob:voice"
      />
    </AiConsentContext.Provider>,
  );
  return transcribeAttachment;
}

describe('AudioTranscript in a diary that asks each time', () => {
  it('names the recording and its length before sending it, and sends nothing when cancelled', async () => {
    const user = userEvent.setup();
    readAudioDuration.mockResolvedValue(83.4);
    const requestConsent = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const transcribeAttachment = renderTranscript(requestConsent);

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(readAudioDuration).toHaveBeenCalledWith('blob:voice');
    expect(requestConsent).toHaveBeenCalledWith({ task: 'transcription', recording: { name: 'voice-note.mp3', seconds: 83.4 } });
    expect(transcribeAttachment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'transcribeAudio' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(transcribeAttachment).toHaveBeenCalledWith(3, null, true);
    expect(await screen.findByText('Said aloud')).toBeInTheDocument();
  });

  it('sends nothing without a consent dialog to ask with, and asks nothing in a diary with AI on', async () => {
    const user = userEvent.setup();
    readAudioDuration.mockClear();
    const unasked = renderTranscript(undefined);
    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(unasked).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    const requestConsent = vi.fn();
    const sent = renderTranscript(requestConsent, 'on');
    await user.click(screen.getByRole('button', { name: 'transcribeAudio' }));
    expect(requestConsent).not.toHaveBeenCalled();
    expect(sent).toHaveBeenCalledWith(3, null, undefined);
    expect(readAudioDuration).toHaveBeenCalledTimes(1);
  });
});
