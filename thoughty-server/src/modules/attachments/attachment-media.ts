/**
 * What the attachment routes accept and how large it may be. Videos have their own, larger limit and
 * are checked by their bytes, not by the type the browser declares; every other type keeps the 5 MB
 * limit. A video's poster frame is a small JPEG the browser draws from the video.
 */

export const VIDEO_MIMETYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export type VideoMimeType = (typeof VIDEO_MIMETYPES)[number];

export const ALLOWED_MIMETYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  ...VIDEO_MIMETYPES,
];

/** Types a browser may render inline; anything else (SVG, text) is served as a download. */
export const INLINE_MIMETYPES: ReadonlySet<string> = new Set(
  ALLOWED_MIMETYPES.filter((type) => type !== 'image/svg+xml' && type !== 'text/plain'),
);

const MIB = 1024 * 1024;
/** Images, audio, PDF and text. */
export const MAX_FILE_SIZE = 5 * MIB;
/** A video, about a minute of 1080p phone video; the upload route takes no more than this. */
export const MAX_VIDEO_SIZE = 50 * MIB;
/** A poster frame, drawn at most 960 pixels wide by the browser, is far smaller. */
export const MAX_POSTER_SIZE = 1 * MIB;
/** Largest width or height of a poster frame. */
export const MAX_POSTER_DIMENSION = 4096;
/** Bytes read from the start of a file to recognize a video. */
export const VIDEO_SIGNATURE_BYTES = 64;

export function isVideoMimetype(mimetype: string): mimetype is VideoMimeType {
  return (VIDEO_MIMETYPES as readonly string[]).includes(mimetype);
}

export function maxSizeFor(mimetype: string): number {
  return isVideoMimetype(mimetype) ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
}

/** ISO base media brands of MP4 video; HEIF and AVIF pictures (`heic`, `mif1`, `avif`…) and M4A audio share the format. */
const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4VH', 'M4VP', 'MSNV', 'dash', 'mmp4',
]);
/** First atoms of a QuickTime movie written before `ftyp` existed. */
const LEGACY_QUICKTIME_ATOMS = new Set(['moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/**
 * The video type of a file from its first bytes, or null when they are not an MP4, QuickTime or
 * WebM video: an MP4-family `ftyp` brand, QuickTime's `qt  ` brand or a legacy first atom, or an
 * EBML header whose document type is `webm` (other Matroska files do not play in browsers).
 */
export function detectVideoType(head: Buffer): VideoMimeType | null {
  if (head.length >= 12) {
    const atom = head.subarray(4, 8).toString('latin1');
    if (atom === 'ftyp') {
      const brand = head.subarray(8, 12).toString('latin1');
      if (brand === 'qt  ') {
        return 'video/quicktime';
      }
      return MP4_BRANDS.has(brand) ? 'video/mp4' : null;
    }
    if (LEGACY_QUICKTIME_ATOMS.has(atom)) {
      return 'video/quicktime';
    }
  }
  if (head.length >= 8 && head.subarray(0, 4).equals(EBML_MAGIC)) {
    // The DocType element (0x4282) holds the document type within the first few dozen bytes
    const docType = head.indexOf(Buffer.from([0x42, 0x82]), 4);
    if (docType >= 0 && head.subarray(docType + 3, docType + 7).toString('latin1') === 'webm') {
      return 'video/webm';
    }
  }
  return null;
}

/** A stored file a reader may be served: an attachment's file or a video's poster frame. */
export interface StoredAttachmentFile {
  key: string;
  contentType: string;
  originalFilename: string;
  inline: boolean;
  /** Bytes, as recorded at upload. */
  size: number;
}

/** A poster frame is named after its video, as a JPEG. */
function posterName(originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.');
  return `${dot > 0 ? originalFilename.slice(0, dot) : originalFilename}-poster.jpg`;
}

/**
 * How to serve one of an attachment's stored files: its poster frame (always a JPEG) when `key` is the
 * poster's, else the file itself, typed from the attachment row (limited to the upload allowlist), not
 * from storage, and inline only for types a browser cannot run script from.
 */
export function describeStoredFile(
  attachment: { storedFilename: string; posterFilename: string | null; posterSize: number | null; originalFilename: string; mimetype: string; size: number },
  key: string,
): StoredAttachmentFile {
  if (attachment.posterFilename === key) {
    return {
      key,
      contentType: 'image/jpeg',
      originalFilename: posterName(attachment.originalFilename),
      inline: true,
      size: attachment.posterSize ?? 0,
    };
  }
  const contentType = ALLOWED_MIMETYPES.includes(attachment.mimetype) ? attachment.mimetype : 'application/octet-stream';
  return {
    key,
    contentType,
    originalFilename: attachment.originalFilename,
    inline: INLINE_MIMETYPES.has(contentType),
    size: attachment.size,
  };
}

/** The storage keys of attachments: each file, and a video's poster frame when it has one. */
export function storedKeysOf(
  attachments: ReadonlyArray<{ storedFilename: string; posterFilename?: string | null }>,
): string[] {
  return attachments.flatMap((attachment) =>
    attachment.posterFilename ? [attachment.storedFilename, attachment.posterFilename] : [attachment.storedFilename],
  );
}
