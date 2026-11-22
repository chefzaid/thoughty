import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemoirPhotoPrompt from './MemoirPhotoPrompt';
import { memoirChapters } from '../../test/memoirFixture';
import type { MemoirAnswerRef } from '../../services/api';

const attachmentsService = { uploadAttachment: vi.fn() };
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => attachmentsService }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const photoFile = () => new File(['jpeg bytes'], 'bakery.jpg', { type: 'image/jpeg' });

function renderPrompt(photoAnswers: MemoirAnswerRef[] = [], onSubmit = vi.fn().mockResolvedValue(null)) {
  const onOpenEntry = vi.fn();
  render(
    <MemoirPhotoPrompt
      chapters={memoirChapters}
      photoAnswers={photoAnswers}
      eras={[]}
      answerDate="2026-11-22"
      timeZone="Europe/Paris"
      language="en"
      onSubmit={onSubmit}
      onOpenEntry={onOpenEntry}
      t={t}
    />,
  );
  return { onSubmit, onOpenEntry };
}

function choose(file: File) {
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
}

describe('MemoirPhotoPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
    attachmentsService.uploadAttachment.mockResolvedValue({ id: 57 });
  });

  it('uploads the chosen photo and saves its story with its caption and chapter, then closes', async () => {
    const { onSubmit } = renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoStart' }));
    expect(screen.getByRole('button', { name: 'memoirPhotoChoose' })).toHaveFocus();
    choose(photoFile());
    expect(screen.getByRole('img', { name: 'memoirPhotoPreviewAlt' })).toHaveAttribute('src', 'blob:photo');
    expect(screen.getByText('memoirPhotoChosen bakery.jpg')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('memoirPhotoCaption'), { target: { value: ' The bakery, 1962 ' } });
    // The preview is described as the caption describes it
    expect(screen.getByRole('img', { name: 'The bakery, 1962' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('memoirPhotoQuestion'), { target: { value: ' Grandpa opens his shop. ' } });
    fireEvent.change(screen.getByLabelText('memoirPhotoChapter'), { target: { value: memoirChapters[0]!.id } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoSave' }));
    });

    expect(attachmentsService.uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ name: 'bakery.jpg' }));
    expect(onSubmit).toHaveBeenCalledWith({ attachmentId: 57, text: 'Grandpa opens his shop.', caption: 'The bakery, 1962', chapterId: memoirChapters[0]!.id });
    expect(screen.queryByRole('textbox', { name: 'memoirPhotoQuestion' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'memoirPhotoStart' })).toHaveFocus();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('asks for a photo and a story, and refuses files that are not pictures or too large', async () => {
    const { onSubmit } = renderPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoStart' }));

    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoSave' }));
    expect(screen.getByRole('alert')).toHaveTextContent('memoirPhotoMissing');

    choose(new File(['<svg/>'], 'drawing.svg', { type: 'image/svg+xml' }));
    expect(screen.getByRole('alert')).toHaveTextContent('memoirPhotoNotImage');
    const large = photoFile();
    Object.defineProperty(large, 'size', { value: 6 * 1024 * 1024 });
    choose(large);
    expect(screen.getByRole('alert')).toHaveTextContent('memoirPhotoTooLarge');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Choosing nothing changes nothing
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [] } });

    choose(photoFile());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'memoirPhotoChooseAnother' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('memoirPhotoQuestion'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoSave' }));
    expect(screen.getByRole('alert')).toHaveTextContent('memoirPhotoStoryEmpty');
    expect(attachmentsService.uploadAttachment).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the story when the upload or the save fails, says why, and uploads the photo once', async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce('apiError_MEMOIR_PHOTO_IN_USE').mockResolvedValueOnce(null);
    renderPrompt([], onSubmit);
    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoStart' }));
    choose(photoFile());
    fireEvent.change(screen.getByLabelText('memoirPhotoQuestion'), { target: { value: 'A wedding.' } });

    attachmentsService.uploadAttachment.mockResolvedValueOnce(null);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoSave' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('memoirPhotoUploadError');
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoSave' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('apiError_MEMOIR_PHOTO_IN_USE');
    expect(screen.getByLabelText('memoirPhotoQuestion')).toHaveValue('A wedding.');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoSave' }));
    });
    expect(attachmentsService.uploadAttachment).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith({ attachmentId: 57, text: 'A wedding.' });
    await waitFor(() => expect(screen.queryByLabelText('memoirPhotoQuestion')).not.toBeInTheDocument());
  });

  it('cancels without saving, and lists the stories told so far with a way to read each', () => {
    const { onOpenEntry, onSubmit } = renderPrompt([{ entryId: 95, answeredAt: '2026-11-20T10:00:00.000Z' }]);

    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoStart' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'memoirPhotoStart' })).toHaveFocus();

    const stories = screen.getByRole('list', { name: 'memoirPhotoStories' });
    expect(stories).toHaveTextContent('memoirPhotoStoryOn November 20, 2026');
    fireEvent.click(screen.getByRole('button', { name: 'memoirPhotoOpen: memoirPhotoStoryOn November 20, 2026' }));
    expect(onOpenEntry).toHaveBeenCalledWith(95);
  });
});
