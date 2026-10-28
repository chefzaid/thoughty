import { describe, expect, it } from 'vitest';
import { formatFileSize } from './fileSize';

describe('formatFileSize', () => {
  it('writes bytes, then kilobytes and megabytes with one decimal', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024 + 100_000)).toBe('5.1 MB');
  });
});
