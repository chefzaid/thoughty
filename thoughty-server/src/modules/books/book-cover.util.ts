import { BadRequestException } from '@nestjs/common';
import type { BookCover } from '@/common/utils/book-cover-style.util';
import type { BookQueryDto } from './dto';
import {
  hasPassiveImageSignature,
  imageDimensionsAreBounded,
  readPassiveImageDimensions,
} from '@/common/utils/image-validation.util';

export const MAX_BOOK_COVER_IMAGE_SIZE = 2 * 1024 * 1024;

const MAX_COVER_DIMENSION = 6000;
const MAX_COVER_PIXELS = 25_000_000;
const COVER_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
function validateImage(data: Buffer, mimeType: 'image/jpeg' | 'image/png'): void {
  const dimensions = readPassiveImageDimensions(data, mimeType);
  if (
    !hasPassiveImageSignature(data, mimeType) ||
    !imageDimensionsAreBounded(
      dimensions,
      MAX_COVER_DIMENSION,
      MAX_COVER_PIXELS,
    )
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

  validateImage(file.buffer, file.mimetype as 'image/jpeg' | 'image/png');

  cover.image = {
    data: file.buffer,
    mimeType: file.mimetype as 'image/jpeg' | 'image/png',
  };
  return cover;
}
