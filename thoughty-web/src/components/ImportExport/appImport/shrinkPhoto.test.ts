import { afterEach, describe, expect, it, vi } from 'vitest';

import { shrinkPhoto } from './shrinkPhoto';

class FakeCanvas {
  static drawn: Array<[number, number]> = [];

  constructor(public width: number, public height: number) {}

  getContext() {
    return { drawImage: (_image: unknown, _x: number, _y: number, width: number, height: number) => FakeCanvas.drawn.push([width, height]) };
  }

  /** Encoded size grows with the pixel count, so smaller canvases fit tighter limits. */
  async convertToBlob(options: { type: string }) {
    return new Blob([new Uint8Array(Math.round((this.width * this.height) / 1000))], { type: options.type });
  }
}

describe('shrinkPhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeCanvas.drawn = [];
  });

  it('scales a photo down step by step until the JPEG fits', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 8000, height: 6000, close }));
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);

    const jpeg = await shrinkPhoto(new Blob(['photo']), 4000);

    expect(FakeCanvas.drawn).toEqual([[4096, 3072], [3072, 2304], [2048, 1536]]);
    expect(jpeg?.type).toBe('image/jpeg');
    expect(jpeg?.size).toBe(3146);
    expect(close).toHaveBeenCalled();
  });

  it('keeps small photos at their size and gives up when nothing fits', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 400, height: 300, close: vi.fn() }));
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);

    await expect(shrinkPhoto(new Blob(['photo']), 10)).resolves.toBeNull();
    expect(FakeCanvas.drawn.every(([width, height]) => width === 400 && height === 300)).toBe(true);
  });

  it('returns null for formats the browser cannot decode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('unsupported', 'InvalidStateError')));

    await expect(shrinkPhoto(new Blob(['heic']), 4000)).resolves.toBeNull();
  });

  it('falls back to a page canvas without OffscreenCanvas', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 100, height: 100, close }));
    vi.stubGlobal('OffscreenCanvas', undefined);
    const toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })));
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob);

    const jpeg = await shrinkPhoto(new Blob(['photo']), 4000);

    expect(jpeg?.type).toBe('image/jpeg');
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    getContext.mockReturnValue(null);
    await expect(shrinkPhoto(new Blob(['photo']), 4000)).resolves.toBeNull();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
