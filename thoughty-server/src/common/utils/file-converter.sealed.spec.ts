import { generateCsvFile, generateJsonFile, generateMarkdownFile, parseJsonFile, parseMarkdownFile } from './file-converter.util';
import { renderArchiveEntry } from './markdown-archive.util';

const sealedUntil = new Date('2031-10-27T08:00:00Z');
const sealed = {
  date: '2026-10-27',
  index: 1,
  title: 'Dear future me',
  tags: ['future-self'],
  content: 'What I want you to remember.',
  format: 'plain' as const,
  sealedUntil,
};
const open = { date: '2026-10-28', index: 1, tags: ['walks'], content: 'A walk.', format: 'plain' as const, sealedUntil: null };

describe('exports of sealed time capsules', () => {
  it('JSON keeps the text and says until when the entry is sealed; importing it brings the entry back open', () => {
    const file = generateJsonFile([sealed, open]);
    const [first, second] = JSON.parse(file).entries;

    expect(first).toMatchObject({ content: 'What I want you to remember.', title: 'Dear future me', sealedUntil: '2031-10-27T08:00:00.000Z' });
    expect(second).not.toHaveProperty('sealedUntil');
    expect(parseJsonFile(file)[0]).not.toHaveProperty('sealedUntil');
  });

  it('CSV adds a sealed_until column only when a sealed entry is in the file', () => {
    const [header, firstRow, secondRow] = generateCsvFile([sealed, open]).split('\r\n');
    const columns = header.split(',');

    expect(columns).toContain('sealed_until');
    expect(firstRow.split(',')[columns.indexOf('sealed_until')]).toBe('2031-10-27T08:00:00.000Z');
    expect(secondRow.split(',')[columns.indexOf('sealed_until')]).toBe('');
    expect(generateCsvFile([open]).split('\r\n')[0]).not.toContain('sealed_until');
  });

  it('Markdown writes a Sealed until marker that importing reads as metadata, not text', () => {
    const file = generateMarkdownFile([sealed]);

    expect(file).toContain('**Title:** Dear future me | **Tags:** `future-self` | **Sealed until:** 2031-10-27T08:00:00.000Z');
    const [parsed] = parseMarkdownFile(file);
    expect(parsed).toMatchObject({ title: 'Dear future me', tags: ['future-self'], content: 'What I want you to remember.' });
    expect(parseMarkdownFile('# 2026-10-27\n\n**Sealed until:** someday\n\nText')[0].content).toContain('**Sealed until:** someday');
  });

  it('the Markdown folder writes sealed_until in the front matter', () => {
    const entry = { ...sealed, visibility: 'private' as const, isFavorite: false, isArchived: false };

    expect(renderArchiveEntry(entry, null, [])).toContain('sealed_until: "2031-10-27T08:00:00.000Z"\n---');
    expect(renderArchiveEntry({ ...entry, sealedUntil: null }, null, [])).not.toContain('sealed_until');
  });
});
