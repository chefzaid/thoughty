/** Server limit for one attachment. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const STORED_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};
const CONVERTIBLE_PHOTOS = new Set(['heic', 'heif', 'tif', 'tiff']);

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** How a file from an export can become an attachment, or null when it cannot (videos, unknown types). */
export function attachmentTypeFor(name: string): { mimetype: string; convert: boolean } | null {
  const extension = fileExtension(name);
  if (STORED_TYPES[extension]) {
    return { mimetype: STORED_TYPES[extension], convert: false };
  }
  return CONVERTIBLE_PHOTOS.has(extension) ? { mimetype: 'image/jpeg', convert: true } : null;
}

/** IDs the import endpoint accepts; anything else becomes `_`. */
export function cleanSourceId(id: string): string {
  return id.replaceAll(/[^A-Za-z0-9._:-]/g, '_').slice(0, 100);
}

export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const names = tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().slice(0, 50))
    .filter(Boolean);
  return [...new Set(names)].slice(0, 20);
}

/** The calendar day of `timestamp` where it was written, falling back to the browser's zone. */
export function localDate(timestamp: number, timeZone?: string): string {
  const format = (zone?: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(timestamp);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  try {
    return format(timeZone || undefined);
  } catch {
    return format();
  }
}
