import { bookEntryMarkdown, inlineImageCaption, layoutBookEntry } from './book-inline-image.util';
import type { EmbeddedBookImage } from './book-image.util';
import type { Book, BookEntry } from './book-model.util';
import { renderBookHtml, renderBookMarkdown } from './book-render.util';
import { renderBookEpub } from './book-epub.util';
import { renderBookPdf } from './book-pdf.util';
import JSZip from 'jszip';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function image(id: number, overrides: Partial<EmbeddedBookImage> = {}): EmbeddedBookImage {
  return { id, name: `photo-${id}.png`, storedFilename: `key-${id}.png`, mimeType: 'image/png', size: png.length, data: png, ...overrides };
}

function entry(content: string, images: EmbeddedBookImage[], format: 'plain' | 'markdown' = 'markdown'): BookEntry {
  return { date: '2024-05-01', index: 1, tags: [], content, format, images };
}

function bookOf(...entries: BookEntry[]): Book {
  return { title: 'Sea', generatedAt: '2024-06-01', chapters: [{ title: 'May', entries }] };
}

const placed = entry('Before ![The pier](attachment:1) after ![Gone](attachment:9)', [image(1), image(2), image(3, { data: undefined })]);

describe('inline images in books', () => {
  it('places the embedded images where the text names them and keeps the others for after it', () => {
    const layout = layoutBookEntry(placed);
    expect(layout.segments).toEqual([
      { type: 'text', text: 'Before ' },
      { type: 'image', image: image(1), alt: 'The pier' },
      { type: 'text', text: ' after Gone' },
    ]);
    expect(layout.trailing.map((item) => item.id)).toEqual([2]);
    expect(inlineImageCaption({ type: 'image', image: image(1), alt: ' ' })).toBe('photo-1.png');
  });

  it('keeps a plain-text entry whole, references and all', () => {
    const plain = entry('Text ![x](attachment:1)', [image(1)], 'plain');
    expect(layoutBookEntry(plain)).toEqual({ segments: [{ type: 'text', text: 'Text ![x](attachment:1)' }], trailing: [image(1)] });
    expect(bookEntryMarkdown(plain).content).toBe('Text ![x](attachment:1)');
  });

  it('writes Markdown books with data URIs where the images stand and alt text for the rest', () => {
    expect(bookEntryMarkdown(placed).content).toBe(`Before ![The pier](data:image/png;base64,${png.toString('base64')}) after Gone`);
    const markdown = renderBookMarkdown(bookOf(placed));
    expect(markdown.match(/data:image\/png/g)).toHaveLength(2);
    expect(markdown).not.toContain('attachment:');
    expect(markdown).not.toContain('key-1.png');
  });

  it('embeds the images in HTML at their place, with their alt text and caption', () => {
    const html = renderBookHtml(bookOf(placed));
    expect(html).toContain('Before <figure class="entry-image inline-image"><img src="data:image/png;base64,');
    expect(html).toContain('alt="The pier"><figcaption>The pier</figcaption></figure> after Gone</div>');
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).not.toContain('attachment:');
  });

  it('embeds the images in EPUB chapters at their place, each file once', async () => {
    const zip = await JSZip.loadAsync(await renderBookEpub(bookOf(placed)));
    const chapter = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
    expect(chapter).toContain('Before <figure class="entry-image inline-image"><img src="images/attachment-1.png" alt="The pier"/>');
    expect(chapter).toContain(' after Gone</div>');
    expect(zip.file('OEBPS/images/attachment-1.png')).toBeTruthy();
    expect(zip.file('OEBPS/images/attachment-3.png')).toBeNull();
  });

  it('draws inline JPEG and PNG images in PDFs and leaves the alt text of the others', async () => {
    const gif = image(4, { mimeType: 'image/gif', data: Buffer.from('GIF89a') });
    const pdf = await renderBookPdf(bookOf(
      entry('Start ![The pier](attachment:1) ![Animated](attachment:4) end', [image(1), gif]),
      entry('![Only](attachment:2)', [image(2, { data: Buffer.from('not a png') })]),
    ));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // One drawn PNG: the image and its alpha mask
    expect(pdf.toString('latin1').match(/\/Subtype \/Image/g)).toHaveLength(2);
  });
});
