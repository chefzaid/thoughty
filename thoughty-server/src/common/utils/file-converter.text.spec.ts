import {
  DEFAULT_FORMAT,
  findDuplicates,
  generateTextFile,
  parseTextFile,
} from './file-converter.util';
import { createEntry } from './file-converter.test-helpers';

describe('file-converter.util text formats', () => {
  describe('generateTextFile', () => {
    it('returns an empty string for no entries', () => {
      expect(generateTextFile([])).toBe('');
    });

    it('sorts entries and includes same-day separators and diary metadata', () => {
      const result = generateTextFile([
        createEntry({ date: '2024-01-16', tags: ['later'], content: 'Later' }),
        createEntry({ index: 2, tags: ['second'], content: 'Second' }),
        createEntry({ tags: ['first'], content: 'First', diaryName: 'Work' }),
      ]);

      expect(result).toContain('2024-01-15');
      expect(result).toContain('2024-01-16');
      expect(result).toContain(DEFAULT_FORMAT.sameDaySeparator);
      expect(result).toContain('--{diary:Work}');
      expect(result.indexOf('First')).toBeLessThan(result.indexOf('Second'));
      expect(result.indexOf('Second')).toBeLessThan(result.indexOf('Later'));
    });

    it('supports custom delimiters', () => {
      const result = generateTextFile(
        [createEntry({ tags: ['tag1'], content: 'Custom format entry' })],
        {
          entrySeparator: '====',
          tagOpenBracket: '(',
          tagCloseBracket: ')',
          tagSeparator: ' | ',
        },
      );

      expect(result).toContain('====');
      expect(result).toContain('(tag1)');
    });

    it('handles markdown flags, empty tags, Date objects, and null content', () => {
      const result = generateTextFile([
        {
          ...createEntry({ tags: [], content: '# Heading', format: 'markdown' }),
          date: new Date('2024-01-15') as any,
        },
        {
          ...createEntry({ date: '2024-01-16', tags: ['tag2'] }),
          content: null as any,
        },
      ]);

      expect(result).toContain('2024-01-15');
      expect(result).toContain('2024-01-16');
      expect(result).toContain('[]');
      expect(result).toContain('{md}');
    });

    it('writes visibility markers only when requested and defaults missing visibility to private', () => {
      const publicEntry = [createEntry({ visibility: 'public' })];
      const privateDefault = [createEntry()];

      expect(generateTextFile(publicEntry, undefined, true)).toContain('--[public]');
      expect(generateTextFile(publicEntry, undefined, false)).not.toContain('--[public]');
      expect(generateTextFile(privateDefault, undefined, true)).toContain('--[private]');
    });
  });

  describe('parseTextFile', () => {
    it('returns an empty array for empty content', () => {
      expect(parseTextFile('')).toEqual([]);
    });

    it('parses dated and same-day entries with trimmed tags and metadata', () => {
      const content = `
    ---2024-01-15--[ happy , productive ]--[public]--{diary:Work}{md}
# Heading
Line 2

********************************************************************************

---2--[tag2]--{diary:Personal}
Second plain entry

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        date: '2024-01-15',
        index: 1,
        tags: ['happy', 'productive'],
        visibility: 'public',
        format: 'markdown',
        diaryName: 'Work',
      });
      expect(result[0].content).toContain('Line 2');
      expect(result[1]).toMatchObject({
        date: '2024-01-15',
        index: 2,
        tags: ['tag2'],
        format: 'plain',
        diaryName: 'Personal',
      });
      expect(result[1].visibility).toBeUndefined();
    });

    it.each([
      [
        'Windows',
        '---2024-01-15--[tag1]\r\nEntry content\r\n--------------------------------------------------------------------------------\r\n',
      ],
      [
        'Mac',
        '---2024-01-15--[tag1]\rEntry content\r--------------------------------------------------------------------------------\r',
      ],
    ])('parses %s line endings', (_label, content) => {
      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Entry content');
    });

    it('supports custom delimiters', () => {
      const result = parseTextFile(
        `
###2024-01-15##(tag1|tag2)
Custom format entry

====
`,
        {
          datePrefix: '###',
          dateSuffix: '##',
          tagOpenBracket: '(',
          tagCloseBracket: ')',
          tagSeparator: '|',
          entrySeparator: '====',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['tag1', 'tag2']);
    });

    it('preserves multiline content and skips empty entries', () => {
      const content = `
---2024-01-15--[tag1]


--------------------------------------------------------------------------------

---2024-01-16--[tag2]
Line 1
Line 2
Line 3

--------------------------------------------------------------------------------
`;

      const result = parseTextFile(content);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-16');
      expect(result[0].content).toContain('Line 1');
      expect(result[0].content).toContain('Line 2');
      expect(result[0].content).toContain('Line 3');
    });
  });

  describe('text roundtrips', () => {
    it('roundtrips markdown, visibility, and diary metadata', () => {
      const exported = generateTextFile(
        [
          createEntry({
            tags: ['journal'],
            content: '# My Day\n\nIt was **great**!',
            format: 'markdown',
            visibility: 'public',
            diaryName: 'Work',
          }),
          createEntry({
            date: '2024-01-16',
            tags: ['note'],
            content: 'Just a plain note',
            visibility: 'private',
          }),
        ],
        undefined,
        true,
      );

      const imported = parseTextFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0]).toMatchObject({
        format: 'markdown',
        visibility: 'public',
        diaryName: 'Work',
      });
      expect(imported[0].content).toContain('# My Day');
      expect(imported[1]).toMatchObject({
        format: 'plain',
        visibility: 'private',
      });
      expect(imported[1].content).toContain('Just a plain note');
    });
  });

  describe('findDuplicates', () => {
    it.each([
      [
        'no duplicates when dates differ',
        [createEntry({ content: 'Same content' })],
        [createEntry({ date: '2024-01-16', content: 'Same content' })],
        0,
      ],
      [
        'matches on date and content',
        [createEntry({ content: 'Same content' })],
        [createEntry({ content: 'Same content' })],
        1,
      ],
      [
        'does not match different content',
        [createEntry({ content: 'New content' })],
        [createEntry({ content: 'Different content' })],
        0,
      ],
      [
        'matches trimmed content',
        [createEntry({ content: '  Same content  ' })],
        [createEntry({ content: 'Same content' })],
        1,
      ],
    ])('%s', (_label, imported, existing, expectedCount) => {
      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(expectedCount);
    });

    it('matches Date objects in existing entries', () => {
      const result = findDuplicates(
        [createEntry({ content: 'Same content' })],
        [{ ...createEntry({ content: 'Same content' }), date: new Date('2024-01-15') as any }] as any,
      );

      expect(result).toHaveLength(1);
    });

    it('matches empty and null content', () => {
      const result = findDuplicates(
        [createEntry({ content: '' })],
        [{ ...createEntry(), content: null as any }] as any,
      );

      expect(result).toHaveLength(1);
    });

    it('finds multiple duplicates and returns the original entry references', () => {
      const imported = [
        createEntry({ content: 'Entry 1' }),
        createEntry({ date: '2024-01-16', content: 'Entry 2' }),
        createEntry({ date: '2024-01-17', content: 'New entry' }),
      ];
      const existing = [
        createEntry({ content: 'Entry 1' }),
        createEntry({ date: '2024-01-16', content: 'Entry 2' }),
      ];

      const result = findDuplicates(imported, existing);

      expect(result).toHaveLength(2);
      expect(result[0].imported).toBe(imported[0]);
      expect(result[0].existing).toBe(existing[0]);
      expect(result[1].imported).toBe(imported[1]);
      expect(result[1].existing).toBe(existing[1]);
    });
  });
});