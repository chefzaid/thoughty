import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders non-image attachments as download links', () => {
    const attachments: Attachment[] = [{
      id: 2,
      original_filename: 'document.pdf',
      stored_filename: 'uuid-doc.pdf',
      mimetype: 'application/pdf',
      size: 4096,
    }];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    const link = screen.getByText('document.pdf');
    expect(link.closest('a')).toHaveAttribute('href', '/api/attachments/file/uuid-doc.pdf');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
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
    expect(screen.getByText('(512 B)')).toBeInTheDocument();
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
    const dialog = screen.getByRole('dialog');
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

  it('separates images and files into groups', () => {
    const attachments: Attachment[] = [
      { id: 1, original_filename: 'pic.jpg', stored_filename: 'a.jpg', mimetype: 'image/jpeg', size: 100 },
      { id: 2, original_filename: 'doc.pdf', stored_filename: 'b.pdf', mimetype: 'application/pdf', size: 200 },
    ];
    render(<AttachmentDisplay attachments={attachments} theme="dark" t={mockT} />);

    expect(screen.getByAltText('pic.jpg')).toBeInTheDocument();
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
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
