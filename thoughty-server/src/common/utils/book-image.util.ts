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
  return text.replaceAll(/([\\`*_[\]{}()#+\-.!<>])/g, String.raw`\$1`);
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

/** Budgets for the images a book or document embeds: 5 MB each and 25 MB in all. */
export const MAX_EMBEDDED_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_EMBEDDED_IMAGES_TOTAL = 25 * 1024 * 1024;
const IMAGE_FETCH_BATCH_SIZE = 4;

/** Reads a stored file, failing past `maxBytes`. */
export type BookImageReader = (storedFilename: string, maxBytes: number) => Promise<Buffer>;

interface ImageBook {
  chapters: Array<{ entries: Array<{ images?: EmbeddedBookImage[] }> }>;
}

function uniqueBookImages(book: ImageBook): EmbeddedBookImage[] {
  const unique = new Map<number, EmbeddedBookImage>();
  for (const chapter of book.chapters) {
    for (const entry of chapter.entries) {
      for (const image of entry.images ?? []) {
        unique.set(image.id, image);
      }
    }
  }
  return [...unique.values()];
}

/**
 * Loads the data of the book's images, in order, within the size budgets. An image over a budget,
 * unavailable in storage, or whose bytes are not the passive image they claim to be keeps no data,
 * and the renderers leave it out (an inline one leaves its alt text).
 */
export async function hydrateBookImages(
  book: ImageBook,
  read: BookImageReader,
  logger?: { warn(message: string): void },
): Promise<void> {
  const candidates: EmbeddedBookImage[] = [];
  let reservedBytes = 0;
  for (const image of uniqueBookImages(book)) {
    if (image.size <= 0 || image.size > MAX_EMBEDDED_IMAGE_SIZE || reservedBytes + image.size > MAX_EMBEDDED_IMAGES_TOTAL) {
      continue;
    }
    candidates.push(image);
    reservedBytes += image.size;
  }

  const dataById = new Map<number, Buffer>();
  let embeddedBytes = 0;
  for (let index = 0; index < candidates.length; index += IMAGE_FETCH_BATCH_SIZE) {
    const batch = candidates.slice(index, index + IMAGE_FETCH_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((image) => read(image.storedFilename, MAX_EMBEDDED_IMAGE_SIZE)));
    results.forEach((result, resultIndex) => {
      const image = batch[resultIndex];
      if (
        result.status === 'fulfilled' &&
        isSafeEmbeddedBookImage(image, result.value) &&
        embeddedBytes + result.value.length <= MAX_EMBEDDED_IMAGES_TOTAL
      ) {
        dataById.set(image.id, result.value);
        embeddedBytes += result.value.length;
      } else if (result.status === 'rejected') {
        logger?.warn(`Skipping unavailable book image attachment ${image.id}`);
      }
    });
  }

  for (const chapter of book.chapters) {
    for (const entry of chapter.entries) {
      for (const image of entry.images ?? []) {
        image.data = dataById.get(image.id);
      }
    }
  }
}
