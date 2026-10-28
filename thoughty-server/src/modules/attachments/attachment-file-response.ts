import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { apiError } from '@/common/errors';
import { parseByteRange, type ByteRange } from '@/common/utils';
import type { StoredAttachmentFile } from './attachment-media';
import type { OpenedAttachmentFile } from './attachments.service';

/** `416 Range Not Satisfiable`, which Nest has no exception class for. */
export class RangeNotSatisfiableException extends HttpException {
  constructor(objectOrError?: object) {
    super(
      objectOrError ?? { statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, message: 'Range Not Satisfiable' },
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
    );
  }
}

/** Builds a Content-Disposition header whose filename cannot break out of the header value. */
export function contentDisposition(inline: boolean, originalFilename: string): string {
  const fallback = originalFilename.replace(/[^\w.\- ]/g, '_').slice(0, 150) || 'attachment';
  const encoded = encodeURIComponent(originalFilename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Streams a stored attachment file, whole or the single `Range: bytes=` range a video player asks for
 * when it seeks, with its type, disposition and the headers that keep a browser from running it.
 * `notFound` is what a file missing from storage answers.
 */
export async function sendAttachmentFile(
  res: Response,
  file: StoredAttachmentFile,
  rangeHeader: string | undefined,
  open: (key: string, range?: ByteRange) => Promise<OpenedAttachmentFile>,
  notFound: () => HttpException,
): Promise<void> {
  const range = parseByteRange(rangeHeader, file.size);
  res.setHeader('Accept-Ranges', 'bytes');
  if (range === 'unsatisfiable') {
    res.setHeader('Content-Range', `bytes */${file.size}`);
    throw apiError(RangeNotSatisfiableException, 'ATTACHMENT_RANGE_NOT_SATISFIABLE');
  }

  let opened: OpenedAttachmentFile;
  try {
    opened = await open(file.key, range ?? undefined);
  } catch {
    throw notFound();
  }

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', contentDisposition(file.inline, file.originalFilename));
  if (!file.inline) {
    // Types such as SVG can carry script; never let one run if it is opened directly.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  }
  if (range) {
    res.status(HttpStatus.PARTIAL_CONTENT);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else if (opened.contentLength !== undefined) {
    res.setHeader('Content-Length', String(opened.contentLength));
  }
  opened.stream.on('error', () => res.destroy());
  opened.stream.pipe(res);
}
