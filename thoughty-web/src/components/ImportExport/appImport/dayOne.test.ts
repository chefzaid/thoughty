import { describe, expect, it } from 'vitest';

import type { ZipEntry } from '../../../utils/zipReader';
import { cleanDayOneText, isDayOneJournal, parseDayOneJournal, splitDayOneTitle, unescapeDayOneMarkdown } from './dayOne';

const zipEntry = (name: string): ZipEntry => ({ name, size: 10, compressedSize: 10, method: 0, encrypted: false, localHeaderOffset: 0 });

describe('unescapeDayOneMarkdown', () => {
  it('drops escapes that change nothing', () => {
    expect(unescapeDayOneMarkdown(String.raw`We met at 6\.30 \(again\)\! Well\-known \+ fun \#travel`))
      .toBe('We met at 6.30 (again)! Well-known + fun #travel');
  });

  it('keeps escapes that stop lists, headings, images, and links', () => {
    const text = [String.raw`1\. Not a list`, String.raw`\- not a bullet`, String.raw`  \+ nor this`, String.raw`\# not a heading`, String.raw`\![not an image]`, String.raw`[text]\(not a link)`].join('\n');

    expect(unescapeDayOneMarkdown(text)).toBe(
      [String.raw`1\. Not a list`, String.raw`\- not a bullet`, String.raw`  \+ nor this`, String.raw`\# not a heading`, String.raw`\![not an image]`, String.raw`[text]\(not a link)`].join('\n'),
    );
  });

  it('leaves emphasis escapes alone', () => {
    expect(unescapeDayOneMarkdown(String.raw`a \*b\* \_c\_`)).toBe(String.raw`a \*b\* \_c\_`);
  });
});

describe('cleanDayOneText', () => {
  it('removes inline photo and recording references and the gaps they leave', () => {
    expect(cleanDayOneText('Beach day\n\n![](dayone-moment://F1A2)\n\n\n![](dayone-moment:/audio/AB12)  \nSwam twice\\.'))
      .toBe('Beach day\n\nSwam twice.');
  });
});

describe('cleanDayOneText with inline photos', () => {
  it('keeps each photo the import sends where the text places it, and removes the other references', () => {
    const photos = new Map([['f1a2', '5F2B.jpeg'], ['c3d4', 'aa11.jpg']]);
    expect(cleanDayOneText('Beach\n\n![](dayone-moment://F1A2)\n\n![The \\(bay\\)](dayone-moment://c3d4) ![](dayone-moment:/video/F1A2) ![](dayone-moment://gone)', photos))
      .toBe('Beach\n\n![](attachment:5F2B.jpeg)\n\n![The (bay)](attachment:aa11.jpg)');
  });
});

describe('splitDayOneTitle', () => {
  it('takes a first-line heading as the title', () => {
    expect(splitDayOneTitle('# Trip to Lyon \\#2 ##\n\nTrain at 8.')).toEqual({ title: 'Trip to Lyon #2', content: 'Train at 8.' });
    expect(splitDayOneTitle('### Short')).toEqual({ title: 'Short', content: '' });
  });

  it('keeps text without a leading heading whole', () => {
    expect(splitDayOneTitle('Plain start\n# Later heading')).toEqual({ content: 'Plain start\n# Later heading' });
    expect(splitDayOneTitle('#hashtag start')).toEqual({ content: '#hashtag start' });
  });
});

describe('isDayOneJournal', () => {
  it('recognizes Day One journals', () => {
    expect(isDayOneJournal({ metadata: { version: '1.0' }, entries: [] })).toBe(true);
    expect(isDayOneJournal({ entries: [{ creationDate: '2021-03-01T18:24:11Z' }] })).toBe(true);
    expect(isDayOneJournal({ entries: [{ date: 'x' }] })).toBe(false);
    expect(isDayOneJournal([{ creationDate: 'x' }])).toBe(false);
    expect(isDayOneJournal(null)).toBe(false);
  });
});

describe('parseDayOneJournal', () => {
  const files = new Map([
    ['photos/5f2b', zipEntry('Export/photos/5f2b.jpeg')],
    ['photos/aa11', zipEntry('Export/photos/aa11.heic')],
    ['audios/77cc', zipEntry('Export/audios/77cc.m4a')],
    ['videos/99dd', zipEntry('Export/videos/99dd.mov')],
  ]);
  const lookup = (folder: string, md5: string) => files.get(`${folder}/${md5}`);

  it('maps entries, local dates, tags, stars, and media', () => {
    const { entries, skippedMedia } = parseDayOneJournal(
      {
        entries: [
          {
            uuid: '4F5E6A',
            creationDate: '2021-03-01T23:30:00Z',
            timeZone: 'Europe/Paris',
            text: 'Late night in Paris\\.\n\n![](dayone-moment://F1A2)',
            tags: ['travel', 'travel', ' night ', 7],
            starred: true,
            photos: [{ md5: '5F2B', type: 'jpeg' }, { md5: 'aa11', type: 'heic' }, { md5: 'missing', type: 'jpeg' }],
            audios: [{ md5: '77cc', format: 'm4a' }],
            videos: [{ md5: '99dd', type: 'mov' }],
          },
        ],
      },
      'Travel',
      lookup,
    );

    expect(entries).toEqual([
      {
        sourceId: '4F5E6A',
        date: '2021-03-02',
        timeOfDay: '00:30',
        timestamp: Date.parse('2021-03-01T23:30:00Z'),
        content: 'Late night in Paris.',
        tags: ['travel', 'night'],
        favorite: true,
        journal: 'Travel',
        media: [
          { name: '5F2B.jpeg', mimetype: 'image/jpeg', convert: false, file: files.get('photos/5f2b') },
          { name: 'aa11.heic', mimetype: 'image/jpeg', convert: true, file: files.get('photos/aa11') },
          { name: '77cc.m4a', mimetype: 'audio/mp4', convert: false, file: files.get('audios/77cc') },
          { name: '99dd.mov', mimetype: 'video/quicktime', convert: false, file: files.get('videos/99dd') },
        ],
      },
    ]);
    expect(skippedMedia).toBe(1);
  });

  it('places inline photos by the name their file is stored under', () => {
    const { entries } = parseDayOneJournal(
      {
        entries: [{
          uuid: 'P',
          creationDate: '2022-06-01T07:05:00Z',
          timeZone: 'UTC',
          text: 'Morning\n\n![](dayone-moment://ID-1)\n\n![](dayone-moment://ID-2)',
          photos: [{ identifier: 'ID-1', md5: '5F2B', type: 'jpeg' }, { identifier: 'ID-2', md5: 'aa11', type: 'heic' }],
          audios: [{ identifier: 'ID-3', md5: '77cc', format: 'm4a' }],
        }],
      },
      'Journal',
      lookup,
    );

    expect(entries[0]!.content).toBe('Morning\n\n![](attachment:5F2B.jpeg)\n\n![](attachment:aa11.jpg)');
  });

  it('maps titles from the title field or a first-line heading, and the local time', () => {
    const { entries } = parseDayOneJournal(
      {
        entries: [
          { uuid: 'A', creationDate: '2022-06-01T07:05:00Z', timeZone: 'UTC', title: '  Morning   pages ', text: '# Not taken\n\nBody' },
          { uuid: 'B', creationDate: '2022-06-01T18:40:00Z', timeZone: 'UTC', text: '# Evening walk\n\nAlong the river\\.' },
          { uuid: 'C', creationDate: '2022-06-01T20:00:00Z', timeZone: 'UTC', text: 'No heading here' },
        ],
      },
      'Journal',
      lookup,
    );

    expect(entries.map(({ title, timeOfDay, content }) => ({ title, timeOfDay, content }))).toEqual([
      { title: 'Morning pages', timeOfDay: '07:05', content: '# Not taken\n\nBody' },
      { title: 'Evening walk', timeOfDay: '18:40', content: 'Along the river.' },
      { title: undefined, timeOfDay: '20:00', content: 'No heading here' },
    ]);
    expect(entries[2]).not.toHaveProperty('title');
  });

  it('skips entries without a usable date and falls back to the date for a missing ID', () => {
    const { entries } = parseDayOneJournal(
      { entries: [{ creationDate: 'not a date' }, { creationDate: '2020-01-01T10:00:00Z', timeZone: 'Mars/Olympus' }] },
      'Journal',
      lookup,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(expect.objectContaining({ sourceId: '2020-01-01T10:00:00Z', content: '', tags: [], favorite: false, media: [] }));
    expect(entries[0]!.date).toMatch(/^20(19-12-31|20-01-01)$/);
  });
});
