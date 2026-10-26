import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getTranslation } from '../../utils/translations';
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
        t={(key) => key}
      />,
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByTitle('archive.bin')).not.toBeInTheDocument();
  });

  it.each([
    ['en', 'No captions available'],
    ['fr', 'Aucun sous-titre disponible'],
  ] as const)('labels the empty caption track of an audio file in %s and declares that language', (language, label) => {
    const { container } = render(
      <AttachmentPreviewContent
        name="note.mp3"
        mimetype="audio/mpeg"
        sourceUrl="/api/attachments/file/note.mp3"
        t={(key) => getTranslation(language, key)}
      />,
    );

    expect(container.querySelector('track')).toHaveAttribute('label', label);
    expect(container.querySelector('track')).toHaveAttribute('srclang', language);
  });

  it('does not create an object URL for unsupported pending files', () => {
    const file = new File(['raw'], 'archive.bin', { type: 'application/octet-stream' });

    render(<PreviewUrlProbe file={file} />);

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});