import {
  ArchivePathAllocator,
  archiveUnfiledFolderName,
  renderArchiveEntry,
  renderArchiveReadme,
  safeArchiveName,
  splitExtension,
  type ArchiveEntry,
} from './markdown-archive.util';

const entry: ArchiveEntry = {
  date: '2024-03-05',
  content: '  A long day by the sea.\n\nWe swam twice.  ',
  tags: ['travel', 'sea "side"'],
  format: 'markdown',
  visibility: 'private',
  isFavorite: false,
  isArchived: false,
};

describe('safeArchiveName', () => {
  it('replaces separators and reserved characters and trims dots and spaces', () => {
    expect(safeArchiveName(' ../Travel: 2024/Spain?* ', 'diary')).toBe('-Travel- 2024-Spain-');
    expect(safeArchiveName('Notes.', 'diary')).toBe('Notes');
  });

  it('keeps accents and emoji', () => {
    expect(safeArchiveName('Été 📖', 'diary')).toBe('Été 📖');
  });

  it('falls back when nothing usable is left or the name is reserved on Windows', () => {
    expect(safeArchiveName('...', 'diary-3')).toBe('diary-3');
    expect(safeArchiveName('CON', 'diary-4')).toBe('diary-4');
  });

  it('caps long names', () => {
    expect(safeArchiveName('a'.repeat(200), 'x')).toHaveLength(80);
  });
});

describe('splitExtension', () => {
  it('separates the last extension in lower case', () => {
    expect(splitExtension('photo.final.JPG')).toEqual({ stem: 'photo.final', extension: '.jpg' });
  });

  it('treats dotfiles, trailing dots, and long suffixes as having no extension', () => {
    expect(splitExtension('.hidden')).toEqual({ stem: '.hidden', extension: '' });
    expect(splitExtension('name.')).toEqual({ stem: 'name.', extension: '' });
    expect(splitExtension('notes.averyveryverylongsuffix')).toEqual({ stem: 'notes.averyveryverylongsuffix', extension: '' });
  });
});

describe('ArchivePathAllocator', () => {
  it('numbers repeated paths, ignoring case', () => {
    const paths = new ArchivePathAllocator();

    expect(paths.allocate('Travel/2024/2024-03-05', '.md')).toBe('Travel/2024/2024-03-05.md');
    expect(paths.allocate('Travel/2024/2024-03-05', '.md')).toBe('Travel/2024/2024-03-05-2.md');
    expect(paths.allocate('travel/2024/2024-03-05', '.md')).toBe('travel/2024/2024-03-05-3.md');
    expect(paths.allocate('Travel')).toBe('Travel');
  });
});

describe('renderArchiveEntry', () => {
  it('starts with front matter and keeps the text', () => {
    expect(renderArchiveEntry(entry, 'Travel "2024"', [])).toBe(
      [
        '---',
        'date: 2024-03-05',
        'diary: "Travel \\"2024\\""',
        'tags: ["travel","sea \\"side\\""]',
        'visibility: private',
        'format: markdown',
        '---',
        '',
        'A long day by the sea.\n\nWe swam twice.',
        '',
      ].join('\n'),
    );
  });

  it('puts the title first and the quoted time after the date', () => {
    const markdown = renderArchiveEntry({ ...entry, title: 'Sea "day"', timeOfDay: '08:30' }, null, []);

    expect(markdown.startsWith('---\ntitle: "Sea \\"day\\""\ndate: 2024-03-05\ntime: "08:30"\ntags:')).toBe(true);
  });

  it('marks favorites and archived entries and omits a missing diary', () => {
    const markdown = renderArchiveEntry({ ...entry, isFavorite: true, isArchived: true }, null, []);

    expect(markdown).toContain('favorite: true\narchived: true\n---');
    expect(markdown).not.toContain('diary:');
  });

  it('embeds images, links other files, and quotes transcripts', () => {
    const markdown = renderArchiveEntry({ ...entry, content: '' }, 'Travel', [
      { path: 'attachments/2024-03-05-beach [1].jpg', name: 'beach [1].jpg', mimetype: 'image/jpeg' },
      { path: 'attachments/2024-03-05-voice.m4a', name: 'voice.m4a', mimetype: 'audio/mp4', transcript: 'First line\nsecond line' },
    ]);

    expect(markdown).toContain('---\n\n![beach \\[1\\].jpg](<attachments/2024-03-05-beach [1].jpg>)\n\n[voice.m4a](<attachments/2024-03-05-voice.m4a>)\n\n> First line\n> second line\n');
  });
});

describe('renderArchiveReadme', () => {
  it('summarizes the export in the writer’s language', () => {
    expect(renderArchiveReadme('en', 1, 1, '2026-10-19')).toContain('Exported on 2026-10-19: 1 entry in 1 diary.');
    expect(renderArchiveReadme('en', 12, 3, '2026-10-19')).toContain('12 entries in 3 diaries.');
    expect(renderArchiveReadme('fr', 12, 3, '2026-10-19')).toContain('Exporté le 2026-10-19 : 12 entrées dans 3 journaux.');
  });

  it('names the folder for entries without a diary', () => {
    expect(archiveUnfiledFolderName('en')).toBe('No diary');
    expect(archiveUnfiledFolderName('fr')).toBe('Sans journal');
  });
});
