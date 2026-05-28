import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttachmentUpload from './AttachmentUpload';
import type { Attachment } from '../../types';

const mockT = (key: string) => key;

describe('AttachmentUpload', () => {
  const createObjectURL = vi.fn(() => 'blob:preview');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  const defaultProps = {
    pendingFiles: [] as File[],
    uploadedAttachments: [] as Attachment[],
    onAddFile: vi.fn(),
    onRemovePendingFile: vi.fn(),
    onRemoveUploadedAttachment: vi.fn(),
    theme: 'dark' as const,
    t: mockT,
  };

  it('renders the attach button', () => {
    render(<AttachmentUpload {...defaultProps} />);
    expect(screen.getByTitle('attachFiles')).toBeInTheDocument();
  });

  it('shows pending files with name and size', () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    render(<AttachmentUpload {...defaultProps} pendingFiles={[file]} />);
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('shows uploaded attachments', () => {
    const attachment: Attachment = {
      id: 1,
      original_filename: 'photo.jpg',
      stored_filename: 'uuid.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
    };
    render(<AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} />);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('calls onRemovePendingFile when remove button is clicked', async () => {
    const user = userEvent.setup();
    const file = new File(['data'], 'remove-me.txt', { type: 'text/plain' });
    const onRemove = vi.fn();
    render(
      <AttachmentUpload {...defaultProps} pendingFiles={[file]} onRemovePendingFile={onRemove} />
    );

    const removeButtons = screen.getAllByTitle('removeAttachment');
    await user.click(removeButtons[0]!);
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('calls onRemoveUploadedAttachment when remove button is clicked', async () => {
    const user = userEvent.setup();
    const attachment: Attachment = {
      id: 42,
      original_filename: 'doc.pdf',
      stored_filename: 'uuid.pdf',
      mimetype: 'application/pdf',
      size: 4096,
    };
    const onRemove = vi.fn();
    render(
      <AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} onRemoveUploadedAttachment={onRemove} />
    );

    const removeButtons = screen.getAllByTitle('removeAttachment');
    await user.click(removeButtons[0]!);
    expect(onRemove).toHaveBeenCalledWith(42);
  });

  it('displays image thumbnails for image files', () => {
    const attachment: Attachment = {
      id: 1,
      original_filename: 'cat.png',
      stored_filename: 'uuid.png',
      mimetype: 'image/png',
      size: 1024,
    };
    render(<AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} />);
    const img = screen.getByAltText('cat.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/attachments/file/uuid.png');
  });

  it('displays inline audio players for uploaded audio files', () => {
    const attachment: Attachment = {
      id: 2,
      original_filename: 'voice-note.mp3',
      stored_filename: 'uuid-voice.mp3',
      mimetype: 'audio/mpeg',
      size: 1024,
    };

    render(<AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} />);

    const player = screen.getByLabelText('voice-note.mp3');
    expect(player.tagName).toBe('AUDIO');
    expect(screen.getByText('downloadAttachment').closest('a')).toHaveAttribute('href', '/api/attachments/file/uuid-voice.mp3');
  });

  it('displays inline PDF previews for uploaded documents', () => {
    const attachment: Attachment = {
      id: 3,
      original_filename: 'guide.pdf',
      stored_filename: 'uuid-guide.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    };

    render(<AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} />);

    const preview = screen.getByTitle('guide.pdf');
    expect(preview.tagName).toBe('IFRAME');
    expect(preview).toHaveAttribute('src', '/api/attachments/file/uuid-guide.pdf');
    expect(screen.getByRole('button', { name: 'previewAttachment guide.pdf' })).toBeInTheDocument();
  });

  it('displays inline text previews for pending text files', () => {
    const file = new File(['note body'], 'draft.txt', { type: 'text/plain' });

    render(<AttachmentUpload {...defaultProps} pendingFiles={[file]} />);

    const preview = screen.getByTitle('draft.txt');
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(preview.tagName).toBe('IFRAME');
    expect(preview).toHaveAttribute('src', 'blob:preview');
  });

  it('opens a large preview dialog for pending files', async () => {
    const user = userEvent.setup();
    const file = new File(['note body'], 'draft.txt', { type: 'text/plain' });

    render(<AttachmentUpload {...defaultProps} pendingFiles={[file]} />);

    await user.click(screen.getByRole('button', { name: 'previewAttachment draft.txt' }));

    const dialog = screen.getByRole('dialog', { name: 'previewAttachment draft.txt' });
    expect(dialog).toBeInTheDocument();
    const modalPreview = screen.getAllByTitle('draft.txt').at(-1);
    expect(modalPreview).toHaveAttribute('src', 'blob:preview');
  });

  it('opens a large preview dialog for uploaded attachments', async () => {
    const user = userEvent.setup();
    const attachment: Attachment = {
      id: 3,
      original_filename: 'guide.pdf',
      stored_filename: 'uuid-guide.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    };

    render(<AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} />);

    await user.click(screen.getByRole('button', { name: 'previewAttachment guide.pdf' }));

    const dialog = screen.getByRole('dialog', { name: 'previewAttachment guide.pdf' });
    expect(dialog).toBeInTheDocument();
    const modalPreview = screen.getAllByTitle('guide.pdf').at(-1);
    expect(modalPreview).toHaveAttribute('src', '/api/attachments/file/uuid-guide.pdf');
  });

  it('closes the preview dialog from the uploader', async () => {
    const user = userEvent.setup();
    const file = new File(['note body'], 'draft.txt', { type: 'text/plain' });

    render(<AttachmentUpload {...defaultProps} pendingFiles={[file]} />);

    await user.click(screen.getByRole('button', { name: 'previewAttachment draft.txt' }));
    await user.click(screen.getByRole('button', { name: 'close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render a preview action for unsupported pending files', () => {
    const file = new File(['raw'], 'archive.bin', { type: 'application/octet-stream' });

    render(<AttachmentUpload {...defaultProps} pendingFiles={[file]} />);

    expect(screen.queryByRole('button', { name: 'previewAttachment archive.bin' })).not.toBeInTheDocument();
  });

  it('does not render a preview action for unsupported uploaded attachments', () => {
    const attachment: Attachment = {
      id: 99,
      original_filename: 'archive.bin',
      stored_filename: 'uuid-archive.bin',
      mimetype: 'application/octet-stream',
      size: 1024,
    };

    render(<AttachmentUpload {...defaultProps} uploadedAttachments={[attachment]} />);

    expect(screen.queryByRole('button', { name: 'previewAttachment archive.bin' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'downloadAttachment' })).toHaveAttribute('href', '/api/attachments/file/uuid-archive.bin');
  });

  it('renders in light theme', () => {
    render(<AttachmentUpload {...defaultProps} theme="light" />);
    expect(screen.getByTitle('attachFiles')).toBeInTheDocument();
  });

  it('does not show attachment list when there are no files', () => {
    const { container } = render(<AttachmentUpload {...defaultProps} />);
    // Only the button row should be present, no file grid
    expect(container.querySelectorAll('.mt-3')).toHaveLength(0);
  });

  it('opens the hidden file input when attach button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<AttachmentUpload {...defaultProps} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    await user.click(screen.getByTitle('attachFiles'));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('validates selected files and resets input value', () => {
    const onAddFile = vi.fn();
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    const { container } = render(<AttachmentUpload {...defaultProps} onAddFile={onAddFile} />);

    const validFile = new File(['ok'], 'ok.txt', { type: 'text/plain' });
    const invalidTypeFile = new File(['bad'], 'bad.exe', { type: 'application/x-msdownload' });
    const tooLargeFile = new File([new Uint8Array((5 * 1024 * 1024) + 1)], 'huge.pdf', { type: 'application/pdf' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [invalidTypeFile, tooLargeFile, validFile],
      },
    });

    expect(alertSpy).toHaveBeenCalledWith('attachmentTypeNotAllowed');
    expect(alertSpy).toHaveBeenCalledWith('attachmentTooLarge');
    expect(onAddFile).toHaveBeenCalledTimes(1);
    expect(onAddFile).toHaveBeenCalledWith(validFile);
    expect(fileInput.value).toBe('');

    alertSpy.mockRestore();
  });

  it('accepts supported audio files', () => {
    const onAddFile = vi.fn();
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    const { container } = render(<AttachmentUpload {...defaultProps} onAddFile={onAddFile} />);

    const audioFile = new File(['audio'], 'note.mp3', { type: 'audio/mpeg' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [audioFile],
      },
    });

    expect(onAddFile).toHaveBeenCalledWith(audioFile);
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('renders file size using MB when file is larger than 1 MB', () => {
    const largeFile = new File([new Uint8Array(2 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });

    render(<AttachmentUpload {...defaultProps} pendingFiles={[largeFile]} />);

    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
  });

  it('revokes the object URL when a pending preview unmounts', () => {
    const file = new File(['note body'], 'draft.txt', { type: 'text/plain' });
    const { unmount } = render(<AttachmentUpload {...defaultProps} pendingFiles={[file]} />);

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});
