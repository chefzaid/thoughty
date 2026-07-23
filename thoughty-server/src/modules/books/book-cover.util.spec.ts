import { createBookCover, MAX_BOOK_COVER_IMAGE_SIZE } from './book-cover.util';

describe('book-cover.util', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  function file(buffer: Buffer, mimetype = 'image/png'): Express.Multer.File {
    return {
      buffer,
      mimetype,
      size: buffer.length,
      originalname: 'cover.png',
    } as Express.Multer.File;
  }

  it('returns no cover when no customization is requested', () => {
    expect(createBookCover(undefined)).toBeUndefined();
  });

  it('creates a themed cover without an image', () => {
    expect(createBookCover('forest')).toEqual({ theme: 'forest' });
  });

  it('accepts a valid bounded PNG image', () => {
    expect(createBookCover('ocean', file(png))).toEqual({
      theme: 'ocean',
      image: { data: png, mimeType: 'image/png' },
    });
  });

  it('rejects unsupported, oversized, and truncated files', () => {
    expect(() => createBookCover(undefined, file(png, 'image/gif'))).toThrow('PNG or JPEG');

    const oversized = Buffer.alloc(MAX_BOOK_COVER_IMAGE_SIZE + 1);
    expect(() => createBookCover(undefined, file(oversized, 'image/jpeg'))).toThrow('2 MB');

    expect(() =>
      createBookCover(undefined, { ...file(png), size: png.length + 1 }),
    ).toThrow('2 MB');
  });

  it('rejects invalid signatures and excessive image dimensions', () => {
    expect(() => createBookCover(undefined, file(Buffer.from('not a png')))).toThrow(
      'invalid',
    );

    const oversizedDimensions = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
      oversizedDimensions,
    );
    oversizedDimensions.writeUInt32BE(7000, 16);
    oversizedDimensions.writeUInt32BE(7000, 20);
    expect(() => createBookCover(undefined, file(oversizedDimensions))).toThrow(
      'maximum dimensions',
    );
  });

  it('reads JPEG dimensions from a start-of-frame segment', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 0x00, 0x00, 0x00,
    ]);

    expect(createBookCover('rose', file(jpeg, 'image/jpeg'))).toEqual({
      theme: 'rose',
      image: { data: jpeg, mimeType: 'image/jpeg' },
    });
  });

  it('rejects malformed JPEG marker streams', () => {
    const invalidStart = Buffer.alloc(12);
    const missingFrame = Buffer.from([
      0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const repeatedStart = Buffer.from([
      0xff, 0xd8, 0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const invalidSegment = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    for (const malformed of [invalidStart, missingFrame, repeatedStart, invalidSegment]) {
      expect(() => createBookCover(undefined, file(malformed, 'image/jpeg'))).toThrow(
        'invalid',
      );
    }
  });
});
