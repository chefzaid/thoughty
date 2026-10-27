import {
  bookImageDataUri,
  bookImageExtension,
  escapeBookImageMarkdownText,
  isSafeEmbeddedBookImage,
  embeddedBookImageCondition,
  normalizeEmbeddedBookImages,
} from './book-image.util';

describe('book-image.util', () => {
  const baseImage = {
    id: 1,
    name: 'photo',
    storedFilename: 'stored',
    size: 3,
  };

  it('normalizes supported passive image attachment types only', () => {
    const images = normalizeEmbeddedBookImages([
      {
        id: 1,
        originalFilename: 'photo.png',
        storedFilename: 'stored.png',
        mimetype: 'image/png',
        size: 3,
      },
      {
        id: 2,
        originalFilename: 'active.svg',
        storedFilename: 'stored.svg',
        mimetype: 'image/svg+xml',
        size: 3,
      },
    ]);

    expect(images).toEqual([{
      id: 1,
      name: 'photo.png',
      storedFilename: 'stored.png',
      mimeType: 'image/png',
      size: 3,
    }]);
    expect(normalizeEmbeddedBookImages()).toEqual([]);
  });

  it('prints the poster frame of a video under its name, never the video, and skips a video without one', () => {
    expect(normalizeEmbeddedBookImages([
      { id: 3, originalFilename: 'beach.mp4', storedFilename: 'video.mp4', mimetype: 'video/mp4', size: 9000, posterFilename: 'frame.jpg', posterSize: 40 },
      { id: 4, originalFilename: 'boat.mov', storedFilename: 'boat.mov', mimetype: 'video/quicktime', size: 9000, posterFilename: null },
      { id: 5, originalFilename: 'odd.pdf', storedFilename: 'odd.pdf', mimetype: 'application/pdf', size: 9, posterFilename: 'x.jpg', posterSize: 1 },
    ])).toEqual([{ id: 3, name: 'beach.mp4', storedFilename: 'frame.jpg', mimeType: 'image/jpeg', size: 40 }]);
    expect(embeddedBookImageCondition('a')).toBe('(a.mimetype IN (:...imageTypes) OR a.poster_filename IS NOT NULL)');
  });

  it('builds data URIs only after an image is hydrated', () => {
    expect(bookImageDataUri({ ...baseImage, mimeType: 'image/png' })).toBeUndefined();
    expect(bookImageDataUri({
      ...baseImage,
      mimeType: 'image/png',
      data: Buffer.from('png'),
    })).toBe('data:image/png;base64,cG5n');
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
  ] as const)('maps %s to a safe file extension', (mimeType, extension) => {
    expect(bookImageExtension({ ...baseImage, mimeType })).toBe(extension);
  });

  it('accepts bounded passive images and rejects spoofed or excessive data', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    expect(isSafeEmbeddedBookImage(
      { ...baseImage, mimeType: 'image/png' },
      png,
    )).toBe(true);
    expect(isSafeEmbeddedBookImage(
      { ...baseImage, mimeType: 'image/png' },
      Buffer.from('bad'),
    )).toBe(false);
    expect(isSafeEmbeddedBookImage(
      { ...baseImage, mimeType: 'image/gif' },
      Buffer.from('GIF89a'),
    )).toBe(true);
    expect(isSafeEmbeddedBookImage(
      { ...baseImage, mimeType: 'image/webp' },
      Buffer.from('RIFF0000WEBP'),
    )).toBe(true);

    const hugePng = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hugePng);
    hugePng.writeUInt32BE(7000, 16);
    hugePng.writeUInt32BE(7000, 20);
    expect(isSafeEmbeddedBookImage(
      { ...baseImage, mimeType: 'image/png' },
      hugePng,
    )).toBe(false);
  });

  it('escapes attachment names before inserting them into Markdown', () => {
    expect(escapeBookImageMarkdownText('day](bad)*.png')).toBe(
      'day\\]\\(bad\\)\\*\\.png',
    );
  });
});
