/**
 * Inline images: a Markdown entry places one of its own attachments in its text as
 * `![alt text](attachment:42)`, where 42 is the attachment's ID (never its storage key). While an app
 * import is still sending an entry's photos, a photo waits in the text as `attachment:<file name>`
 * (URL-encoded) and becomes `attachment:<id>` once that file is stored on the entry.
 */
const INLINE_IMAGE = /!\[((?:\\.|[^\\\]\n])*)\]\(attachment:([^\s)]+)\)/g;
const ATTACHMENT_ID = /^[1-9]\d{0,9}$/;

export interface InlineImageReference {
  /** The whole reference as written. */
  readonly raw: string;
  /** The alt text as written in Markdown, with its escapes. */
  readonly alt: string;
  /** The attachment's ID, or null when the reference names a file instead. */
  readonly id: number | null;
  /** The file an app import has yet to send, or null. */
  readonly fileName: string | null;
}

function parseReference(raw: string, alt: string, target: string): InlineImageReference {
  if (ATTACHMENT_ID.test(target)) {
    return { raw, alt, id: Number(target), fileName: null };
  }
  let fileName: string | null;
  try {
    fileName = decodeURIComponent(target);
  } catch {
    fileName = null;
  }
  return { raw, alt, id: null, fileName };
}

/** Writes each inline image as `replace` returns it; the rest of the text stays as it is. */
export function replaceInlineImages(content: string, replace: (reference: InlineImageReference) => string): string {
  return content.replaceAll(INLINE_IMAGE, (raw: string, alt: string, target: string) =>
    replace(parseReference(raw, alt, target)),
  );
}

/** Every inline image of the text, in order. */
export function findInlineImages(content: string): InlineImageReference[] {
  return [...content.matchAll(INLINE_IMAGE)].map((match) => parseReference(match[0], match[1], match[2]));
}

/** The attachment IDs the text places, each once. */
export function inlineImageIds(content: string): number[] {
  return [...new Set(findInlineImages(content).flatMap((reference) => (reference.id === null ? [] : [reference.id])))];
}

/** Alt text without its Markdown escapes, for plain text. */
export function unescapeInlineImageAlt(alt: string): string {
  return alt.replaceAll(/\\(.)/g, '$1');
}

/** Alt text as Markdown can hold it inside `![…]`, on one line. */
export function escapeInlineImageAlt(alt: string): string {
  return alt.replaceAll(/\s+/g, ' ').trim().replaceAll(/([\\[\]])/g, String.raw`\$1`);
}

/** The reference that places the attachment, or the file an app import will send, in the text. */
export function inlineImageMarkdown(target: number | string, alt: string): string {
  const destination = typeof target === 'number' ? String(target) : encodeURIComponent(target);
  return `![${escapeInlineImageAlt(alt)}](attachment:${destination})`;
}

/**
 * Each inline image replaced by its alt text, still escaped for Markdown: what readers who cannot
 * see the attachment (the public feed, AI prompts) get instead.
 */
export function inlineImagesToAltText(content: string): string {
  return replaceInlineImages(content, (reference) => reference.alt);
}

export type InlineContentSegment<TImage> =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly image: TImage; readonly alt: string };

/**
 * The text cut around the inline images `resolve` finds, for documents that embed them where they
 * stand. An image `resolve` does not find (deleted, too large, or not an image) leaves its alt text.
 * Alt text comes without its Markdown escapes; neighbouring text is merged.
 */
export function splitInlineImages<TImage>(
  content: string,
  resolve: (reference: InlineImageReference) => TImage | undefined,
): InlineContentSegment<TImage>[] {
  const segments: InlineContentSegment<TImage>[] = [];
  const pushText = (text: string): void => {
    const last = segments.at(-1);
    if (last?.type === 'text') {
      segments[segments.length - 1] = { type: 'text', text: last.text + text };
    } else if (text) {
      segments.push({ type: 'text', text });
    }
  };

  let at = 0;
  for (const match of content.matchAll(INLINE_IMAGE)) {
    const reference = parseReference(match[0], match[1], match[2]);
    pushText(content.slice(at, match.index));
    const image = resolve(reference);
    const alt = unescapeInlineImageAlt(reference.alt);
    if (image === undefined) {
      pushText(alt);
    } else {
      segments.push({ type: 'image', image, alt });
    }
    at = match.index + match[0].length;
  }
  pushText(content.slice(at));
  return segments;
}
