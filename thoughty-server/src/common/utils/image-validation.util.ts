export type PassiveImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export interface ImageDimensions {
  width: number;
  height: number;
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function hasPassiveImageSignature(
  data: Buffer,
  mimeType: PassiveImageMimeType,
): boolean {
  switch (mimeType) {
    case 'image/png':
      return data.length >= 24 && data.subarray(0, 8).equals(PNG_SIGNATURE);
    case 'image/jpeg':
      return data.length >= 4 && data[0] === 0xff && data[1] === 0xd8;
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'));
    default:
      return (
        data.length >= 12 &&
        data.subarray(0, 4).toString('ascii') === 'RIFF' &&
        data.subarray(8, 12).toString('ascii') === 'WEBP'
      );
  }
}

function readJpegDimensions(data: Buffer): ImageDimensions | undefined {
  let offset = 2;
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = data.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      return undefined;
    }
    offset += segmentLength + 2;
  }
  return undefined;
}

export function readPassiveImageDimensions(
  data: Buffer,
  mimeType: Extract<PassiveImageMimeType, 'image/jpeg' | 'image/png'>,
): ImageDimensions | undefined {
  if (!hasPassiveImageSignature(data, mimeType)) {
    return undefined;
  }
  if (mimeType === 'image/png') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  return readJpegDimensions(data);
}

export function imageDimensionsAreBounded(
  dimensions: ImageDimensions | undefined,
  maxDimension: number,
  maxPixels: number,
): boolean {
  return Boolean(
    dimensions &&
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      dimensions.width <= maxDimension &&
      dimensions.height <= maxDimension &&
      dimensions.width * dimensions.height <= maxPixels,
  );
}
