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
          timeOfDay: '07:45',
          title: 'Early start, again',
        }),
        createEntry({ date: '2024-01-16', content: 'No title or time' }),
      ], true);

      expect(exported).toContain('date,index,time,title,mood,feelings,diary,tags,visibility,format,word_count,reading_time_minutes,content');
      expect(exported).toContain('2024-01-15,1,07:45,"Early start, again",,,Work,journal;work,public,plain,5,1,First entry with five words');
      expect(exported).toContain('2024-01-16,1,,,,,,,private,plain,4,1,No title or time');
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

  describe('moods and feelings', () => {
    it('roundtrips the mood and feelings through JSON, leaving them out of entries without them', () => {
      const exported = generateJsonFile([
        createEntry({ content: 'Good day', mood: 4, feelings: ['calm', 'grateful'] }),
        createEntry({ index: 2, content: 'No check-in' }),
      ]);

      expect(JSON.parse(exported).entries[0]).toMatchObject({ mood: 4, feelings: ['calm', 'grateful'] });
      expect(JSON.parse(exported).entries[1]).not.toHaveProperty('mood');
      expect(JSON.parse(exported).entries[1]).not.toHaveProperty('feelings');
      const imported = parseJsonFile(exported);
      expect(imported[0]).toMatchObject({ mood: 4, feelings: ['calm', 'grateful'] });
      expect(imported[1].mood).toBeUndefined();
      expect(imported[1].feelings).toBeUndefined();
    });

    it('ignores moods off the scale and cleans feelings in JSON', () => {
      const [entry, other] = parseJsonFile(JSON.stringify([
        { date: '2024-01-15', content: 'Text', mood: 7, feelings: ['  Tired ', 'tired', ''] },
        { date: '2024-01-16', content: 'Text', mood: '2', feelings: 'sad, lonely' },
      ]));

      expect(entry.mood).toBeUndefined();
      expect(entry.feelings).toEqual(['tired']);
      expect(other).toMatchObject({ mood: 2, feelings: ['sad', 'lonely'] });
    });

    it('writes the mood and feelings in the Markdown metadata line and reads them back', () => {
      const exported = generateMarkdownFile([
        createEntry({ tags: ['walks'], content: 'By the river', title: 'Rain', mood: 5, feelings: ['joyful', 'free spirited'] }),
        createEntry({ index: 2, content: 'Second', feelings: ['tired'] }),
      ]);

      expect(exported).toContain('**Title:** Rain | **Mood:** 5/5 | **Feelings:** joyful, free spirited | **Tags:** `walks`');
      expect(exported).toContain('**Feelings:** tired\n\nSecond');
      const imported = parseMarkdownFile(exported);
      expect(imported[0]).toMatchObject({ title: 'Rain', mood: 5, feelings: ['joyful', 'free spirited'], tags: ['walks'], content: 'By the river' });
      expect(imported[1]).toMatchObject({ feelings: ['tired'], content: 'Second' });
      expect(imported[1].mood).toBeUndefined();
    });

    it('keeps a Markdown line with a mood off the scale as text', () => {
      const [entry] = parseMarkdownFile('# 2024-01-15\n\n**Mood:** great\n\nText');

      expect(entry.mood).toBeUndefined();
      expect(entry.content).toBe('**Mood:** great\n\nText');
    });

    it('adds mood and feelings columns to CSV exports', () => {
      const exported = generateCsvFile([
        createEntry({ content: 'Checked in', mood: 3, feelings: ['calm', 'tired'] }),
        createEntry({ date: '2024-01-16', content: 'Not checked in' }),
      ]);

      expect(exported).toContain('date,index,time,title,mood,feelings,diary,tags,format,word_count,reading_time_minutes,content');
      expect(exported).toContain('2024-01-15,1,,,3,calm;tired,,,plain,2,1,Checked in');
      expect(exported).toContain('2024-01-16,1,,,,,,,plain,3,1,Not checked in');
    });
  });

  describe('titles and times', () => {
    it('roundtrips titles and times through JSON, leaving them out of entries without them', () => {
      const exported = generateJsonFile([
        createEntry({ content: 'Morning', title: 'Sunrise run', timeOfDay: '06:05' }),
        createEntry({ index: 2, content: 'Untitled' }),
      ]);

      expect(JSON.parse(exported).entries[0]).toMatchObject({ time: '06:05', title: 'Sunrise run' });
      expect(JSON.parse(exported).entries[1]).not.toHaveProperty('title');
      expect(JSON.parse(exported).entries[1]).not.toHaveProperty('time');
      const imported = parseJsonFile(exported);
      expect(imported[0]).toMatchObject({ title: 'Sunrise run', timeOfDay: '06:05' });
      expect(imported[1].title).toBeUndefined();
      expect(imported[1].timeOfDay).toBeUndefined();
    });

    it('ignores blank titles and invalid times in JSON', () => {
      const [entry] = parseJsonFile(JSON.stringify([{ date: '2024-01-15', content: 'Text', title: '  ', time: '25:00' }]));

      expect(entry.title).toBeUndefined();
      expect(entry.timeOfDay).toBeUndefined();
    });

    it('writes time and title first in the Markdown metadata line and reads them back', () => {
      const exported = generateMarkdownFile([
        createEntry({ tags: ['walks'], content: 'By the river', title: 'Rain | then sun', timeOfDay: '18:40', diaryName: 'Work' }),
        createEntry({ index: 2, content: 'Second' }),
      ]);

      expect(exported).toContain('**Time:** 18:40 | **Title:** Rain | then sun | **Tags:** `walks` | **Diary:** Work');
      const imported = parseMarkdownFile(exported);
      expect(imported[0]).toMatchObject({
        title: 'Rain | then sun',
        timeOfDay: '18:40',
        tags: ['walks'],
        diaryName: 'Work',
        content: 'By the river',
      });
      expect(imported[1]).toMatchObject({ content: 'Second' });
      expect(imported[1].title).toBeUndefined();
    });

    it('keeps a Markdown line that only looks like metadata as text', () => {
      const [entry] = parseMarkdownFile('# 2024-01-15\n\n**Time:** after lunch\n\nText');

      expect(entry.timeOfDay).toBeUndefined();
      expect(entry.content).toBe('**Time:** after lunch\n\nText');
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
