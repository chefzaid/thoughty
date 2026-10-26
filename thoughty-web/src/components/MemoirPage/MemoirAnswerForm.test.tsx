import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MemoirAnswerForm from './MemoirAnswerForm';
import { getTranslation } from '../../utils/translations';

const attachmentsService = { uploadAttachment: vi.fn(), transcribeAttachment: vi.fn() };
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => attachmentsService }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

class FakeMediaRecorder {
  static isTypeSupported = vi.fn((type: string) => type === 'audio/webm;codecs=opus');
  static instances: FakeMediaRecorder[] = [];
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public stream: MediaStream, public options: MediaRecorderOptions) {
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const getUserMedia = vi.fn();

function renderForm() {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const onCancel = vi.fn();
  render(<MemoirAnswerForm questionId="childhood-home" questionText="What was home like?" onSubmit={onSubmit} onCancel={onCancel} t={t} />);
  return { onSubmit, onCancel };
}

function chooseFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('MemoirAnswerForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeMediaRecorder.instances = [];
    getUserMedia.mockResolvedValue({ getTracks: () => [track] });
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    URL.createObjectURL = vi.fn(() => 'blob:recording');
    URL.revokeObjectURL = vi.fn();
    attachmentsService.uploadAttachment.mockResolvedValue({ id: 31 });
    attachmentsService.transcribeAttachment.mockResolvedValue({ transcript: 'We lived by the harbour.', transcribed_at: '', cached: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('records an answer, releases the microphone, and saves the recording with the answer', async () => {
    const { onSubmit } = renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirRecord' }));
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(FakeMediaRecorder.instances[0]!.options).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 });
    expect(screen.getByRole('button', { name: /memoirStopRecording/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'memoirSaveAnswer' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /memoirStopRecording/ }));
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByText('memoirRecordingReady 0:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ questionId: 'childhood-home', text: '', attachmentIds: [31] }));
    const uploaded = attachmentsService.uploadAttachment.mock.calls[0]![0] as File;
    expect(uploaded.name).toBe('memoir-answer.webm');
    expect(uploaded.type).toBe('audio/webm');
  });

  it('stops recording on its own at the length limit', async () => {
    vi.useFakeTimers();
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirRecord' }));
    });
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });

    expect(FakeMediaRecorder.instances[0]!.state).toBe('inactive');
    expect(screen.getByText('memoirRecordingReady 15:00')).toBeInTheDocument();
  });

  it('explains when the microphone is refused and still allows uploading a recording', async () => {
    getUserMedia.mockRejectedValue(new Error('denied'));
    renderForm();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirRecord' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('memoirMicrophoneError');
    expect(screen.queryByRole('button', { name: 'memoirRecord' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'memoirUploadRecording' })).toBeEnabled();
  });

  it('turns an uploaded recording into editable text, uploading it only once', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText('memoirYourAnswer'), { target: { value: 'First thoughts.' } });
    chooseFile(new File(['voice'], 'story.m4a', { type: 'audio/mp4' }));
    expect(screen.getByText('memoirRecordingReady story.m4a')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'memoirTranscribe' }));
    await waitFor(() => expect(screen.getByLabelText('memoirYourAnswer')).toHaveValue('First thoughts.\n\nWe lived by the harbour.'));
    expect(attachmentsService.transcribeAttachment).toHaveBeenCalledWith(31);

    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      questionId: 'childhood-home',
      text: 'First thoughts.\n\nWe lived by the harbour.',
      attachmentIds: [31],
    }));
    expect(attachmentsService.uploadAttachment).toHaveBeenCalledTimes(1);
  });

  it('rejects recordings over 5 MB and lets the writer remove a recording', () => {
    renderForm();
    chooseFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'long.mp3', { type: 'audio/mpeg' }));
    expect(screen.getByRole('alert')).toHaveTextContent('memoirRecordingTooLarge');

    chooseFile(new File(['voice'], 'short.mp3', { type: 'audio/mpeg' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'memoirDiscardRecording' }));
    expect(screen.queryByText(/memoirRecordingReady/)).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording');
  });

  it('reports failed uploads and transcriptions without losing the recording', async () => {
    const { onSubmit } = renderForm();
    chooseFile(new File(['voice'], 'story.ogg', { type: 'audio/ogg' }));

    attachmentsService.uploadAttachment.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'memoirSaveAnswer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('memoirUploadError');
    expect(onSubmit).not.toHaveBeenCalled();

    attachmentsService.uploadAttachment.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'memoirTranscribe' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('memoirUploadError'));

    attachmentsService.transcribeAttachment.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'memoirTranscribe' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('memoirTranscribeError'));
    expect(screen.getByText(/memoirRecordingReady/)).toBeInTheDocument();
  });

  it('hides recording where the browser cannot record', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { onCancel } = renderForm();

    expect(screen.queryByRole('button', { name: 'memoirRecord' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
  it.each([
    ['en', 'No captions available'],
    ['fr', 'Aucun sous-titre disponible'],
  ] as const)('gives the recording an empty caption track in the profile language (%s)', (language, label) => {
    render(
      <MemoirAnswerForm
        questionId="childhood-home"
        questionText="What was home like?"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        t={(key, params) => getTranslation(language, key, params)}
      />,
    );

    chooseFile(new File(['voice'], 'story.m4a', { type: 'audio/mp4' }));

    const captions = document.querySelector('audio track');
    expect(captions).toHaveAttribute('srclang', language);
    expect(captions).toHaveAttribute('label', label);
  });
});
