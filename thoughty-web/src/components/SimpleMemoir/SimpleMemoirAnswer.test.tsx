import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SimpleMemoirAnswer from './SimpleMemoirAnswer';

const attachmentsService = { uploadAttachment: vi.fn(), transcribeAttachment: vi.fn() };
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => attachmentsService }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const getUserMedia = vi.fn();

function renderAnswer(saved = true) {
  const onSubmit = vi.fn().mockResolvedValue(saved);
  render(<SimpleMemoirAnswer questionId="childhood-home" onSubmit={onSubmit} t={t} />);
  return onSubmit;
}

async function record() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'memoirRecord' }));
  });
  fireEvent.click(screen.getByRole('button', { name: 'memoirStopRecording' }));
}

describe('SimpleMemoirAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    URL.createObjectURL = vi.fn(() => 'blob:recording');
    URL.revokeObjectURL = vi.fn();
    attachmentsService.uploadAttachment.mockResolvedValue({ id: 31 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('records with one button, shows the time, then saves the recording as the answer', async () => {
    vi.useFakeTimers();
    const onSubmit = renderAnswer();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirRecord' }));
    });
    const stop = screen.getByRole('button', { name: 'memoirStopRecording' });
    expect(stop).toHaveFocus();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('timer')).toHaveTextContent('memoirRecordingTime 0:03');

    fireEvent.click(stop);
    const save = screen.getByRole('button', { name: 'memoirSimpleSave' });
    expect(save).toHaveFocus();
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:recording');
    vi.useRealTimers();

    fireEvent.click(save);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ questionId: 'childhood-home', text: '', attachmentIds: [31] }));
    expect(attachmentsService.uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ type: 'audio/webm' }));
  });

  it('records again in place of the first recording', async () => {
    renderAnswer();
    await record();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleRecordAgain' }));
    });
    expect(screen.getByRole('button', { name: 'memoirStopRecording' })).toBeInTheDocument();
    expect(document.querySelector('audio')).toBeNull();
  });

  it('says when the recording could not be uploaded or the answer saved, and uploads it only once', async () => {
    attachmentsService.uploadAttachment.mockResolvedValueOnce(null);
    const onSubmit = renderAnswer(false);
    await record();

    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('memoirUploadError');
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));
    expect(await screen.findByText('memoirAnswerError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(attachmentsService.uploadAttachment).toHaveBeenCalledTimes(2);
  });

  it('offers a text field instead when the microphone is refused', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('denied'));
    const onSubmit = renderAnswer();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirRecord' }));
    });
    expect(screen.getByText('memoirSimpleWriteInstead')).toBeInTheDocument();
    const field = screen.getByLabelText('memoirYourAnswer');
    expect(field).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));
    expect(screen.getByRole('alert')).toHaveTextContent('memoirAnswerEmpty');

    fireEvent.change(field, { target: { value: '  We lived by the sea.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirSimpleSave' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ questionId: 'childhood-home', text: 'We lived by the sea.' }));
  });

  it('starts with the text field in a browser that cannot record', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    renderAnswer();
    expect(screen.queryByRole('button', { name: 'memoirRecord' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('memoirYourAnswer')).not.toHaveFocus();
  });
});
