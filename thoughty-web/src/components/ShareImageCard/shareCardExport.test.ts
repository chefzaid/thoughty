import { afterEach, describe, expect, it, vi } from 'vitest';
import { canCopyImage, canShareImages, canvasToPngBlob, copyImage, shareImage } from './shareCardExport';

function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  stubNavigator({ clipboard: undefined, share: undefined, canShare: undefined });
});

describe('canvasToPngBlob', () => {
  it('resolves to the PNG the canvas encodes', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = document.createElement('canvas');
    const toBlob = vi.fn((callback: BlobCallback) => callback(blob));
    Object.defineProperty(canvas, 'toBlob', { value: toBlob });

    await expect(canvasToPngBlob(canvas)).resolves.toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
  });

  it('rejects when the canvas cannot be encoded', async () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'toBlob', { value: (callback: BlobCallback) => callback(null) });

    await expect(canvasToPngBlob(canvas)).rejects.toThrow('could not be turned into an image');
  });
});

describe('copying', () => {
  it('needs both ClipboardItem and clipboard.write', () => {
    expect(canCopyImage()).toBe(false);
    vi.stubGlobal('ClipboardItem', class {});
    expect(canCopyImage()).toBe(false);
    stubNavigator({ clipboard: { write: vi.fn() } });
    expect(canCopyImage()).toBe(true);
  });

  it('writes the image as a PNG clipboard item', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const ClipboardItemStub = vi.fn(function ClipboardItem(this: { items: unknown }, items: unknown) {
      this.items = items;
    });
    vi.stubGlobal('ClipboardItem', ClipboardItemStub);
    stubNavigator({ clipboard: { write } });
    const blob = Promise.resolve(new Blob(['png'], { type: 'image/png' }));

    await copyImage(blob);

    expect(ClipboardItemStub).toHaveBeenCalledWith({ 'image/png': blob });
    expect(write).toHaveBeenCalledWith([expect.objectContaining({ items: { 'image/png': blob } })]);
  });
});

describe('sharing', () => {
  it('is offered only where the share sheet takes PNG files', () => {
    expect(canShareImages()).toBe(false);
    stubNavigator({ share: vi.fn(), canShare: vi.fn(() => false) });
    expect(canShareImages()).toBe(false);
    stubNavigator({ canShare: vi.fn(() => true) });
    expect(canShareImages()).toBe(true);
    stubNavigator({ canShare: vi.fn(() => { throw new TypeError('files are not supported'); }) });
    expect(canShareImages()).toBe(false);
  });

  it('shares the file and reports a closed share sheet as not shared', async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
    stubNavigator({ share });
    const file = new File(['png'], 'card.png', { type: 'image/png' });

    await expect(shareImage(file, 'Autumn')).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Autumn' });
    await expect(shareImage(file, 'Autumn')).resolves.toBe(false);
  });

  it('passes other share failures on', async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) });

    await expect(shareImage(new File([], 'card.png'), 'Thoughty')).rejects.toThrow('Denied');
  });
});
