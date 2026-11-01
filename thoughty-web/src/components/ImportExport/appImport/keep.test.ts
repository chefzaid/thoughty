// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { ZipEntry } from '../../../utils/zipReader';
import { isKeepNote, keepChecklist, keepNoteSourceId, keepTime, parseKeepNote, type KeepFileLookup } from './keep';

const zipEntry = (name: string): ZipEntry => ({
  name,
  size: 10,
  compressedSize: 10,
  method: 0,
  encrypted: false,
  localHeaderOffset: 0,
  symlink: false,
  utf8Name: true,
});

const noFiles: KeepFileLookup = () => undefined;
// 10:30 UTC on 31 October 2026, in microseconds as Keep writes it
const OCTOBER_31 = Date.UTC(2026, 9, 31, 10, 30) * 1000;
const browserZone = vi.hoisted(() => ({ current: 'UTC' }));
vi.mock('../../../utils/timeZone', () => ({ browserTimeZone: () => browserZone.current }));

function inZone(timeZone: string): void {
  browserZone.current = timeZone;
}

describe('isKeepNote', () => {
  it('knows a note by a field only Keep writes', () => {
    expect(isKeepNote({ textContent: 'x' })).toBe(true);
    expect(isKeepNote({ listContent: [] })).toBe(true);
    expect(isKeepNote({ createdTimestampUsec: 1 })).toBe(true);
    expect(isKeepNote({ title: 'A Day One journal', entries: [] })).toBe(false);
    expect(isKeepNote([{ textContent: 'x' }])).toBe(false);
    expect(isKeepNote(null)).toBe(false);
    expect(isKeepNote('textContent')).toBe(false);
  });
});

describe('keepTime', () => {
  it('reads microseconds as milliseconds, from a number or a numeric string', () => {
    expect(keepTime(1_710_410_400_123_456)).toBe(1_710_410_400_123);
    expect(keepTime('1710410400123456')).toBe(1_710_410_400_123);
  });

  it.each([undefined, null, 0, -5, Number.NaN, '17e14', '', 9e18, true])('has no time for %s', (value) => {
    expect(keepTime(value)).toBeNull();
  });
});

describe('keepNoteSourceId', () => {
  it('keeps a plain file name and hashes one the API would not take', () => {
    expect(keepNoteSourceId('Groceries.json', '2024-03-14')).toBe('Groceries');
    expect(keepNoteSourceId('2024-03-14T10_22_33.123-07_00.json', '2024-03-14')).toBe('2024-03-14T10_22_33.123-07_00');
    expect(keepNoteSourceId('Idées de voyage.json', '2024-03-14')).toMatch(/^2024-03-14\.[0-9a-f]{16}$/);
    expect(keepNoteSourceId('Idées de voyage.json', '2024-03-14')).toBe(keepNoteSourceId('Idées de voyage.json', '2024-03-14'));
    expect(keepNoteSourceId(`${'a'.repeat(91)}.json`, '2024-03-14')).toMatch(/^2024-03-14\.[0-9a-f]{16}$/);
  });
});

describe('keepChecklist', () => {
  it('writes checked and unchecked items as a Markdown task list, leaving out empty ones', () => {
    const list = [
      { text: 'Milk', isChecked: false },
      { text: 'Bread', isChecked: true },
      { text: '  ', isChecked: false },
      { text: 'Eggs\r\nfree range' },
      { isChecked: true },
      'stray',
      null,
    ];

    expect(keepChecklist(list)).toBe('- [ ] Milk\n- [x] Bread\n- [ ] Eggs\n  free range');
    expect(keepChecklist('not a list')).toBe('');
  });
});

describe('parseKeepNote', () => {
  it('turns a note into an entry with its title, text, labels as tags, and flags', () => {
    inZone('UTC');
    const note = {
      title: '  Trip   ideas ',
      textContent: 'Lisbon in spring\r\n\r\nPorto too',
      labels: [{ name: 'Travel plans' }, { name: 'travel plans' }, { name: 'Travel plans' }, { name: 42 }, 'loose'],
      isArchived: true,
      isPinned: true,
      color: 'YELLOW',
      createdTimestampUsec: OCTOBER_31,
      userEditedTimestampUsec: OCTOBER_31 + 86_400_000_000,
    };

    expect(parseKeepNote(note, 'Trip ideas.json', noFiles)).toEqual({
      entry: {
        sourceId: expect.stringMatching(/^2026-10-31\.[0-9a-f]{16}$/),
        date: '2026-10-31',
        timeOfDay: '10:30',
        timestamp: OCTOBER_31 / 1000,
        title: 'Trip ideas',
        content: 'Lisbon in spring\n\nPorto too',
        tags: ['Travel plans', 'travel plans'],
        favorite: false,
        archived: true,
        pinned: true,
        journal: '',
        media: [],
      },
      skippedMedia: 0,
    });
  });

  it.each([
    // 10:30 UTC is already 1 November in Kiritimati (UTC+14) and still 30 October in Pago Pago (UTC-11)
    ['Pacific/Kiritimati', '2026-11-01', '00:30'],
    ['Pacific/Pago_Pago', '2026-10-30', '23:30'],
  ])('dates a note by its creation in the browser’s zone, %s', (timeZone, date, timeOfDay) => {
    inZone(timeZone);

    const parsed = parseKeepNote({ textContent: 'Late', createdTimestampUsec: OCTOBER_31 }, 'Late.json', noFiles);

    expect(parsed).toEqual(expect.objectContaining({ entry: expect.objectContaining({ date, timeOfDay }) }));
  });

  it('keeps text and checklist together, text first, and drops what is not a flag', () => {
    inZone('UTC');
    const note = {
      textContent: 'For Saturday',
      listContent: [{ text: 'Milk', isChecked: false }, { text: 'Bread', isChecked: true }],
      isArchived: 'true',
      isPinned: 1,
      createdTimestampUsec: OCTOBER_31,
    };

    const parsed = parseKeepNote(note, 'Groceries.json', noFiles);

    expect('entry' in parsed && parsed.entry).toEqual(expect.objectContaining({
      sourceId: 'Groceries',
      content: 'For Saturday\n\n- [ ] Milk\n- [x] Bread',
      tags: [],
    }));
    expect('entry' in parsed && parsed.entry).not.toHaveProperty('archived');
    expect('entry' in parsed && parsed.entry).not.toHaveProperty('pinned');
    expect('entry' in parsed && parsed.entry).not.toHaveProperty('title');
  });

  it('dates a note by its last edit when it has no creation time, and reads a note with every other field missing', () => {
    inZone('UTC');

    const parsed = parseKeepNote({ title: 'Only a title', userEditedTimestampUsec: String(OCTOBER_31) }, 'x.json', noFiles);

    expect(parsed).toEqual({ entry: expect.objectContaining({ date: '2026-10-31', title: 'Only a title', content: '', tags: [], media: [] }), skippedMedia: 0 });
  });

  it('leaves out a note in the bin, one with no time, and one with nothing in it', () => {
    expect(parseKeepNote({ isTrashed: true, textContent: 'Gone', createdTimestampUsec: OCTOBER_31 }, 'a.json', noFiles)).toEqual({ skipped: 'trashed', skippedMedia: 0 });
    expect(parseKeepNote({ textContent: 'When?' }, 'b.json', noFiles)).toEqual({ skipped: 'noDate', skippedMedia: 0 });
    expect(parseKeepNote({ textContent: 'Too early', createdTimestampUsec: Date.UTC(999, 0, 1) * 1000 }, 'c.json', noFiles))
      .toEqual({ skipped: 'noDate', skippedMedia: 0 });
    expect(parseKeepNote({ title: ' ', textContent: '\n', listContent: [{ text: '' }], createdTimestampUsec: OCTOBER_31 }, 'd.json', noFiles))
      .toEqual({ skipped: 'empty', skippedMedia: 0 });
  });

  it('places pictures at the top of the text, attaches other files below and counts the ones it cannot keep', () => {
    inZone('UTC');
    const photo = zipEntry('Takeout/Keep/1a2b.3c4d.jpg');
    const drawing = zipEntry('Takeout/Keep/sketch.png');
    const heic = zipEntry('Takeout/Keep/dusk.heic');
    const recording = zipEntry('Takeout/Keep/memo.m4a');
    const voice = zipEntry('Takeout/Keep/voice.3gp');
    const files: Record<string, ZipEntry> = { '1a2b.3c4d.jpeg': photo, 'sketch.png': drawing, 'dusk.heic': heic, 'memo.m4a': recording, 'voice.3gp': voice };
    const note = {
      textContent: 'Beach day',
      attachments: [
        { filePath: '1a2b.3c4d.jpeg', mimetype: 'image/jpeg' },
        { filePath: '../../sketch.png', mimetype: 'image/png' },
        { filePath: '1a2b.3c4d.jpeg', mimetype: 'image/jpeg' },
        { filePath: 'dusk.heic', mimetype: 'image/heic' },
        { filePath: 'memo.m4a', mimetype: 'audio/mp4' },
        { filePath: 'voice.3gp', mimetype: 'audio/3gpp' },
        { filePath: 'lost.png', mimetype: 'image/png' },
        { mimetype: 'image/png' },
      ],
      createdTimestampUsec: OCTOBER_31,
    };

    const parsed = parseKeepNote(note, 'Beach.json', (filePath) => files[filePath]);

    expect('entry' in parsed && parsed.entry.content).toBe(
      '![](attachment:1a2b.3c4d.jpg)\n\n![](attachment:sketch.png)\n\n![](attachment:dusk.jpg)\n\nBeach day',
    );
    expect('entry' in parsed && parsed.entry.media.map(({ name, mimetype, convert }) => [name, mimetype, convert])).toEqual([
      ['1a2b.3c4d.jpg', 'image/jpeg', false],
      ['sketch.png', 'image/png', false],
      ['dusk.heic', 'image/jpeg', true],
      ['memo.m4a', 'audio/mp4', false],
    ]);
    expect(parsed.skippedMedia).toBe(3);
  });

  it('keeps a note that holds only a recording', () => {
    inZone('UTC');
    const recording = zipEntry('Keep/memo.m4a');

    const parsed = parseKeepNote({ attachments: [{ filePath: 'memo.m4a' }], createdTimestampUsec: OCTOBER_31 }, 'memo.json', () => recording);

    expect(parsed).toEqual({ entry: expect.objectContaining({ content: '', media: [expect.objectContaining({ name: 'memo.m4a' })] }), skippedMedia: 0 });
  });
});
