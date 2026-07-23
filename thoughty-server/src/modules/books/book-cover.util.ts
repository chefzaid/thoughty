import { BadRequestException } from '@nestjs/common';
import type { BookCover } from '@/common/utils';
import type { BookQueryDto } from './dto';

export const MAX_BOOK_COVER_IMAGE_SIZE = 2 * 1024 * 1024;

const MAX_COVER_DIMENSION = 6000;
const MAX_COVER_PIXELS = 25_000_000;
const COVER_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

interface ImageDimensions {
  width: number;
  height: number;
}

function readPngDimensions(data: Buffer): ImageDimensions | undefined {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 24 || !data.subarray(0, 8).equals(signature)) {
    return undefined;
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function readJpegDimensions(data: Buffer): ImageDimensions | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return undefined;
  }

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

function validateImageDimensions(dimensions?: ImageDimensions): void {
  if (
    !dimensions ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width > MAX_COVER_DIMENSION ||
    dimensions.height > MAX_COVER_DIMENSION ||
    dimensions.width * dimensions.height > MAX_COVER_PIXELS
  ) {
    throw new BadRequestException(
      'Cover image is invalid or exceeds the maximum dimensions of 6000 pixels and 25 megapixels.',
    );
  }
}

export function createBookCover(
  theme: BookQueryDto['coverTheme'],
  file?: Express.Multer.File,
): BookCover | undefined {
  if (!file && !theme) {
    return undefined;
  }

  const cover: BookCover = { theme: theme ?? 'classic' };
  if (!file) {
    return cover;
  }

  if (
    !COVER_IMAGE_TYPES.includes(file.mimetype as (typeof COVER_IMAGE_TYPES)[number]) ||
    file.size > MAX_BOOK_COVER_IMAGE_SIZE ||
    file.buffer.length !== file.size
  ) {
    throw new BadRequestException('Cover image must be a PNG or JPEG file no larger than 2 MB.');
  }

  const dimensions =
    file.mimetype === 'image/png'
      ? readPngDimensions(file.buffer)
      : readJpegDimensions(file.buffer);
  validateImageDimensions(dimensions);

  cover.image = {
    data: file.buffer,
    mimeType: file.mimetype as 'image/jpeg' | 'image/png',
  };
  return cover;
}
