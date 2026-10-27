import { describe, expect, it } from 'vitest';

import type { ZipEntry } from '../../../utils/zipReader';
import { htmlToMarkdown, looksLikeHtml } from './htmlToMarkdown';
import { isJourneyEntry, journeyMood, parseJourneyEntry } from './journey';

const zipEntry = (name: string): ZipEntry => ({ name, size: 10, compressedSize: 10, method: 0, encrypted: false, localHeaderOffset: 0 });

describe('htmlToMarkdown', () => {
  it('turns paragraphs, line breaks, emphasis, and headings into Markdown', () => {
    expect(htmlToMarkdown('<h2>Sunday</h2><p>A <strong>long</strong> walk,<br>then <em>rain</em> and <s>no</s> umbrella.</p>\n<p>Home by six.</p>'))
      .toBe('## Sunday\n\nA **long** walk,\nthen *rain* and ~~no~~ umbrella.\n\nHome by six.');
  });

  it('converts lists, quotes, code, and rules', () => {
    expect(htmlToMarkdown('<ul><li>bread</li><li>milk<ul><li>oat</li></ul></li></ul><ol><li>first</li><li>second</li></ol><blockquote><p>Be kind.</p><p>Always.</p></blockquote><p>Run <code>ls</code></p><hr><pre>line 1\nline 2\n</pre>'))
      .toBe('- bread\n- milk\n  - oat\n\n1. first\n2. second\n\n> Be kind.\n>\n> Always.\n\nRun `ls`\n\n---\n\n```\nline 1\nline 2\n```');
  });

  it('keeps safe links only and drops images and scripts', () => {
    expect(htmlToMarkdown('<p><a href="https://example.com/a b">site</a> <a href="javascript:alert(1)">bad</a> <img src="x.jpg"><script>alert(1)</script></p>'))
      .toBe('[site](https://example.com/a%20b) bad');
  });

  it('escapes text that would otherwise read as Markdown', () => {
    expect(htmlToMarkdown('<p>*not bold* [x] snake_case _under_</p>')).toBe(String.raw`\*not bold\* \[x\] snake_case \_under\_`);
  });

  it('recognizes HTML text', () => {
    expect(looksLikeHtml('<p>Hello</p>')).toBe(true);
    expect(looksLikeHtml('Plain text with a < sign')).toBe(false);
  });
});

describe('parseJourneyEntry', () => {
  const files = new Map([
    ['1588-ab-photo1.jpg', zipEntry('1588-ab-photo1.jpg')],
    ['1588-ab-clip.mp4', zipEntry('1588-ab-clip.mp4')],
  ]);

  it('maps a Journey entry with HTML text and photos', () => {
    const data = {
      id: '1588325160000-ab',
      date_journal: Date.parse('2020-05-01T09:26:00Z'),
      timezone: 'America/New_York',
      text: '<p>Morning run.</p>',
      type: 'html',
      tags: ['health'],
      favourite: true,
      photos: ['1588-ab-photo1.jpg', '1588-ab-clip.mp4', 'missing.jpg'],
    };

    expect(isJourneyEntry(data)).toBe(true);
    expect(parseJourneyEntry(data, 'fallback', (name) => files.get(name))).toEqual({
      entry: {
        sourceId: '1588325160000-ab',
        date: '2020-05-01',
        timeOfDay: '05:26',
        timestamp: data.date_journal,
        content: 'Morning run.',
        tags: ['health'],
        favorite: true,
        journal: 'Journey',
        media: [
          { name: '1588-ab-photo1.jpg', mimetype: 'image/jpeg', convert: false, file: files.get('1588-ab-photo1.jpg') },
          { name: '1588-ab-clip.mp4', mimetype: 'video/mp4', convert: false, file: files.get('1588-ab-clip.mp4') },
        ],
      },
      skippedMedia: 1,
    });
  });

  it('keeps Markdown text and uses the file name when the ID is missing', () => {
    const { entry } = parseJourneyEntry({ date_journal: 0, text: '  **Bold** start  ' }, 'entry 12', () => undefined);

    expect(entry).toEqual(expect.objectContaining({ sourceId: 'entry_12', content: '**Bold** start', favorite: false, tags: [], media: [] }));
  });

  it('keeps the Journey title and the time in the entry time zone', () => {
    const { entry } = parseJourneyEntry(
      { id: 'x', date_journal: Date.parse('2020-05-01T22:15:00Z'), timezone: 'Asia/Tokyo', title: ' Night\nshift ', text: 'Busy.' },
      'x',
      () => undefined,
    );

    expect(entry).toEqual(expect.objectContaining({ date: '2020-05-02', timeOfDay: '07:15', title: 'Night shift', content: 'Busy.' }));
  });

  it('keeps a Journey mood on the 1 to 5 scale and ignores none, other values, and the sentiment', () => {
    const parse = (mood: unknown) => parseJourneyEntry({ id: 'm', date_journal: 0, text: 'Hi', mood, sentiment: 0.8 } as never, 'm', () => undefined).entry;

    expect(parse(4)).toEqual(expect.objectContaining({ mood: 4 }));
    expect(parse(1).mood).toBe(1);
    for (const value of [0, 6, -1, 2.5, '3', null, undefined]) {
      expect(parse(value)).not.toHaveProperty('mood');
    }
    expect(journeyMood(5)).toBe(5);
    expect(journeyMood(0)).toBeUndefined();
  });

  it('recognizes Journey entries', () => {
    expect(isJourneyEntry({ date_journal: 1, text: '' })).toBe(true);
    expect(isJourneyEntry({ date_journal: '1', text: '' })).toBe(false);
    expect(isJourneyEntry(undefined)).toBe(false);
  });
});
