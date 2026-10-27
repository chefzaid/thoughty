import {
  escapeInlineImageAlt,
  findInlineImages,
  inlineImageIds,
  inlineImageMarkdown,
  inlineImagesToAltText,
  replaceInlineImages,
  splitInlineImages,
  unescapeInlineImageAlt,
} from './inline-image.util';

describe('inline images', () => {
  it('finds attachment references by ID or by the file an import will send', () => {
    const text = 'Sea ![The \\[old\\] pier](attachment:12) and ![](attachment:photo%20one.jpg) ![web](https://x.y/a.png) ![bad](attachment:%E0%A4%A)';
    expect(findInlineImages(text)).toEqual([
      { raw: '![The \\[old\\] pier](attachment:12)', alt: 'The \\[old\\] pier', id: 12, fileName: null },
      { raw: '![](attachment:photo%20one.jpg)', alt: '', id: null, fileName: 'photo one.jpg' },
      { raw: '![bad](attachment:%E0%A4%A)', alt: 'bad', id: null, fileName: null },
    ]);
  });

  it('lists each placed attachment once, leaving out IDs that cannot be one', () => {
    expect(inlineImageIds('![a](attachment:3) ![b](attachment:3) ![c](attachment:0) ![d](attachment:4)')).toEqual([3, 4]);
  });

  it('writes a reference with its alt text escaped on one line', () => {
    expect(inlineImageMarkdown(7, ' Me [and]\n you ')).toBe('![Me \\[and\\] you](attachment:7)');
    expect(inlineImageMarkdown('photo one.jpg', '')).toBe('![](attachment:photo%20one.jpg)');
    expect(escapeInlineImageAlt('a\\b')).toBe('a\\\\b');
    expect(unescapeInlineImageAlt('The \\[old\\] pier')).toBe('The [old] pier');
  });

  it('replaces references and keeps the rest of the text', () => {
    expect(replaceInlineImages('A ![x](attachment:1) B', (reference) => `<${reference.id}>`)).toBe('A <1> B');
    expect(inlineImagesToAltText('Look: ![The pier](attachment:1)!')).toBe('Look: The pier!');
  });

  it('cuts the text around the images it resolves, merging the alt text of the others into the text', () => {
    const images = new Map([[1, 'one']]);
    expect(splitInlineImages('Start ![First](attachment:1) middle ![Gone \\[x\\]](attachment:2) end', (reference) =>
      (reference.id === null ? undefined : images.get(reference.id)))).toEqual([
      { type: 'text', text: 'Start ' },
      { type: 'image', image: 'one', alt: 'First' },
      { type: 'text', text: ' middle Gone [x] end' },
    ]);
    expect(splitInlineImages('![a](attachment:1)', () => 'img')).toEqual([{ type: 'image', image: 'img', alt: 'a' }]);
    expect(splitInlineImages('', () => undefined)).toEqual([]);
  });
});
