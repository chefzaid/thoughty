import {
  generateCsvFile,
  generateJsonFile,
  generateMarkdownFile,
  parseJsonFile,
  parseMarkdownFile,
} from './file-converter.util';
import { createEntry } from './file-converter.test-helpers';

describe('file-converter.util structured formats', () => {
  describe('CSV', () => {
    it('generates headers, diary metadata, and per-entry reading metrics', () => {
      const exported = generateCsvFile([
        createEntry({
          tags: ['journal', 'work'],
          content: 'First entry with five words',
          visibility: 'public',
          diaryName: 'Work',
        }),
      ], true);

      expect(exported).toContain('date,index,diary,tags,visibility,format,word_count,reading_time_minutes,content');
      expect(exported).toContain('2024-01-15,1,Work,journal;work,public,plain,5,1,First entry with five words');
    });

    it('escapes commas, quotes, and newlines for spreadsheet imports', () => {
      const exported = generateCsvFile([
        createEntry({
          diaryName: 'Personal, Archive',
          content: 'Line one\n"Line two"',
        }),
      ]);

      expect(exported).toContain('"Personal, Archive"');
      expect(exported).toContain('"Line one\n""Line two"""');
    });
  });

  describe('JSON', () => {
    it('generates empty payloads for no entries', () => {
      const parsed = JSON.parse(generateJsonFile([]));

      expect(parsed.entries).toEqual([]);
    });

    it('generates ordered JSON and preserves format, visibility, and diary metadata', () => {
      const parsed = JSON.parse(
        generateJsonFile(
          [
            createEntry({ date: '2024-01-16', content: 'Later' }),
            createEntry({
              tags: ['happy'],
              content: 'First',
              format: 'markdown',
              visibility: 'public',
              diaryName: 'Work',
            }),
          ],
          true,
        ),
      );

      expect(parsed.entries[0]).toMatchObject({
        date: '2024-01-15',
        tags: ['happy'],
        content: 'First',
        format: 'markdown',
        visibility: 'public',
        diary: 'Work',
      });
      expect(parsed.entries[1].date).toBe('2024-01-16');
    });

    it.each([
      [
        'entries wrapper',
        JSON.stringify({
          entries: [
            { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'Test entry' },
          ],
        }),
      ],
      [
        'plain array',
        JSON.stringify([{ date: '2024-01-15', index: 1, tags: [], content: 'Test' }]),
      ],
    ])('parses %s JSON payloads', (_label, json) => {
      const result = parseJsonFile(json);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
    });

    it('parses visibility and diary metadata and skips empty or invalid entries', () => {
      const result = parseJsonFile(
        JSON.stringify({
          entries: [
            {
              date: '2024-01-15',
              index: 1,
              tags: [],
              content: 'Test',
              visibility: 'public',
              diary: 'Work',
            },
            { date: '2024-01-15', index: 2, tags: [], content: '' },
          ],
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        visibility: 'public',
        diaryName: 'Work',
      });
      expect(parseJsonFile('{"noEntries":true}')).toEqual([]);
    });

    it('roundtrips exported JSON with markdown and visibility intact', () => {
      const exported = generateJsonFile(
        [
          createEntry({ tags: ['journal'], content: 'Day one', format: 'markdown', visibility: 'public' }),
          createEntry({ date: '2024-01-16', tags: ['note'], content: 'Day two', visibility: 'private' }),
        ],
        true,
      );

      const imported = parseJsonFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0]).toMatchObject({ format: 'markdown', visibility: 'public' });
      expect(imported[1]).toMatchObject({ format: 'plain', visibility: 'private' });
    });
  });

  describe('Markdown', () => {
    it('generates headings, same-day separators, and optional metadata', () => {
      const withVisibility = generateMarkdownFile(
        [
          createEntry({ tags: ['happy'], content: 'Entry 1', visibility: 'public', diaryName: 'Work' }),
          createEntry({ index: 2, content: 'Entry 2' }),
        ],
        true,
      );

      expect(withVisibility).toContain('# 2024-01-15');
      expect(withVisibility).toContain('---');
      expect(withVisibility).toContain('**Visibility:** public');
      expect(withVisibility).toContain('**Diary:** Work');
      expect(generateMarkdownFile([createEntry({ visibility: 'public' })])).not.toContain(
        'Visibility',
      );
    });

    it('parses dated sections and same-day separators', () => {
      const content = `# 2024-01-15

**Tags:** \`happy\`, \`productive\`

Entry 1

---

Entry 2

# 2024-01-16

Entry 3`;

      const result = parseMarkdownFile(content);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ date: '2024-01-15', index: 1, format: 'markdown' });
      expect(result[0].tags).toEqual(['happy', 'productive']);
      expect(result[1]).toMatchObject({ date: '2024-01-15', index: 2 });
      expect(result[2]).toMatchObject({ date: '2024-01-16', index: 1 });
    });

    it('parses visibility and diary metadata', () => {
      const visibilityResult = parseMarkdownFile(`# 2024-01-15

**Tags:** \`tag1\` | **Visibility:** public

Public entry`);
      const diaryResult = parseMarkdownFile(`# 2024-01-15

**Tags:** \`tag1\` | **Diary:** Work

Entry content`);

      expect(visibilityResult[0]).toMatchObject({ visibility: 'public' });
      expect(visibilityResult[0].tags).toEqual(['tag1']);
      expect(diaryResult[0]).toMatchObject({ diaryName: 'Work' });
    });

    it('skips empty markdown entries', () => {
      const result = parseMarkdownFile(`# 2024-01-15


# 2024-01-16

Valid entry`);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-16');
    });

    it('roundtrips markdown export/import', () => {
      const exported = generateMarkdownFile([
        createEntry({ tags: ['journal'], content: 'Day one' }),
        createEntry({ date: '2024-01-16', tags: ['note'], content: 'Day two' }),
      ]);

      const imported = parseMarkdownFile(exported);

      expect(imported).toHaveLength(2);
      expect(imported[0].content).toBe('Day one');
      expect(imported[0].tags).toEqual(['journal']);
      expect(imported[1].content).toBe('Day two');
    });
  });
});
