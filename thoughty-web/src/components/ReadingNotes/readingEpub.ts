import { readZipEntries, readZipText, type ZipEntry } from '../../utils/zipReader';
import { cleanMetadata, ReadingBookError, type ParsedReadingBook, type ReadingSection } from './readingBookTypes';

const CONTAINER_PATH = 'META-INF/container.xml';
const ENCRYPTION_PATH = 'META-INF/encryption.xml';
const DUBLIN_CORE = 'http://purl.org/dc/elements/1.1/';
const CHAPTER_TYPES = new Set(['application/xhtml+xml', 'text/html']);
/** The elements whose text is read as one paragraph each (the innermost ones, so nothing is read twice). */
const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, dt, dd, figcaption, td, th';
const HEADINGS = 'h1, h2, h3';
const LIMITS = { maxEntries: 10_000, maxDirectoryBytes: 16 * 1024 * 1024 };
const MAX_CHAPTER_BYTES = 8 * 1024 * 1024;
const MAX_HEADING_LENGTH = 120;

function parseXml(text: string): Document | null {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  return document.getElementsByTagName('parsererror').length > 0 ? null : document;
}

/** An archive path from a reference made in the file at `from` (`../Text/ch1.xhtml#top`), or null. */
function resolvePath(from: string, href: string): string | null {
  try {
    const url = new URL(href, `https://book.invalid/${from}`);
    return url.host === 'book.invalid' ? decodeURIComponent(url.pathname.slice(1)) : null;
  } catch {
    return null;
  }
}

function firstText(document: Document, namespace: string, localName: string): string | null {
  return cleanMetadata(document.getElementsByTagNameNS(namespace, localName)[0]?.textContent);
}

/** The files the book's encryption list names: DRM-protected text cannot be read, obfuscated fonts are not read anyway. */
async function encryptedPaths(file: File, entries: Map<string, ZipEntry>): Promise<Set<string>> {
  const entry = entries.get(ENCRYPTION_PATH);
  const document = entry ? parseXml(await readZipText(file, entry)) : null;
  const references = document ? Array.from(document.getElementsByTagNameNS('*', 'CipherReference')) : [];
  return new Set(references.map((reference) => resolvePath('', reference.getAttribute('URI') ?? '')).filter((path): path is string => path !== null));
}

/** The chapter's text, one paragraph per innermost block, and its first heading. Only text is kept: nothing is rendered. */
export function readChapter(markup: string): { heading: string | null; paragraphs: string[] } {
  let document = new DOMParser().parseFromString(markup, 'application/xhtml+xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    document = new DOMParser().parseFromString(markup, 'text/html');
  }
  const body = document.getElementsByTagNameNS('*', 'body')[0] ?? document.documentElement;
  if (!body) return { heading: null, paragraphs: [] };
  const text = (element: Element) => cleanMetadata(element.textContent);
  const blocks = Array.from(body.querySelectorAll(BLOCKS)).filter((element) => !element.querySelector(BLOCKS));
  const paragraphs = (blocks.length > 0 ? blocks.map(text) : [text(body)]).filter((paragraph): paragraph is string => paragraph !== null);
  const headingElement = body.querySelector(HEADINGS);
  const heading = headingElement ? text(headingElement)?.slice(0, MAX_HEADING_LENGTH) ?? null : null;
  return { heading, paragraphs };
}

/**
 * An EPUB read in the browser: its package file gives the title, author and reading order (the
 * spine), and each chapter's XHTML goes through an inert `DOMParser` that keeps only its text.
 */
export async function openEpubReadingBook(file: File): Promise<ParsedReadingBook> {
  const entries = new Map((await readZipEntries(file, LIMITS)).filter((entry) => !entry.symlink).map((entry) => [entry.name, entry]));
  const container = entries.get(CONTAINER_PATH);
  if (!container) throw new ReadingBookError('unsupported');
  const packagePath = parseXml(await readZipText(file, container))?.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
  const packageEntry = packagePath ? entries.get(packagePath) : undefined;
  const opf = packageEntry ? parseXml(await readZipText(file, packageEntry)) : null;
  if (!packagePath || !opf) throw new ReadingBookError('damaged');

  const manifest = new Map(Array.from(opf.getElementsByTagNameNS('*', 'item')).map((item) => [
    item.getAttribute('id') ?? '',
    { href: item.getAttribute('href') ?? '', type: item.getAttribute('media-type') ?? '' },
  ]));
  const encrypted = await encryptedPaths(file, entries);
  const chapters: Array<{ heading: string | null; paragraphs: string[] }> = [];
  let protectedChapters = 0;
  for (const itemref of Array.from(opf.getElementsByTagNameNS('*', 'itemref'))) {
    const item = manifest.get(itemref.getAttribute('idref') ?? '');
    const path = item && CHAPTER_TYPES.has(item.type) ? resolvePath(packagePath, item.href) : null;
    const entry = path ? entries.get(path) : undefined;
    if (!path || !entry || entry.size > MAX_CHAPTER_BYTES) continue;
    if (encrypted.has(path)) {
      protectedChapters += 1;
      continue;
    }
    const chapter = readChapter(await readZipText(file, entry));
    if (chapter.paragraphs.length > 0) chapters.push(chapter);
  }
  if (chapters.length === 0 && protectedChapters > 0) throw new ReadingBookError('protected');

  const sections: ReadingSection[] = chapters.map((chapter, index) => ({ kind: 'chapter', number: index + 1, heading: chapter.heading }));
  return {
    title: firstText(opf, DUBLIN_CORE, 'title'),
    author: firstText(opf, DUBLIN_CORE, 'creator'),
    sections,
    readSection: async (index) => chapters[index]?.paragraphs ?? [],
    destroy: async () => undefined,
  };
}
