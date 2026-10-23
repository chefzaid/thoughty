import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AttachmentPreviewDialog from './AttachmentPreviewDialog';

const mockT = (key: string) => key;

describe('AttachmentPreviewDialog', () => {
  it('renders nothing when preview is null', () => {
    const { container } = render(
      <AttachmentPreviewDialog
        preview={null}
        isDark
        onClose={vi.fn()}
        t={mockT}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders preview metadata without a download link when downloadUrl is missing', () => {
    render(
      <AttachmentPreviewDialog
        preview={{
          name: 'draft.txt',
          mimetype: 'text/plain',
          sourceUrl: 'blob:preview',
          size: 512,
        }}
        isDark
        onClose={vi.fn()}
        t={mockT}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'previewAttachment draft.txt' })).toBeInTheDocument();
    expect(screen.getByText('Text · 512 B')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'downloadAttachment' })).not.toBeInTheDocument();
  });

  it('renders a download link when downloadUrl is provided', () => {
    render(
      <AttachmentPreviewDialog
        preview={{
          name: 'guide.pdf',
          mimetype: 'application/pdf',
          sourceUrl: '/api/attachments/file/uuid-guide.pdf',
          size: 2048,
          downloadUrl: '/api/attachments/file/uuid-guide.pdf',
        }}
        isDark={false}
        onClose={vi.fn()}
        t={mockT}
      />,
    );

    const link = screen.getByRole('link', { name: 'downloadAttachment' });
    expect(link).toHaveAttribute('href', '/api/attachments/file/uuid-guide.pdf');
    // Downloads rather than opening the file as a page, so an SVG blob never runs in the app origin.
    expect(link).toHaveAttribute('download', 'guide.pdf');
    expect(link).not.toHaveAttribute('target');
  });

  it('calls onClose from the close button and cancel event', () => {
    const onClose = vi.fn();
    render(
      <AttachmentPreviewDialog
        preview={{
          name: 'photo.png',
          mimetype: 'image/png',
          sourceUrl: '/api/attachments/file/uuid-photo.png',
          size: 1024,
          downloadUrl: '/api/attachments/file/uuid-photo.png',
        }}
        isDark
        onClose={onClose}
        t={mockT}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});