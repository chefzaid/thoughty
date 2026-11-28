// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

import { installDomParser } from '../../test/nodeDomParser';
import { buildZip, type ZipFixtureFile } from '../../test/zipFixture';
import { ReadingBookError } from './readingBookTypes';
import { openEpubReadingBook, readChapter } from './readingEpub';

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

const PACKAGE = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>  The   Little Prince </dc:title>
    <dc:creator>Antoine de Saint-Exupéry</dc:creator>
  </metadata>
  <manifest>
    <item id="cover" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="one" href="Text/chapter%201.xhtml" media-type="application/xhtml+xml"/>
    <item id="two" href="../OEBPS/Text/two.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="missing" href="Text/missing.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="cover"/><itemref idref="one"/><itemref idref="style"/><itemref idref="missing"/><itemref idref="two"/></spine>
</package>`;

beforeAll(installDomParser);

const xhtml = (body: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;

async function epub(files: ZipFixtureFile[]): Promise<File> {
  return new File([await buildZip(files) as BlobPart], 'book.epub', { type: 'application/epub+zip' });
}

const BOOK: ZipFixtureFile[] = [
  { name: 'mimetype', data: 'application/epub+zip', store: true },
  { name: 'META-INF/container.xml', data: CONTAINER },
  { name: 'OEBPS/content.opf', data: PACKAGE },
  { name: 'OEBPS/Text/cover.xhtml', data: xhtml('<img src="cover.jpg" alt=""/>') },
  {
    name: 'OEBPS/Text/chapter 1.xhtml',
    data: xhtml('<h1>Chapter I</h1><p>Once when I was six years old</p><blockquote><p>Draw me a sheep!</p></blockquote><ul><li>A <em>boa</em></li></ul><script>alert(1)</script>'),
  },
  { name: 'OEBPS/Text/two.xhtml', data: xhtml('<div>Only a   loose line of text</div>') },
];

describe('openEpubReadingBook', () => {
  it('reads the title, the author and each chapter with text in reading order, as text only', async () => {
    const book = await openEpubReadingBook(await epub(BOOK));

    expect(book.title).toBe('The Little Prince');
    expect(book.author).toBe('Antoine de Saint-Exupéry');
    // The cover holds no text and the style sheet and missing file are not chapters
    expect(book.sections).toEqual([
      { kind: 'chapter', number: 1, heading: 'Chapter I' },
      { kind: 'chapter', number: 2, heading: null },
    ]);
    expect(await book.readSection(0)).toEqual(['Chapter I', 'Once when I was six years old', 'Draw me a sheep!', 'A boa']);
    expect(await book.readSection(1)).toEqual(['Only a loose line of text']);
    expect(await book.readSection(5)).toEqual([]);
    await expect(book.destroy()).resolves.toBeUndefined();
  });

  it('turns down an archive that is not an EPUB, and a package it cannot find', async () => {
    await expect(openEpubReadingBook(await epub([{ name: 'notes.txt', data: 'hello' }]))).rejects.toEqual(new ReadingBookError('unsupported'));
    await expect(openEpubReadingBook(await epub([{ name: 'META-INF/container.xml', data: CONTAINER }]))).rejects.toEqual(new ReadingBookError('damaged'));
    await expect(openEpubReadingBook(await epub([{ name: 'META-INF/container.xml', data: '<container' }]))).rejects.toEqual(new ReadingBookError('damaged'));
  });

  it('says a book is protected when every chapter with text is encrypted, and skips encrypted fonts otherwise', async () => {
    const encryption = (uris: string[]) => `<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">${
      uris.map((uri) => `<enc:EncryptedData><enc:CipherData><enc:CipherReference URI="${uri}"/></enc:CipherData></enc:EncryptedData>`).join('')
    }</encryption>`;

    const locked = [...BOOK, { name: 'META-INF/encryption.xml', data: encryption(['OEBPS/Text/cover.xhtml', 'OEBPS/Text/chapter%201.xhtml', 'OEBPS/Text/two.xhtml']) }];
    await expect(openEpubReadingBook(await epub(locked))).rejects.toEqual(new ReadingBookError('protected'));

    const fonts = [...BOOK, { name: 'META-INF/encryption.xml', data: encryption(['OEBPS/Fonts/serif.otf']) }];
    expect((await openEpubReadingBook(await epub(fonts))).sections).toHaveLength(2);
  });
});

describe('readChapter', () => {
  it('reads a chapter that is not well-formed XHTML as HTML, and a body without blocks as one paragraph', () => {
    expect(readChapter('<html><body><h2>Two</h2><p>Unclosed<br> text<p>Next</body></html>')).toEqual({ heading: 'Two', paragraphs: ['Two', 'Unclosed text', 'Next'] });
    expect(readChapter('<html><body>Just words</body></html>')).toEqual({ heading: null, paragraphs: ['Just words'] });
    expect(readChapter('<html><body>   </body></html>')).toEqual({ heading: null, paragraphs: [] });
  });
});
