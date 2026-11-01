import { describe, expect, it } from 'vitest';

import type { ZipEntry } from '../../../utils/zipReader';
import { dailyNoteDate, frontMatterTags, hashTags, parseDailyNote, splitFrontMatter, type DailyNoteFiles } from './dailyNotes';

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

const noFiles: DailyNoteFiles = { byPath: () => undefined, byName: () => undefined };

describe('dailyNoteDate', () => {
  it.each([
    ['2024-03-14.md', '2024-03-14'],
    ['2024_03_14.md', '2024-03-14'],
    ['2024-02-29.MD', '2024-02-29'],
    ['0001-01-01.md', '0001-01-01'],
  ])('reads the day of %s', (name, day) => {
    expect(dailyNoteDate(name)).toBe(day);
  });

  it.each([
    '2023-02-29.md',
    '2024_02_30.md',
    '2024-13-01.md',
    '2024-00-10.md',
    '2024-04-31.md',
    '0000-01-01.md',
    '2024-03_14.md',
    '2024-3-14.md',
    '24-03-14.md',
    '2024-03-14 Thursday.md',
    'Meeting 2024-03-14.md',
    '2024-03-14.txt',
    '2024-03-14.md.bak',
    'Ideas.md',
  ])('leaves out %s, which is not named by a day that exists', (name) => {
    expect(dailyNoteDate(name)).toBeNull();
  });
});

describe('front matter', () => {
  it('splits YAML front matter from the text', () => {
    expect(splitFrontMatter('---\ntags: [a]\n---\nBody\n')).toEqual({ frontMatter: 'tags: [a]', body: 'Body\n' });
    expect(splitFrontMatter('---\n---\nBody')).toEqual({ frontMatter: '', body: 'Body' });
    expect(splitFrontMatter('Text\n---\nnot front matter\n---')).toEqual({ frontMatter: null, body: 'Text\n---\nnot front matter\n---' });
  });

  it.each([
    ['tags: [journal, "#family", \'trip\']', ['journal', 'family', 'trip']],
    ['tags: journal, family', ['journal', 'family']],
    ['tags: journal family', ['journal', 'family']],
    ['tag: solo', ['solo']],
    ['tags:\n  - journal\n  - "#family"\nmood: 4', ['journal', 'family']],
    ['tags: []', []],
    ['title: Day\nmood: 4', []],
  ])('reads the tags of %j', (frontMatter, tags) => {
    expect(frontMatterTags(frontMatter)).toEqual(tags);
  });
});

describe('hashTags', () => {
  it('finds #tags, nested tags and Logseq bracket tags outside code', () => {
    expect(hashTags('Walk #outdoors #family/kids and #[[slow mornings]]. `#notatag`\n```\n#neither\n```\n#last')).toEqual([
      'slow mornings',
      'outdoors',
      'family/kids',
      'last',
    ]);
  });

  it('leaves out headings, numbers, anchors and links', () => {
    expect(hashTags('# Heading\n## Sub\nItem #1 of C# in [link](#anchor) https://x.org/#frag')).toEqual([]);
  });
});

describe('parseDailyNote', () => {
  it('turns an Obsidian note into Markdown with its front matter tags and #tags, without the front matter', () => {
    const note = '\uFEFF---\r\ntags: [journal]\r\naliases: [Thursday]\r\n---\r\n# Thursday\r\n\r\nRain all day. #weather\r\n';

    expect(parseDailyNote(note, ['Daily', '2024-03-14.md'], noFiles)).toEqual({
      content: '# Thursday\n\nRain all day. #weather',
      tags: ['journal', 'weather'],
      media: [],
      skippedMedia: 0,
    });
  });

  it('keeps a Logseq outline as a Markdown list, taking its tags:: and dropping its own block properties and empty bullets', () => {
    const note = 'tags:: work, [[deep focus]], #review\n\n- Morning standup\n\tcollapsed:: true\n\t- Shipped the import\n\t  id:: 65f2c1aa-0000\n-\n- \n';

    expect(parseDailyNote(note, ['journals', '2024_03_14.md'], noFiles)).toEqual({
      content: '- Morning standup\n\t- Shipped the import',
      tags: ['work', 'deep focus', 'review'],
      media: [],
      skippedMedia: 0,
    });
  });

  it('links to another day with [[YYYY-MM-DD]] and keeps other wikilinks as their text', () => {
    const note = 'See [[2024-03-13]], [[2024_03_12]] and [[2024-03-11|Monday]]. Met [[Marie Curie]] about [[Project X#Plan]] and [[Ideas|my ideas]]; ![[Weekly review]]. Not a day: [[2023-02-29]].';

    expect(parseDailyNote(note, ['2024-03-14.md'], noFiles).content).toBe(
      'See [[2024-03-13]], [[2024-03-12]] and [[2024-03-11]]. Met Marie Curie about Project X and my ideas; Weekly review. Not a day: 2023-02-29.',
    );
  });

  it('leaves code exactly as written', () => {
    const note = 'Before [[Page]]\n\n```md\n[[Page]] #tag ![[x.png]]\n-\n```\n\nInline `[[Page]]`';

    expect(parseDailyNote(note, ['2024-03-14.md'], noFiles)).toEqual(expect.objectContaining({
      content: 'Before Page\n\n```md\n[[Page]] #tag ![[x.png]]\n-\n```\n\nInline `[[Page]]`',
      tags: [],
    }));
  });

  it('places embedded pictures inline by the name of the file the import sends, and attaches recordings below', () => {
    const photo = zipEntry('Vault/attachments/pier.png');
    const logseqPhoto = zipEntry('Vault/assets/image_1710_0.jpg');
    const recording = zipEntry('Vault/attachments/memo.m4a');
    const heic = zipEntry('Vault/attachments/dusk.HEIC');
    const files: DailyNoteFiles = {
      byName: (target) => ({ 'pier.png': photo, 'memo.m4a': recording, 'dusk.heic': heic })[target.toLowerCase()],
      byPath: (folder, path) => (folder.join('/') === 'Vault/journals' && path === '../assets/image_1710_0.jpg' ? logseqPhoto : undefined),
    };
    const note = 'Pier ![[pier.png|400]] again ![[pier.png|The pier]]\n![Sunset](<../assets/image_1710_0.jpg> "title")\n![[memo.m4a]]\n![[dusk.HEIC]]';

    const parsed = parseDailyNote(note, ['Vault', 'journals', '2024_03_14.md'], files);

    expect(parsed.content).toBe(
      'Pier ![pier.png](attachment:pier.png) again ![The pier](attachment:pier.png)\n![Sunset](attachment:image_1710_0.jpg)\n\n![dusk.HEIC](attachment:dusk.jpg)',
    );
    expect(parsed.media.map(({ name, file, mimetype, convert }) => [name, file.name, mimetype, convert])).toEqual([
      ['pier.png', 'Vault/attachments/pier.png', 'image/png', false],
      ['image_1710_0.jpg', 'Vault/assets/image_1710_0.jpg', 'image/jpeg', false],
      ['memo.m4a', 'Vault/attachments/memo.m4a', 'audio/mp4', false],
      ['dusk.HEIC', 'Vault/attachments/dusk.HEIC', 'image/jpeg', true],
    ]);
    expect(parsed.skippedMedia).toBe(0);
  });

  it('names two different files of one note apart', () => {
    const first = zipEntry('a/photo.png');
    const second = zipEntry('b/photo.png');
    const files: DailyNoteFiles = { byName: (target) => (target === 'a/photo.png' ? first : second), byPath: () => undefined };

    const parsed = parseDailyNote('![[a/photo.png]] ![[b/photo.png]]', ['2024-03-14.md'], files);

    expect(parsed.media.map((media) => media.name)).toEqual(['photo.png', 'photo-2.png']);
    expect(parsed.content).toBe('![photo.png](attachment:photo.png) ![photo.png](attachment:photo-2.png)');
  });

  it('keeps the description of a missing picture or a file of another type, and leaves web pictures alone', () => {
    const files: DailyNoteFiles = { byName: () => undefined, byPath: (_folder, path) => (path === 'sketch.psd' ? zipEntry('sketch.psd') : undefined) };
    const note = 'Gone ![[lost.png]] ![Old map](maps/old%20map.png) ![Sketch](sketch.psd) ![Web](https://example.org/a.png) ![](<>)';

    const parsed = parseDailyNote(note, ['2024-03-14.md'], files);

    expect(parsed.content).toBe('Gone lost.png Old map Sketch ![Web](https://example.org/a.png) ![](<>)');
    expect(parsed.skippedMedia).toBe(3);
    expect(parsed.media).toEqual([]);
  });

  it('finds nothing to keep in a note of empty bullets and front matter', () => {
    expect(parseDailyNote('---\ntags: [x]\n---\n-\n- \n\n', ['2024-03-14.md'], noFiles).content).toBe('');
  });
});
