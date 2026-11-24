import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemoirAnswerForm from './MemoirAnswerForm';
import { AiConsentContext } from '../DiaryAi/aiConsentContext';
import type { RequestAiConsent } from '../DiaryAi/aiConsent';

const attachmentsService = { uploadAttachment: vi.fn(), transcribeAttachment: vi.fn() };
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => attachmentsService }));
const memoirService = { followUps: vi.fn() };
vi.mock('../../hooks/useMemoirService', () => ({ useMemoirService: () => memoirService }));
// Interview mode on the writer's own model is tested in MemoirFollowUps.test.tsx
vi.mock('../../hooks/useLocalAiService', () => ({ useLocalAiService: () => ({}) }));

const t = (key: string) => key;
const QUESTION = 'What was home like?';
const ANSWER = 'A narrow house with a fig tree outside.';

function renderForm(requestConsent: RequestAiConsent) {
  render(
    <AiConsentContext.Provider value={requestConsent}>
      <MemoirAnswerForm questionId="childhood-home" questionText={QUESTION} onSubmit={vi.fn()} onCancel={vi.fn()} aiMode="ask" diaryId={6} t={t} />
    </AiConsentContext.Provider>,
  );
}

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('MemoirAnswerForm in a memoir diary that asks each time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:recording');
    URL.revokeObjectURL = vi.fn();
    attachmentsService.uploadAttachment.mockResolvedValue({ id: 31 });
    attachmentsService.transcribeAttachment.mockResolvedValue({ transcript: 'We lived by the harbour.', transcribed_at: '', cached: false });
    memoirService.followUps.mockResolvedValue({ data: { questions: ['Who lived there with you?'] }, error: null });
  });

  it('names the recording before transcribing it, and neither uploads nor sends it when cancelled', async () => {
    const requestConsent = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderForm(requestConsent);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['voice'], 'story.m4a', { type: 'audio/mp4' })] } });

    await click('memoirTranscribe');
    expect(requestConsent).toHaveBeenCalledWith({ task: 'transcription', recording: { name: 'story.m4a', seconds: null } });
    expect(attachmentsService.uploadAttachment).not.toHaveBeenCalled();
    expect(attachmentsService.transcribeAttachment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'memoirTranscribe' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await click('memoirTranscribe');
    await waitFor(() => expect(screen.getByLabelText('memoirYourAnswer')).toHaveValue('We lived by the harbour.'));
    expect(attachmentsService.transcribeAttachment).toHaveBeenCalledWith(31, 6, true);
  });

  it('shows the answer, the question and the questions already offered before each round of follow-ups', async () => {
    const requestConsent = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    renderForm(requestConsent);
    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: ANSWER } });

    await click('memoirFollowUpsAsk');
    expect(requestConsent).toHaveBeenLastCalledWith({
      text: ANSWER,
      details: [{ label: 'aiConsentQuestion', value: QUESTION }],
      task: 'prompt',
    });
    expect(memoirService.followUps).toHaveBeenCalledWith({ questionId: 'childhood-home', text: ANSWER, asked: [], aiConsent: true });

    await click('memoirFollowUpsAskMore');
    expect(requestConsent).toHaveBeenLastCalledWith({
      text: ANSWER,
      details: [
        { label: 'aiConsentQuestion', value: QUESTION },
        { label: 'aiConsentAskedBefore', value: 'Who lived there with you?' },
      ],
      task: 'prompt',
    });
    // Cancelled: nothing sent, and the questions already offered stay
    expect(memoirService.followUps).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Who lived there with you?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'memoirFollowUpsAskMore' })).toBeEnabled();
  });
});
