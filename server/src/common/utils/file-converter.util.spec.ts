import {
  validateFormatConfig,
  formatDate,
  parseDate,
  generateTextFile,
  parseTextFile,
  findDuplicates,
  DEFAULT_FORMAT,
} from './file-converter.util';

describe('file-converter.util', () => {
  describe('validateFormatConfig', () => {
    it('should return default config when no config provided', () => {
      const result = validateFormatConfig();

      expect(result).toEqual(DEFAULT_FORMAT);
    });

    it('should return default config when empty config provided', () => {
      const result = validateFormatConfig({});

      expect(result).toEqual(DEFAULT_FORMAT);
    });

    it('should merge partial config with defaults', () => {
      const result = validateFormatConfig({
        entrySeparator: '====',
        dateFormat: 'DD-MM-YYYY',
      });

      expect(result.entrySeparator).toBe('====');
      expect(result.dateFormat).toBe('DD-MM-YYYY');
      expect(result.sameDaySeparator).toBe(DEFAULT_FORMAT.sameDaySeparator);
      expect(result.tagOpenBracket).toBe(DEFAULT_FORMAT.tagOpenBracket);
    });

    it('should allow empty string for prefix and suffix', () => {
      const result = validateFormatConfig({
        datePrefix: '',
        dateSuffix: '',
      });

      expect(result.datePrefix).toBe('');
      expect(result.dateSuffix).toBe('');
    });

    it('should use default for empty entrySeparator', () => {
      const result = validateFormatConfig({
        entrySeparator: '',
      });

      expect(result.entrySeparator).toBe(DEFAULT_FORMAT.entrySeparator);
    });
  });

  describe('formatDate', () => {
    it('should format date with YYYY-MM-DD format', () => {
      const result = formatDate('2024-01-15', 'YYYY-MM-DD');

      expect(result).toBe('2024-01-15');
    });

    it('should format date with DD/MM/YYYY format', () => {
      const result = formatDate('2024-01-15', 'DD/MM/YYYY');

      expect(result).toBe('15/01/2024');
    });

    it('should format date with MM-DD-YYYY format', () => {
      const result = formatDate('2024-01-15', 'MM-DD-YYYY');

      expect(result).toBe('01-15-2024');
    });

    it('should handle Date object input', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = formatDate(date, 'YYYY-MM-DD');

      expect(result).toContain('2024');
    });
  });

  describe('parseDate', () => {
    it('should parse YYYY-MM-DD format', () => {
      const result = parseDate('2024-01-15', 'YYYY-MM-DD');

      expect(result).toBe('2024-01-15');
    });

    it('should parse DD/MM/YYYY format', () => {
      const result = parseDate('15/01/2024', 'DD/MM/YYYY');

      expect(result).toBe('2024-01-15');
    });

    it('should parse MM-DD-YYYY format', () => {
      const result = parseDate('01-15-2024', 'MM-DD-YYYY');

      expect(result).toBe('2024-01-15');
    });
  });

  describe('generateTextFile', () => {
    it('should generate empty string for empty entries', () => {
      const result = generateTextFile([]);

      expect(result).toBe('');
    });

    it('should generate text file with single entry', () => {
      const entries = [
        {
          date: '2024-01-15',
          index: 1,
          tags: ['happy', 'productive'],
          content: 'Test entry content',
        },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('2024-01-15');
      expect(result).toContain('[happy,productive]');
      expect(result).toContain('Test entry content');
      expect(result).toContain(DEFAULT_FORMAT.entrySeparator);
    });

    it('should generate text file with multiple entries on different dates', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Entry 1' },
        { date: '2024-01-16', index: 1, tags: ['tag2'], content: 'Entry 2' },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('2024-01-15');
      expect(result).toContain('2024-01-16');
      expect(result).toContain('Entry 1');
      expect(result).toContain('Entry 2');
    });

    it('should generate text file with multiple entries on same date', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Entry 1' },
        { date: '2024-01-15', index: 2, tags: ['tag2'], content: 'Entry 2' },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain(DEFAULT_FORMAT.sameDaySeparator);
      expect(result).toContain('Entry 1');
      expect(result).toContain('Entry 2');
    });

    it('should sort entries by date ascending then by index', () => {
      const entries = [
        { date: '2024-01-16', index: 1, tags: [], content: 'Later' },
        { date: '2024-01-15', index: 2, tags: [], content: 'Second' },
        { date: '2024-01-15', index: 1, tags: [], content: 'First' },
      ];

      const result = generateTextFile(entries);
      const firstIndex = result.indexOf('First');
      const secondIndex = result.indexOf('Second');
      const laterIndex = result.indexOf('Later');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(laterIndex);
    });

    it('should use custom format config', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test' },
      ];

      const result = generateTextFile(entries, {
        entrySeparator: '====',
        tagOpenBracket: '(',
        tagCloseBracket: ')',
        tagSeparator: ' | ',
      });

      expect(result).toContain('====');
      expect(result).toContain('(tag1)');
    });

    it('should handle entries with Date objects', () => {
      const entries = [
        {
          date: new Date('2024-01-15') as any,
          index: 1,
          tags: ['tag1'],
          content: 'Test',
        },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('2024-01-15');
    });

    it('should handle entries with empty tags', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Test' },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('[]');
    });

    it('should handle entries with null content', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: null as any },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('2024-01-15');
    });
  });

  describe('parseTextFile', () => {
    it('should return empty array for empty content', () => {
      const result = parseTextFile('');

      expect(result).toEqual([]);
    });

    it('should parse single entry', () => {
      const content = `
---2024-01-15--[happy,productive]
Test entry content

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].tags).toEqual(['happy', 'productive']);
      expect(result[0].content).toBe('Test entry content');
    });

    it('should parse multiple entries on different dates', () => {
      const content = `
---2024-01-15--[tag1]
Entry 1

--------------------------------------------------------------------------------

---2024-01-16--[tag2]
Entry 2

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[1].date).toBe('2024-01-16');
    });

    it('should parse multiple entries on same date', () => {
      const content = `
---2024-01-15--[tag1]
Entry 1

********************************************************************************

---2--[tag2]
Entry 2

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].index).toBe(1);
      expect(result[1].date).toBe('2024-01-15');
      expect(result[1].index).toBe(2);
    });

    it('should handle Windows line endings', () => {
      const content = "---2024-01-15--[tag1]\r\nEntry content\r\n--------------------------------------------------------------------------------\r\n";

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Entry content');
    });

    it('should handle Mac line endings', () => {
      const content = "---2024-01-15--[tag1]\rEntry content\r--------------------------------------------------------------------------------\r";

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
    });

    it('should parse empty tags', () => {
      const content = `
---2024-01-15--[]
Entry with no tags

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result[0].tags).toEqual([]);
    });

    it('should trim tag whitespace', () => {
      const content = `
---2024-01-15--[ happy , productive ]
Entry content

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result[0].tags).toEqual(['happy', 'productive']);
    });

    it('should use custom format config', () => {
      const content = `
###2024-01-15##(tag1|tag2)
Custom format entry

====
`;

      const result = parseTextFile(content, {
        datePrefix: '###',
        dateSuffix: '##',
        tagOpenBracket: '(',
        tagCloseBracket: ')',
        tagSeparator: '|',
        entrySeparator: '====',
      });

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['tag1', 'tag2']);
    });

    it('should skip entries with empty content', () => {
      const content = `
---2024-01-15--[tag1]


--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(0);
    });

    it('should preserve multiline content', () => {
      const content = `
---2024-01-15--[tag1]
Line 1
Line 2
Line 3

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result[0].content).toContain('Line 1');
      expect(result[0].content).toContain('Line 2');
      expect(result[0].content).toContain('Line 3');
    });
  });

  describe('findDuplicates', () => {
    it('should return empty array when no duplicates', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'New entry' },
      ];
      const existing = [
        { date: '2024-01-16', index: 1, tags: [], content: 'Old entry' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(0);
    });

    it('should find duplicate by date and content', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content' },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
      expect(result[0].imported).toBe(imported[0]);
      expect(result[0].existing).toBe(existing[0]);
    });

    it('should not match entries with same date but different content', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'New content' },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Different content' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(0);
    });

    it('should not match entries with same content but different date', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content' },
      ];
      const existing = [
        { date: '2024-01-16', index: 1, tags: [], content: 'Same content' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(0);
    });

    it('should handle Date objects in existing entries', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content' },
      ];
      const existing = [
        { date: new Date('2024-01-15') as any, index: 1, tags: [], content: 'Same content' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
    });

    it('should trim content for comparison', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: '  Same content  ' },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
    });

    it('should find multiple duplicates', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Entry 1' },
        { date: '2024-01-16', index: 1, tags: [], content: 'Entry 2' },
        { date: '2024-01-17', index: 1, tags: [], content: 'New entry' },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Entry 1' },
        { date: '2024-01-16', index: 1, tags: [], content: 'Entry 2' },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(2);
    });

    it('should handle empty content', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: '' },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: null as any },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
    });
  });
});
