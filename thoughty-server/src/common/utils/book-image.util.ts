import {
  hasPassiveImageSignature,
  imageDimensionsAreBounded,
  readPassiveImageDimensions,
} from './image-validation.util';

export const EMBEDDED_BOOK_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type EmbeddedBookImageType = (typeof EMBEDDED_BOOK_IMAGE_TYPES)[number];

export interface EmbeddedBookImage {
  id: number;
  name: string;
  storedFilename: string;
  mimeType: EmbeddedBookImageType;
  size: number;
  data?: Buffer;
}

interface AttachmentInput {
  id: number;
  originalFilename: string;
  storedFilename: string;
  mimetype: string;
  size: number;
}

export function normalizeEmbeddedBookImages(
  attachments?: AttachmentInput[],
): EmbeddedBookImage[] {
  return (attachments ?? [])
    .filter((attachment) =>
      EMBEDDED_BOOK_IMAGE_TYPES.includes(
        attachment.mimetype as EmbeddedBookImageType,
      ),
    )
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.originalFilename,
      storedFilename: attachment.storedFilename,
      mimeType: attachment.mimetype as EmbeddedBookImageType,
      size: attachment.size,
    }));
}

export function bookImageDataUri(image: EmbeddedBookImage): string | undefined {
  return image.data
    ? `data:${image.mimeType};base64,${image.data.toString('base64')}`
    : undefined;
}

export function bookImageExtension(image: EmbeddedBookImage): string {
  switch (image.mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    default:
      return 'webp';
  }
}

export function escapeBookImageMarkdownText(text: string): string {
  return text.replaceAll(/([\\`*_[\]{}()#+\-.!<>])/g, '\\$1');
}

export function isSafeEmbeddedBookImage(
  image: EmbeddedBookImage,
  data: Buffer,
): boolean {
  if (!hasPassiveImageSignature(data, image.mimeType)) {
    return false;
  }
  if (image.mimeType === 'image/gif' || image.mimeType === 'image/webp') {
    return true;
  }
  return imageDimensionsAreBounded(
    readPassiveImageDimensions(data, image.mimeType),
    6000,
    25_000_000,
  );
}
