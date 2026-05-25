import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttachmentPreviewContent from './AttachmentPreviewContent';
import { usePendingAttachmentPreviewUrl } from './usePendingAttachmentPreviewUrl';

const createObjectURL = vi.fn(() => 'blob:preview');
const revokeObjectURL = vi.fn();

function PreviewUrlProbe({ file }: Readonly<{ file: File }>) {
  const previewUrl = usePendingAttachmentPreviewUrl(file);

  return <span>{previewUrl ?? 'none'}</span>;
}

describe('AttachmentPreviewContent', () => {
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

  it('renders a fallback icon for unsupported file types', () => {
    const { container } = render(
      <AttachmentPreviewContent
        name="archive.bin"
        mimetype="application/octet-stream"
        sourceUrl="/api/attachments/file/archive.bin"
      />,
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByTitle('archive.bin')).not.toBeInTheDocument();
  });

  it('does not create an object URL for unsupported pending files', () => {
    const file = new File(['raw'], 'archive.bin', { type: 'application/octet-stream' });

    render(<PreviewUrlProbe file={file} />);

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});