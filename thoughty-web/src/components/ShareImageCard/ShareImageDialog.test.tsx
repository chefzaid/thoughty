import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation } from '../../utils/translations';
import { createFakeContext, drawnText, type FakeContext } from './shareCard.test-utils';
import ShareImageDialog, { type ShareableEntry } from './ShareImageDialog';

const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('../../utils/downloadFile', () => ({ downloadBlob }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const ENTRY: ShareableEntry = {
  content: 'The maple **turned** red.',
  format: 'markdown',
  title: 'Autumn light',
  date: '2026-10-12',
  visibility: 'private',
};
const PNG = new Blob(['png'], { type: 'image/png' });

let ctx: FakeContext;

function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
  }
}

function renderDialog(props: Partial<Parameters<typeof ShareImageDialog>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(
    <ShareImageDialog isOpen entry={ENTRY} isDark language="en" onClose={onClose} t={t} {...props} />,
  );
  return { ...view, onClose };
}

const preview = () => screen.getByTestId('share-image-preview');

beforeEach(() => {
  ctx = createFakeContext().ctx;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(PNG));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  downloadBlob.mockReset();
  stubNavigator({ clipboard: undefined, share: undefined, canShare: undefined });
});

describe('ShareImageDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('previews the whole entry as a dark square card with alt text, and warns about a private entry', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Share as image' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('note')).toHaveTextContent(t('shareImagePrivateNote'));
    expect(screen.getByLabelText('Text on the card')).toHaveValue('The maple turned red.');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Square' })).toBeChecked();
    expect(preview()).toHaveAttribute('width', '1080');
    expect(screen.getByRole('img', { name: 'Image card preview: “The maple turned red.”, October 12, 2026' })).toBe(preview());
    expect(drawnText(ctx)).toContain('Autumn light');
    expect(screen.getByText(t('shareImageUnsupported'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy image' })).not.toBeInTheDocument();
  });

  it('starts from the selected excerpt in the light theme and goes back to the whole entry', async () => {
    const user = userEvent.setup();
    renderDialog({ initialExcerpt: ' maple turned ', isDark: false, entry: { ...ENTRY, visibility: 'public' } });

    const text = screen.getByLabelText('Text on the card');
    expect(text).toHaveValue('maple turned');
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use the whole entry' }));

    expect(text).toHaveValue('The maple turned red.');
    expect(screen.queryByRole('button', { name: 'Use the whole entry' })).not.toBeInTheDocument();
  });

  it('redraws the card for a new preset, size, title and mark choice', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('radio', { name: 'Violet' }));
    await user.click(screen.getByRole('radio', { name: 'Portrait' }));
    await user.click(screen.getByRole('checkbox', { name: 'Show the title' }));
    ctx.fillText.mockClear();
    await user.click(screen.getByRole('checkbox', { name: /Thoughty/ }));

    expect(preview()).toHaveAttribute('height', '1350');
    expect(drawnText(ctx)).not.toContain('Autumn light');
    expect(drawnText(ctx)).not.toContain('Thoughty');
  });

  it('hides the title switch for an untitled entry', () => {
    renderDialog({ entry: { ...ENTRY, title: null } });

    expect(screen.queryByRole('checkbox', { name: 'Show the title' })).not.toBeInTheDocument();
  });

  it('downloads the PNG named after the entry day', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    expect(downloadBlob).toHaveBeenCalledWith(PNG, 'thoughty-2026-10-12.png');
    expect(screen.getByRole('status')).toHaveTextContent('Image downloaded.');
  });

  it('reports a card the browser could not encode', async () => {
    const user = userEvent.setup();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    expect(screen.getByRole('status')).toHaveTextContent('The image could not be created.');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('turns the actions off until the card has text', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText('Text on the card'));

    expect(screen.getByText(t('shareImageEmpty'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  });

  it('copies the image where the clipboard takes images, and says when it fails', async () => {
    const user = userEvent.setup();
    const write = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    vi.stubGlobal('ClipboardItem', class {});
    stubNavigator({ clipboard: { write } });
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Copy image' }));
    expect(await screen.findByText('Image copied to the clipboard.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy image' }));
    expect(await screen.findByText(t('shareImageCopyFailed'))).toBeInTheDocument();
    expect(screen.queryByText(t('shareImageUnsupported'))).not.toBeInTheDocument();
  });

  it('shares the PNG through the share sheet, quietly when it is closed', async () => {
    const user = userEvent.setup();
    const share = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockRejectedValueOnce(new Error('broken'));
    stubNavigator({ share, canShare: () => true });
    renderDialog();
    const shareButton = screen.getByRole('button', { name: 'Share…' });

    await user.click(shareButton);
    expect(await screen.findByText('Image shared.')).toBeInTheDocument();
    const [{ files, title }] = share.mock.calls[0] as [{ files: File[]; title: string }];
    expect(files[0]).toMatchObject({ name: 'thoughty-2026-10-12.png', type: 'image/png' });
    expect(title).toBe('Autumn light');

    await user.click(shareButton);
    expect(screen.getByRole('status')).toHaveTextContent('');

    await user.click(shareButton);
    expect(await screen.findByText(t('shareImageShareFailed'))).toBeInTheDocument();
  });

  it('starts on the close button and closes with Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    expect(screen.getAllByRole('button', { name: 'Close' })[0]).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});
