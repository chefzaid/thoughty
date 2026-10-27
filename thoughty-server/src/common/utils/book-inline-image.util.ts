import { bookImageDataUri, type EmbeddedBookImage } from './book-image.util';
import type { BookEntry } from './book-model.util';
import { replaceInlineImages, splitInlineImages, type InlineContentSegment } from './inline-image.util';

export type BookEntrySegment = InlineContentSegment<EmbeddedBookImage>;

/** An entry as a book prints it: its text with the images it places, then the images it does not. */
export interface BookEntryLayout {
  readonly segments: BookEntrySegment[];
  /** Images with data that the text does not place, shown after it as before. */
  readonly trailing: EmbeddedBookImage[];
}

function embeddedImagesById(entry: BookEntry): Map<number, EmbeddedBookImage> {
  return new Map((entry.images ?? []).filter((image) => image.data).map((image) => [image.id, image]));
}

/**
 * Cuts a Markdown entry's text around the inline images the book embeds. An inline image the book
 * has no data for (embedding off, over the size budget, deleted, not one of the entry's images)
 * leaves its alt text. Plain-text entries keep their text whole.
 */
export function layoutBookEntry(entry: BookEntry): BookEntryLayout {
  const images = embeddedImagesById(entry);
  if (entry.format !== 'markdown') {
    return { segments: [{ type: 'text', text: entry.content }], trailing: [...images.values()] };
  }

  const segments = splitInlineImages(entry.content, (reference) =>
    reference.id === null ? undefined : images.get(reference.id),
  );
  const placed = new Set(segments.flatMap((segment) => (segment.type === 'image' ? [segment.image.id] : [])));
  return { segments, trailing: [...images.values()].filter((image) => !placed.has(image.id)) };
}

/** What an inline image is captioned with: its alt text, or its file name when it has none. */
export function inlineImageCaption(segment: Extract<BookEntrySegment, { type: 'image' }>): string {
  return segment.alt.trim() || segment.image.name;
}

/** A Markdown entry's text for a Markdown book: embedded inline images as data URIs, the others as alt text. */
export function bookEntryMarkdown(entry: BookEntry): BookEntryLayout & { content: string } {
  const layout = layoutBookEntry(entry);
  if (entry.format !== 'markdown') {
    return { ...layout, content: entry.content };
  }
  const images = embeddedImagesById(entry);
  const content = replaceInlineImages(entry.content, (reference) => {
    const image = reference.id === null ? undefined : images.get(reference.id);
    const source = image ? bookImageDataUri(image) : undefined;
    return source ? `![${reference.alt}](${source})` : reference.alt;
  });
  return { ...layout, content };
}
