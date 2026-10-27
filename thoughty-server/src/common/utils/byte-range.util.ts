/** The bytes `start` to `end` of a file, both included. */
export interface ByteRange {
  start: number;
  end: number;
}

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

/**
 * Reads a `Range` header (RFC 9110 §14) for a file of `size` bytes. Answers the range to send, null
 * to send the whole file (no header, another unit, several ranges or a malformed one, which a server
 * may ignore), or `'unsatisfiable'` when the range starts past the end, for a `416` answer.
 */
export function parseByteRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  const match = header ? SINGLE_RANGE.exec(header.trim()) : null;
  if (!match) {
    return null;
  }
  const [, first = '', last = ''] = match;
  if (first === '' && last === '') {
    return null;
  }
  if (first === '') {
    // A suffix: the last N bytes
    const length = Number(last);
    return length === 0 || size === 0 ? 'unsatisfiable' : { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(first);
  if (last !== '' && Number(last) < start) {
    return null;
  }
  if (start >= size) {
    return 'unsatisfiable';
  }
  return { start, end: last === '' ? size - 1 : Math.min(Number(last), size - 1) };
}
