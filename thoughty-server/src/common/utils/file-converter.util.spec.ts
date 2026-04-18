import {
  validateFormatConfig,
  formatDate,
  parseDate,
  generateTextFile,
  parseTextFile,
  generateJsonFile,
  parseJsonFile,
  generateMarkdownFile,
  parseMarkdownFile,
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

    it('should include diary name when provided', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test', diaryName: 'Work' },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('--{diary:Work}');
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

    it('should parse entry with markdown format flag', () => {
      const content = `
---2024-01-15--[tag1]{md}
# Markdown heading

Some **bold** text

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].format).toBe('markdown');
      expect(result[0].content).toContain('# Markdown heading');
    });

    it('should parse entry without format flag as plain', () => {
      const content = `
---2024-01-15--[tag1]
Plain text entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].format).toBe('plain');
    });

    it('should parse same-day markdown entries with format flag', () => {
      const content = `
---2024-01-15--[tag1]{md}
# First markdown entry

********************************************************************************

---2--[tag2]
Second plain entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(2);
      expect(result[0].format).toBe('markdown');
      expect(result[1].format).toBe('plain');
    });

    it('should parse same-day entry with index and format flag', () => {
      const content = `
---2024-01-15--[tag1]
First plain entry

********************************************************************************

---2--[tag2]{md}
Second **markdown** entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(2);
      expect(result[0].format).toBe('plain');
      expect(result[1].format).toBe('markdown');
    });

    it('should parse diary name from dated entries', () => {
      const content = `
---2024-01-15--[tag1]--{diary:Work}
Diary entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].diaryName).toBe('Work');
    });

    it('should parse diary name from same-day entries', () => {
      const content = `
---2024-01-15--[tag1]
First entry

********************************************************************************

---2--[tag2]--{diary:Personal}
Second entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(2);
      expect(result[1].diaryName).toBe('Personal');
    });
  });

  describe('generateTextFile with markdown format', () => {
    it('should include {md} flag for markdown entries', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: '# Heading', format: 'markdown' as const },
      ];

      const result = generateTextFile(entries);

      expect(result).toContain('{md}');
      expect(result).toContain('# Heading');
    });

    it('should not include {md} flag for plain entries', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Plain text' },
      ];

      const result = generateTextFile(entries);

      expect(result).not.toContain('{md}');
    });

    it('should handle mixed plain and markdown entries', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Plain text' },
        { date: '2024-01-16', index: 1, tags: ['tag2'], content: '# Markdown', format: 'markdown' as const },
      ];

      const result = generateTextFile(entries);

      // Check that {md} appears only for the markdown entry
      const lines = result.split('\n');
      const plainLine = lines.find(l => l.includes('2024-01-15'));
      const mdLine = lines.find(l => l.includes('2024-01-16'));

      expect(plainLine).not.toContain('{md}');
      expect(mdLine).toContain('{md}');
    });

    it('should roundtrip markdown entries through export and import', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['journal'], content: '# My Day\n\nIt was **great**!', format: 'markdown' as const },
        { date: '2024-01-16', index: 1, tags: ['note'], content: 'Just a plain note' },
      ];

      const exported = generateTextFile(entries);
      const imported = parseTextFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0].format).toBe('markdown');
      expect(imported[0].content).toContain('# My Day');
      expect(imported[1].format).toBe('plain');
      expect(imported[1].content).toContain('Just a plain note');
    });
  });

  describe('generateTextFile with visibility', () => {
    it('should include visibility marker when includeVisibility is true', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test', visibility: 'public' as const },
      ];

      const result = generateTextFile(entries, undefined, true);

      expect(result).toContain('--[public]');
    });

    it('should not include visibility marker when includeVisibility is false', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test', visibility: 'public' as const },
      ];

      const result = generateTextFile(entries, undefined, false);

      expect(result).not.toContain('--[public]');
    });

    it('should default visibility to private when not specified', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test' },
      ];

      const result = generateTextFile(entries, undefined, true);

      expect(result).toContain('--[private]');
    });

    it('should roundtrip visibility through export and import', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['journal'], content: 'Public entry', visibility: 'public' as const },
        { date: '2024-01-16', index: 1, tags: ['note'], content: 'Private entry', visibility: 'private' as const },
      ];

      const exported = generateTextFile(entries, undefined, true);
      const imported = parseTextFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0].visibility).toBe('public');
      expect(imported[1].visibility).toBe('private');
    });
  });

  describe('parseTextFile with visibility', () => {
    it('should parse visibility marker from entry header', () => {
      const content = `
---2024-01-15--[tag1]--[public]
Public entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('public');
    });

    it('should handle entry without visibility marker', () => {
      const content = `
---2024-01-15--[tag1]
No visibility entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBeUndefined();
    });

    it('should parse visibility with markdown format flag', () => {
      const content = `
---2024-01-15--[tag1]--[private]{md}
# Markdown with visibility

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('private');
      expect(result[0].format).toBe('markdown');
    });
  });

  describe('findDuplicates', () => {
    it('should return empty array when no duplicates', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'New entry', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-16', index: 1, tags: [], content: 'Old entry', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(0);
    });

    it('should find duplicate by date and content', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
      expect(result[0].imported).toBe(imported[0]);
      expect(result[0].existing).toBe(existing[0]);
    });

    it('should not match entries with same date but different content', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'New content', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Different content', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(0);
    });

    it('should not match entries with same content but different date', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-16', index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(0);
    });

    it('should handle Date objects in existing entries', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];
      const existing = [
        { date: new Date('2024-01-15') as any, index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
    });

    it('should trim content for comparison', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: '  Same content  ', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Same content', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
    });

    it('should find multiple duplicates', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Entry 1', format: 'plain' as const },
        { date: '2024-01-16', index: 1, tags: [], content: 'Entry 2', format: 'plain' as const },
        { date: '2024-01-17', index: 1, tags: [], content: 'New entry', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Entry 1', format: 'plain' as const },
        { date: '2024-01-16', index: 1, tags: [], content: 'Entry 2', format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(2);
    });

    it('should handle empty content', () => {
      const imported = [
        { date: '2024-01-15', index: 1, tags: [], content: '', format: 'plain' as const },
      ];
      const existing = [
        { date: '2024-01-15', index: 1, tags: [], content: null as any, format: 'plain' as const },
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(1);
    });
  });

  describe('generateJsonFile', () => {
    it('should generate empty JSON for empty entries', () => {
      const result = generateJsonFile([]);
      const parsed = JSON.parse(result);
      expect(parsed.entries).toEqual([]);
    });

    it('should generate valid JSON with entries', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['happy'], content: 'Test entry', format: 'plain' as const },
      ];

      const result = generateJsonFile(entries);
      const parsed = JSON.parse(result);

      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].date).toBe('2024-01-15');
      expect(parsed.entries[0].tags).toEqual(['happy']);
      expect(parsed.entries[0].content).toBe('Test entry');
      expect(parsed.entries[0].format).toBe('plain');
    });

    it('should include visibility when requested', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Test', visibility: 'public' as const },
      ];

      const result = generateJsonFile(entries, true);
      const parsed = JSON.parse(result);

      expect(parsed.entries[0].visibility).toBe('public');
    });

    it('should not include visibility by default', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Test', visibility: 'public' as const },
      ];

      const result = generateJsonFile(entries);
      const parsed = JSON.parse(result);

      expect(parsed.entries[0].visibility).toBeUndefined();
    });

    it('should sort entries by date then index', () => {
      const entries = [
        { date: '2024-01-16', index: 1, tags: [], content: 'Later' },
        { date: '2024-01-15', index: 1, tags: [], content: 'Earlier' },
      ];

      const result = generateJsonFile(entries);
      const parsed = JSON.parse(result);

      expect(parsed.entries[0].date).toBe('2024-01-15');
      expect(parsed.entries[1].date).toBe('2024-01-16');
    });

    it('should include diary name when provided', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Diary entry', diaryName: 'Work' },
      ];

      const result = generateJsonFile(entries);
      const parsed = JSON.parse(result);

      expect(parsed.entries[0].diary).toBe('Work');
    });
  });

  describe('parseJsonFile', () => {
    it('should parse JSON with entries array', () => {
      const json = JSON.stringify({
        entries: [
          { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test entry' },
        ],
      });

      const result = parseJsonFile(json);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].tags).toEqual(['tag1']);
      expect(result[0].content).toBe('Test entry');
    });

    it('should parse plain JSON array', () => {
      const json = JSON.stringify([
        { date: '2024-01-15', index: 1, tags: [], content: 'Test' },
      ]);

      const result = parseJsonFile(json);
      expect(result).toHaveLength(1);
    });

    it('should parse visibility from JSON', () => {
      const json = JSON.stringify({
        entries: [
          { date: '2024-01-15', index: 1, tags: [], content: 'Test', visibility: 'public' },
        ],
      });

      const result = parseJsonFile(json);
      expect(result[0].visibility).toBe('public');
    });

    it('should skip entries without content', () => {
      const json = JSON.stringify({
        entries: [
          { date: '2024-01-15', index: 1, tags: [], content: '' },
          { date: '2024-01-15', index: 2, tags: [], content: 'Valid' },
        ],
      });

      const result = parseJsonFile(json);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Valid');
    });

    it('should return empty for invalid structure', () => {
      const result = parseJsonFile('{"noEntries": true}');
      expect(result).toEqual([]);
    });

    it('should roundtrip through JSON export/import', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['journal'], content: 'Day one', format: 'markdown' as const, visibility: 'public' as const },
        { date: '2024-01-16', index: 1, tags: ['note'], content: 'Day two', visibility: 'private' as const },
      ];

      const exported = generateJsonFile(entries, true);
      const imported = parseJsonFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0].content).toBe('Day one');
      expect(imported[0].format).toBe('markdown');
      expect(imported[0].visibility).toBe('public');
      expect(imported[1].visibility).toBe('private');
    });

    it('should parse diary name from JSON', () => {
      const json = JSON.stringify({
        entries: [
          { date: '2024-01-15', index: 1, tags: [], content: 'Test', diary: 'Work' },
        ],
      });

      const result = parseJsonFile(json);

      expect(result[0].diaryName).toBe('Work');
    });
  });

  describe('generateMarkdownFile', () => {
    it('should generate markdown with date headings', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['happy'], content: 'Test entry' },
      ];

      const result = generateMarkdownFile(entries);

      expect(result).toContain('# 2024-01-15');
      expect(result).toContain('`happy`');
      expect(result).toContain('Test entry');
    });

    it('should separate same-day entries with ---', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Entry 1' },
        { date: '2024-01-15', index: 2, tags: [], content: 'Entry 2' },
      ];

      const result = generateMarkdownFile(entries);

      expect(result).toContain('---');
      expect(result).toContain('Entry 1');
      expect(result).toContain('Entry 2');
    });

    it('should include visibility when requested', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Test', visibility: 'public' as const },
      ];

      const result = generateMarkdownFile(entries, true);

      expect(result).toContain('**Visibility:** public');
    });

    it('should not include visibility by default', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Test', visibility: 'public' as const },
      ];

      const result = generateMarkdownFile(entries);

      expect(result).not.toContain('Visibility');
    });

    it('should include diary name when provided', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: [], content: 'Test', diaryName: 'Work' },
      ];

      const result = generateMarkdownFile(entries);

      expect(result).toContain('**Diary:** Work');
    });
  });

  describe('parseMarkdownFile', () => {
    it('should parse markdown with date headings', () => {
      const content = `# 2024-01-15

**Tags:** \`happy\`, \`productive\`

Test entry content`;

      const result = parseMarkdownFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].tags).toEqual(['happy', 'productive']);
      expect(result[0].content).toBe('Test entry content');
      expect(result[0].format).toBe('markdown');
    });

    it('should parse multiple entries on different dates', () => {
      const content = `# 2024-01-15

Entry 1

# 2024-01-16

Entry 2`;

      const result = parseMarkdownFile(content);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[1].date).toBe('2024-01-16');
    });

    it('should parse same-day entries separated by ---', () => {
      const content = `# 2024-01-15

Entry 1

---

Entry 2`;

      const result = parseMarkdownFile(content);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[0].index).toBe(1);
      expect(result[1].date).toBe('2024-01-15');
      expect(result[1].index).toBe(2);
    });

    it('should parse visibility metadata', () => {
      const content = `# 2024-01-15

**Tags:** \`tag1\` | **Visibility:** public

Public entry`;

      const result = parseMarkdownFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].visibility).toBe('public');
      expect(result[0].tags).toEqual(['tag1']);
    });

    it('should skip entries with empty content', () => {
      const content = `# 2024-01-15


# 2024-01-16

Valid entry`;

      const result = parseMarkdownFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-16');
    });

    it('should roundtrip through markdown export/import', () => {
      const entries = [
        { date: '2024-01-15', index: 1, tags: ['journal'], content: 'Day one' },
        { date: '2024-01-16', index: 1, tags: ['note'], content: 'Day two' },
      ];

      const exported = generateMarkdownFile(entries);
      const imported = parseMarkdownFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0].content).toBe('Day one');
      expect(imported[0].tags).toEqual(['journal']);
      expect(imported[1].content).toBe('Day two');
    });

    it('should parse diary metadata', () => {
      const content = `# 2024-01-15

**Tags:** \`tag1\` | **Diary:** Work

Entry content`;

      const result = parseMarkdownFile(content);

      expect(result[0].diaryName).toBe('Work');
    });
  });
});
