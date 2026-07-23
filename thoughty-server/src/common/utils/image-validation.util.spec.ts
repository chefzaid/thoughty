import {
  hasPassiveImageSignature,
  imageDimensionsAreBounded,
  readPassiveImageDimensions,
} from './image-validation.util';

describe('image-validation.util', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const jpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 0x00, 0x00, 0x00,
  ]);

  it('recognizes supported passive image signatures', () => {
    expect(hasPassiveImageSignature(png, 'image/png')).toBe(true);
    expect(hasPassiveImageSignature(jpeg, 'image/jpeg')).toBe(true);
    expect(hasPassiveImageSignature(Buffer.from('GIF87a'), 'image/gif')).toBe(true);
    expect(hasPassiveImageSignature(Buffer.from('GIF89a'), 'image/gif')).toBe(true);
    expect(hasPassiveImageSignature(
      Buffer.from('RIFF0000WEBP'),
      'image/webp',
    )).toBe(true);
  });

  it('rejects truncated and mismatched signatures', () => {
    expect(hasPassiveImageSignature(Buffer.from('bad'), 'image/png')).toBe(false);
    expect(hasPassiveImageSignature(Buffer.from('bad'), 'image/jpeg')).toBe(false);
    expect(hasPassiveImageSignature(Buffer.from('GIF00a'), 'image/gif')).toBe(false);
    expect(hasPassiveImageSignature(Buffer.from('RIFF0000NOPE'), 'image/webp')).toBe(false);
  });

  it('reads PNG and JPEG dimensions', () => {
    expect(readPassiveImageDimensions(png, 'image/png')).toEqual({
      width: 1,
      height: 1,
    });
    expect(readPassiveImageDimensions(jpeg, 'image/jpeg')).toEqual({
      width: 200,
      height: 100,
    });
    expect(readPassiveImageDimensions(Buffer.from('bad'), 'image/jpeg')).toBeUndefined();
  });

  it('rejects malformed JPEG segment streams', () => {
    const missingFrame = Buffer.from([
      0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const repeatedStart = Buffer.from([
      0xff, 0xd8, 0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const invalidSegment = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    expect(readPassiveImageDimensions(missingFrame, 'image/jpeg')).toBeUndefined();
    expect(readPassiveImageDimensions(repeatedStart, 'image/jpeg')).toBeUndefined();
    expect(readPassiveImageDimensions(invalidSegment, 'image/jpeg')).toBeUndefined();
  });

  it('checks positive dimensions, per-side limits, and pixel budgets', () => {
    expect(imageDimensionsAreBounded({ width: 100, height: 100 }, 1000, 20_000)).toBe(true);
    expect(imageDimensionsAreBounded(undefined, 1000, 20_000)).toBe(false);
    expect(imageDimensionsAreBounded({ width: 0, height: 100 }, 1000, 20_000)).toBe(false);
    expect(imageDimensionsAreBounded({ width: 1001, height: 10 }, 1000, 20_000)).toBe(false);
    expect(imageDimensionsAreBounded({ width: 200, height: 200 }, 1000, 20_000)).toBe(false);
  });
});
