/**
 * Inline images: a Markdown entry places one of its attachments in its text as
 * `![alt text](attachment:42)`, 42 being the attachment's ID (never its storage key). The server
 * keeps only references to the entry's own attachments; see docs/features.md. A picture picked but
 * not uploaded yet waits as `![alt text](attachment:<URL-encoded file name>)` until the entry is
 * saved, when it is uploaded and its reference takes the new ID.
 */
const ATTACHMENT_SCHEME = 'attachment:';
const ATTACHMENT_ID = /^[1-9]\d{0,9}$/;
const INLINE_IMAGE = /!\[((?:\\.|[^\\\]\n])*)\]\(attachment:([^\s)]+)\)/g;

/** The attachment ID an image source names, or null for any other source. */
export function attachmentIdOf(source: string | null | undefined): number | null {
  if (!source?.startsWith(ATTACHMENT_SCHEME)) {
    return null;
  }
  const id = source.slice(ATTACHMENT_SCHEME.length);
  return ATTACHMENT_ID.test(id) ? Number(id) : null;
}

/** The IDs of the attachments the text places. */
export function placedAttachmentIds(content: string): Set<number> {
  return new Set([...content.matchAll(INLINE_IMAGE)].flatMap((match) => (ATTACHMENT_ID.test(match[2] ?? '') ? [Number(match[2])] : [])));
}

/** The reference placing an attachment, or a file still to upload, with its alt text escaped and on one line. */
export function inlineImageMarkdown(target: number | string, alt: string): string {
  const escaped = alt.replaceAll(/\s+/g, ' ').trim().replaceAll(/([\\[\]])/g, String.raw`\$1`);
  const destination = typeof target === 'number' ? String(target) : encodeURIComponent(target);
  return `![${escaped}](${ATTACHMENT_SCHEME}${destination})`;
}

function decodedName(target: string): string | null {
  if (ATTACHMENT_ID.test(target)) return null;
  try {
    return decodeURIComponent(target);
  } catch {
    return null;
  }
}

/**
 * Uploads the picked files the text places (the first of each name), and points their references at
 * the stored attachments. Returns the text to save and the files left to upload after it, as before.
 * A file that fails to upload keeps its reference, which the server turns into its alt text.
 */
export async function storePlacedFiles(
  text: string,
  files: readonly File[],
  upload: (file: File) => Promise<{ readonly id: number } | null>,
): Promise<{ text: string; remaining: File[] }> {
  const names = new Set([...text.matchAll(INLINE_IMAGE)].flatMap((match) => {
    const name = decodedName(match[2] ?? '');
    return name === null ? [] : [name];
  }));
  const stored = new Map<string, number>();
  const remaining: File[] = [];
  for (const file of files) {
    if (!names.has(file.name) || stored.has(file.name)) {
      remaining.push(file);
      continue;
    }
    const attachment = await upload(file);
    if (attachment) stored.set(file.name, attachment.id);
  }
  if (stored.size === 0) return { text, remaining };

  const placed = text.replaceAll(INLINE_IMAGE, (raw: string, alt: string, target: string) => {
    const name = decodedName(target);
    const id = name === null ? undefined : stored.get(name);
    return id === undefined ? raw : `![${alt}](${ATTACHMENT_SCHEME}${id})`;
  });
  return { text: placed, remaining };
}

/** The text with `snippet` in place of the selected range, and where the caret goes after it. */
export function insertAtSelection(
  text: string,
  selection: { readonly start: number; readonly end: number },
  snippet: string,
): { text: string; caret: number } {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  return { text: `${text.slice(0, start)}${snippet}${text.slice(end)}`, caret: start + snippet.length };
}

/**
 * React Markdown drops sources outside a short list of protocols; inline images keep theirs, so the
 * renderer can show the attachment. Everything else goes through the library's own check.
 */
export function keepAttachmentSources(url: string, defaultTransform: (url: string) => string): string {
  return attachmentIdOf(url) === null ? defaultTransform(url) : url;
}
