import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttachmentUpload from './AttachmentUpload';
import type { Attachment } from '../../types';

const mockT = (key: string) => key;

describe('AttachmentUpload', () => {
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
    expect(screen.getByText('attach')).toBeInTheDocument();
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
    await user.click(removeButtons[0]);
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
    await user.click(removeButtons[0]);
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

  it('renders in light theme', () => {
    render(<AttachmentUpload {...defaultProps} theme="light" />);
    expect(screen.getByTitle('attachFiles')).toBeInTheDocument();
  });

  it('does not show attachment list when there are no files', () => {
    const { container } = render(<AttachmentUpload {...defaultProps} />);
    // Only the button row should be present, no file grid
    expect(container.querySelectorAll('.mt-3')).toHaveLength(0);
  });
});
