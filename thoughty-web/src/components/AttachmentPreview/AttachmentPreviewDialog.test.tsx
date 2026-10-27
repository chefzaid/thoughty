import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
    expect(screen.getByText('attachmentKindText · 512 B')).toBeInTheDocument();
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

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<AttachmentPreviewDialog preview={photo} isDark onClose={onClose} t={mockT} />);

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is a labelled modal dialog rendered at the end of the page', () => {
    const { container } = render(<AttachmentPreviewDialog preview={photo} isDark onClose={vi.fn()} t={mockT} />);

    const dialog = screen.getByRole('dialog', { name: 'previewAttachment photo.png' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('attachmentKindImage · 1.0 KB');
    expect(container).not.toContainElement(dialog);
  });

  it('moves focus in, keeps Tab inside, closes on Escape and returns focus to its opener', async () => {
    const user = userEvent.setup();
    render(<PreviewHarness preview={photo} />);
    const opener = screen.getByRole('button', { name: 'Open preview' });
    await user.click(opener);

    const download = screen.getByRole('link', { name: 'downloadAttachment' });
    const close = screen.getByRole('button', { name: 'close' });
    expect(close).toHaveFocus();

    await user.tab();
    expect(download).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

const photo = {
  name: 'photo.png',
  mimetype: 'image/png',
  sourceUrl: '/api/attachments/file/uuid-photo.png',
  size: 1024,
  downloadUrl: '/api/attachments/file/uuid-photo.png',
};

function PreviewHarness({ preview }: Readonly<{ preview: typeof photo }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open preview</button>
      <AttachmentPreviewDialog preview={open ? preview : null} isDark onClose={() => setOpen(false)} t={mockT} />
    </>
  );
}
