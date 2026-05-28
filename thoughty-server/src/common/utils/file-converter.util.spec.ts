import {
  DEFAULT_FORMAT,
  formatDate,
  parseDate,
  validateFormatConfig,
} from './file-converter.util';

describe('file-converter.util', () => {
  describe('validateFormatConfig', () => {
    it.each([undefined, {}])('returns defaults for %p', (config) => {
      expect(validateFormatConfig(config as Parameters<typeof validateFormatConfig>[0])).toEqual(
        DEFAULT_FORMAT,
      );
    });

    it('merges partial config with defaults', () => {
      const result = validateFormatConfig({
        entrySeparator: '====',
        dateFormat: 'DD-MM-YYYY',
      });

      expect(result.entrySeparator).toBe('====');
      expect(result.dateFormat).toBe('DD-MM-YYYY');
      expect(result.sameDaySeparator).toBe(DEFAULT_FORMAT.sameDaySeparator);
      expect(result.tagOpenBracket).toBe(DEFAULT_FORMAT.tagOpenBracket);
    });

    it('allows empty prefix and suffix while restoring empty separators', () => {
      const result = validateFormatConfig({
        datePrefix: '',
        dateSuffix: '',
        entrySeparator: '',
      });

      expect(result.datePrefix).toBe('');
      expect(result.dateSuffix).toBe('');
      expect(result.entrySeparator).toBe(DEFAULT_FORMAT.entrySeparator);
    });
  });

  describe.each([
    ['YYYY-MM-DD', '2024-01-15', '2024-01-15'],
    ['DD/MM/YYYY', '2024-01-15', '15/01/2024'],
    ['MM-DD-YYYY', '2024-01-15', '01-15-2024'],
  ] as const)('date conversion for %s', (pattern, isoDate, formattedDate) => {
    it('formats supported date patterns', () => {
      expect(formatDate(isoDate, pattern)).toBe(formattedDate);
    });

    it('parses supported date patterns', () => {
      expect(parseDate(formattedDate, pattern)).toBe(isoDate);
    });
  });

  it('formats Date object input', () => {
    expect(formatDate(new Date('2024-01-15T00:00:00Z'), 'YYYY-MM-DD')).toContain('2024');
  });
});
