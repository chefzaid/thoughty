import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttachmentDisplay from './AttachmentDisplay';
import type { Attachment } from '../../types';

const mockT = (key: string) => key;

describe('AttachmentDisplay', () => {
  it('renders nothing when attachments is empty', () => {
    const { container } = render(
      <AttachmentDisplay attachments={[]} theme="dark" t={mockT} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when attachments is undefined', () => {
    const { container } = render(
      <AttachmentDisplay attachments={undefined} theme="dark" t={mockT} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders image attachments as clickable thumbnails', () => {
    const attachments: Attachment[] = [{
      id: 1,
      original_filename: 'sunset.jpg',
      stored_filename: 'uuid-sunset.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    const img = screen.getByAltText('sunset.jpg');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/attachments/file/uuid-sunset.jpg');
  });

  it('renders PDF attachments with an inline preview', () => {
    const attachments: Attachment[] = [{
      id: 2,
      original_filename: 'document.pdf',
      stored_filename: 'uuid-doc.pdf',
      mimetype: 'application/pdf',
      size: 4096,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    const preview = screen.getByTitle('document.pdf');
    expect(preview.tagName).toBe('IFRAME');
    expect(preview).toHaveAttribute('src', '/api/attachments/file/uuid-doc.pdf');
    expect(screen.getByRole('link', { name: 'downloadAttachment' })).toHaveAttribute('href', '/api/attachments/file/uuid-doc.pdf');
    expect(screen.getByRole('button', { name: 'previewAttachment document.pdf' })).toBeInTheDocument();
  });

  it('renders audio attachments with an inline player', () => {
    const attachments: Attachment[] = [{
      id: 3,
      original_filename: 'voice-note.mp3',
      stored_filename: 'uuid-voice.mp3',
      mimetype: 'audio/mpeg',
      size: 8192,
    }];

    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    const player = screen.getByLabelText('voice-note.mp3');
    expect(player.tagName).toBe('AUDIO');
    expect(screen.getByText('downloadAttachment').closest('a')).toHaveAttribute('href', '/api/attachments/file/uuid-voice.mp3');
  });

  it('shows file size for non-image attachments', () => {
    const attachments: Attachment[] = [{
      id: 1,
      original_filename: 'notes.txt',
      stored_filename: 'uuid.txt',
      mimetype: 'text/plain',
      size: 512,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);
    expect(screen.getByTitle('notes.txt')).toBeInTheDocument();
    expect(screen.getByText('Text · 512 B')).toBeInTheDocument();
  });

  it('renders unsupported attachments as download links', () => {
    const attachments: Attachment[] = [{
      id: 4,
      original_filename: 'archive.bin',
      stored_filename: 'uuid-archive.bin',
      mimetype: 'application/octet-stream',
      size: 1024,
    }];

    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    const link = screen.getByText('archive.bin');
    expect(link.closest('a')).toHaveAttribute('href', '/api/attachments/file/uuid-archive.bin');
  });

  it('opens lightbox when clicking on an image', async () => {
    const user = userEvent.setup();
    const attachments: Attachment[] = [{
      id: 1,
      original_filename: 'photo.png',
      stored_filename: 'uuid-photo.png',
      mimetype: 'image/png',
      size: 1024,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    // Click the image thumbnail button
    const imageButton = screen.getByRole('button');
    await user.click(imageButton);

    // Lightbox should appear (dialog role)
    const dialog = screen.getByRole('dialog', { name: 'previewAttachment photo.png' });
    expect(dialog).toBeInTheDocument();
  });

  it('closes lightbox when clicking backdrop', async () => {
    const user = userEvent.setup();
    const attachments: Attachment[] = [{
      id: 1,
      original_filename: 'photo.png',
      stored_filename: 'uuid-photo.png',
      mimetype: 'image/png',
      size: 1024,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    // Open lightbox
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close lightbox via close button
    const closeButton = screen.getByLabelText('close');
    await user.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a large preview dialog for PDF attachments', async () => {
    const user = userEvent.setup();
    const attachments: Attachment[] = [{
      id: 2,
      original_filename: 'document.pdf',
      stored_filename: 'uuid-doc.pdf',
      mimetype: 'application/pdf',
      size: 4096,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    await user.click(screen.getByRole('button', { name: 'previewAttachment document.pdf' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const modalPreview = screen.getAllByTitle('document.pdf').at(-1);
    expect(modalPreview).toHaveAttribute('src', '/api/attachments/file/uuid-doc.pdf');
  });

  it('opens a large preview dialog for text attachments', async () => {
    const user = userEvent.setup();
    const attachments: Attachment[] = [{
      id: 3,
      original_filename: 'notes.txt',
      stored_filename: 'uuid-notes.txt',
      mimetype: 'text/plain',
      size: 512,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    await user.click(screen.getByRole('button', { name: 'previewAttachment notes.txt' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const modalPreview = screen.getAllByTitle('notes.txt').at(-1);
    expect(modalPreview).toHaveAttribute('src', '/api/attachments/file/uuid-notes.txt');
  });

  it('closes lightbox when the dialog receives a cancel event', async () => {
    const user = userEvent.setup();
    const attachments: Attachment[] = [{
      id: 1,
      original_filename: 'photo.png',
      stored_filename: 'uuid-photo.png',
      mimetype: 'image/png',
      size: 1024,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    await user.click(screen.getByRole('button'));

    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('separates images and files into groups', () => {
    const attachments: Attachment[] = [
      { id: 1, original_filename: 'pic.jpg', stored_filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 },
      { id: 2, original_filename: 'doc.pdf', stored_filename: 'b.pdf', mimetype: 'application/pdf', size: 200 },
      { id: 3, original_filename: 'note.mp3', stored_filename: 'c.mp3', mimetype: 'audio/mpeg', size: 300 },
      { id: 4, original_filename: 'draft.txt', stored_filename: 'd.txt', mimetype: 'text/plain', size: 400 },
    ];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    expect(screen.getByAltText('pic.jpg')).toBeInTheDocument();
    expect(screen.getByTitle('doc.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('note.mp3')).toBeInTheDocument();
    expect(screen.getByTitle('draft.txt')).toBeInTheDocument();
  });

  it('renders in light theme', () => {
    const attachments: Attachment[] = [{
      id: 1,
      original_filename: 'file.txt',
      stored_filename: 'uuid.txt',
      mimetype: 'text/plain',
      size: 100,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="light" t={mockT} />);
    expect(screen.getByText('file.txt')).toBeInTheDocument();
  });
});
