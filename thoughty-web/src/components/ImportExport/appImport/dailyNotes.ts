import { inlineImageMarkdown } from '../../../utils/inlineImages';
import type { ZipEntry } from '../../../utils/zipReader';
import { attachmentTypeFor, baseName, cleanTags, fileExtension, storedMediaName } from './appImportMedia';
import type { ImportedMedia } from './appImportTypes';

/** `2024-03-14.md` (Obsidian and most daily-notes plugins) or `2024_03_14.md` (Logseq's journals folder). */
const DAILY_NOTE_NAME = /^(\d{4})([-_])(\d{2})\2(\d{2})\.md$/i;
const DATE_LINK = /^(\d{4})([-_])(\d{2})\2(\d{2})$/;
const FRONT_MATTER = /^---[ \t]*\n(?:([\s\S]*?)\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/;
const FRONT_MATTER_TAGS = /^tags?[ \t]*:[ \t]*(.*)$/im;
const LOGSEQ_TAGS = /^[ \t]*(?:[-*][ \t]+)?tags::[ \t]*(.*)(?:\n|$)/gim;
// Logseq's own bookkeeping on a block, never written by the writer
const LOGSEQ_HIDDEN_PROPERTY = /^[ \t]*(?:id|collapsed)::.*(?:\n|$)/gim;
const EMPTY_BULLET = /^[ \t]*[-*][ \t]*$/gm;
const BRACKET_TAG = /(?<=^|\s)#\[\[([^\]\n]+)\]\]/g;
const HASH_TAG = /(?<=^|\s)#([\p{L}\p{N}_/-]+)/gu;
// Fenced blocks and inline code, where nothing is a tag, a link or a picture
const CODE = /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`/g;
// `![[file.png|alt]]`, or `![alt](path "title")`
const EMBED = /!\[\[([^\]\n]+)\]\]|!\[((?:\\.|[^\\\]\n])*)\]\(([^)\n]*)\)/g;
const WIKILINK = /\[\[([^\]\n]+)\]\]/g;
const EXTERNAL_TARGET = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const OBSIDIAN_IMAGE_SIZE = /^\d+(?:x\d+)?$/;
// CommonMark's backslash escapes: a backslash before any other character is a backslash
const MARKDOWN_ESCAPE = /\\([!-/:-@[-`{-~])/g;

/** The day `year-month-day` names, or null when there is no such day. */
function calendarDay(year: string, month: string, day: string): string | null {
  // Not Date.UTC, which reads years 0 to 99 as 1900 to 1999
  const value = new Date(0);
  value.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  const valid = Number(year) >= 1
    && value.getUTCFullYear() === Number(year)
    && value.getUTCMonth() === Number(month) - 1
    && value.getUTCDate() === Number(day);
  return valid ? `${year}-${month}-${day}` : null;
}

/** The day a daily note is named by, or null for any other file and for a day that does not exist (`2023-02-29.md`). */
export function dailyNoteDate(fileName: string): string | null {
  const match = DAILY_NOTE_NAME.exec(fileName);
  return match ? calendarDay(match[1]!, match[3]!, match[4]!) : null;
}

/** Splits YAML front matter from the text, with Windows line endings and a byte-order mark already gone. */
export function splitFrontMatter(text: string): { frontMatter: string | null; body: string } {
  const match = FRONT_MATTER.exec(text);
  return match ? { frontMatter: match[1] ?? '', body: text.slice(match[0].length) } : { frontMatter: null, body: text };
}

function tagName(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').replace(/^\[\[|\]\]$/g, '').replace(/^#/, '').trim();
}

/** The `tags:` (or `tag:`) of front matter: a list on the line (`[a, b]`, `a, b`, `a b`) or indented below it (`- a`). */
export function frontMatterTags(frontMatter: string): string[] {
  const match = FRONT_MATTER_TAGS.exec(frontMatter);
  if (!match) {
    return [];
  }
  const inline = match[1]!.trim();
  if (inline) {
    const list = inline.replace(/^\[|\]$/g, '');
    return list.split(list.includes(',') ? ',' : /\s+/).map(tagName).filter(Boolean);
  }
  const after = frontMatter.slice(match.index + match[0].length).split('\n').slice(1);
  const items: string[] = [];
  for (const line of after) {
    const item = /^[ \t]*-[ \t]+(.+)$/.exec(line);
    if (!item) {
      break;
    }
    items.push(tagName(item[1]!));
  }
  return items.filter(Boolean);
}

/** Where a part of the text outside code sits: one beside code begins or ends partway through a line. */
interface PartEdges {
  readonly followsCode: boolean;
  readonly precedesCode: boolean;
}

/** Runs `change` on the text outside code, leaving code exactly as written. */
function outsideCode(text: string, change: (part: string, edges: PartEdges) => string): string {
  let result = '';
  let at = 0;
  for (const match of text.matchAll(CODE)) {
    result += change(text.slice(at, match.index), { followsCode: at > 0, precedesCode: true }) + match[0];
    at = match.index + match[0].length;
  }
  return result + change(text.slice(at), { followsCode: at > 0, precedesCode: false });
}

/**
 * Runs `change` on the lines of the part that are whole lines of the note, so that what follows or
 * comes before inline code on its line is never read as a line of its own (a `tags::` property, an
 * empty bullet).
 */
function onWholeLines(part: string, edges: PartEdges, change: (lines: string) => string): string {
  const start = edges.followsCode ? part.indexOf('\n') : 0;
  const end = edges.precedesCode ? part.lastIndexOf('\n') + 1 : part.length;
  if (start < 0 || end <= start) {
    return part;
  }
  return part.slice(0, start) + change(part.slice(start, end)) + part.slice(end);
}

/** `#tag`, `#nested/tag` and Logseq's `#[[two words]]`; a number alone (`#1`) is not a tag. */
export function hashTags(text: string): string[] {
  const tags: string[] = [];
  outsideCode(text, (part) => {
    for (const match of part.matchAll(BRACKET_TAG)) {
      tags.push(tagName(match[1]!));
    }
    for (const match of part.matchAll(HASH_TAG)) {
      const name = match[1]!.replace(/\/+$/, '');
      if (/\D/.test(name)) {
        tags.push(name);
      }
    }
    return part;
  });
  return tags.filter(Boolean);
}

/** A daily note's file, found from the note that embeds it. */
export interface DailyNoteFiles {
  /** A path relative to the note (`../assets/x.png`), or to the archive's top when the note's folder has no such file. */
  byPath(noteFolder: readonly string[], path: string): ZipEntry | undefined;
  /** Obsidian's `![[x.png]]`: the file of that name anywhere, or ending with the given folders. */
  byName(target: string): ZipEntry | undefined;
}

export interface ParsedDailyNote {
  readonly content: string;
  readonly tags: string[];
  readonly media: ImportedMedia[];
  readonly skippedMedia: number;
}

/** The path of `![alt](path "title")` or `![alt](<path with spaces>)`, without its URL encoding. */
function decodedPath(target: string): string {
  const trimmed = target.trim();
  const close = trimmed.indexOf('>');
  const path = trimmed.startsWith('<') ? trimmed.slice(1, close < 0 ? undefined : close) : trimmed.split(/\s+/)[0]!;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function linkText(inner: string): string {
  const [target = '', alias] = inner.split('|');
  const date = DATE_LINK.exec(target.trim());
  const day = date ? calendarDay(date[1]!, date[3]!, date[4]!) : null;
  if (day) {
    return `[[${day}]]`;
  }
  const [page = '', section = ''] = target.split('#');
  return (alias?.trim() || page.trim() || section.replace(/^\^/, '').trim());
}

/** Gives each file of the note a name of its own, the file's name unless another file of the note took it. */
class NoteMedia {
  readonly media: ImportedMedia[] = [];
  private readonly byFile = new Map<string, ImportedMedia>();
  private readonly names = new Set<string>();

  add(file: ZipEntry, type: { mimetype: string; convert: boolean }): ImportedMedia {
    const known = this.byFile.get(file.name);
    if (known) {
      return known;
    }
    const original = baseName(file.name);
    const stem = original.slice(0, original.length - fileExtension(original).length - 1);
    let name = original;
    for (let copy = 2; this.names.has(name.toLowerCase()); copy++) {
      name = `${stem}-${copy}.${fileExtension(original)}`;
    }
    const media = { name, file, ...type };
    this.names.add(name.toLowerCase());
    this.byFile.set(file.name, media);
    this.media.push(media);
    return media;
  }
}

/**
 * One daily note as a Markdown entry. Front matter and Logseq's `tags::` give tags with the text's
 * `#tags`, and are left out of the text. A picture the archive holds stays where it is, naming the
 * file the import sends next; a recording, video or PDF is attached below; a missing file or one of
 * another type keeps its description. `[[2024-03-14]]` (or `[[2024_03_14]]`) becomes a link to that
 * day's entry; other wikilinks become their text.
 */
export function parseDailyNote(text: string, notePath: readonly string[], files: DailyNoteFiles): ParsedDailyNote {
  const { frontMatter, body } = splitFrontMatter(text.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n'));
  const tags = frontMatter ? frontMatterTags(frontMatter) : [];
  const folder = notePath.slice(0, -1);
  const media = new NoteMedia();
  let skippedMedia = 0;

  /** `alt` is Markdown, kept as text when the file is not there; `plainAlt` the same without its escapes. */
  const place = (file: ZipEntry | undefined, alt: string, raw: string, plainAlt = alt): string => {
    const type = file ? attachmentTypeFor(file.name) : null;
    if (!file || !type) {
      skippedMedia++;
      return alt;
    }
    const imported = media.add(file, type);
    if (type.mimetype.startsWith('image/')) {
      return inlineImageMarkdown(storedMediaName(imported), plainAlt);
    }
    return raw.startsWith('![[') ? '' : alt;
  };

  const embedded = (raw: string, wiki: string | undefined, alt: string | undefined, target: string | undefined): string => {
    if (wiki !== undefined) {
      const [name = '', label = ''] = wiki.split('|');
      const fileName = name.split('#')[0]!.trim();
      if (!attachmentTypeFor(fileName)) {
        // An embedded note or a file Thoughty cannot keep: its name stays as text
        return linkText(wiki);
      }
      const description = OBSIDIAN_IMAGE_SIZE.test(label.trim()) ? baseName(fileName) : label.trim() || baseName(fileName);
      return place(files.byName(fileName), description, raw);
    }
    const path = decodedPath(target ?? '');
    if (!path || EXTERNAL_TARGET.test(path)) {
      return raw;
    }
    const description = (alt ?? '').trim();
    const plainDescription = description.replaceAll(MARKDOWN_ESCAPE, '$1');
    return place(files.byPath(folder, path), description || baseName(path), raw, plainDescription || baseName(path));
  };

  const content = outsideCode(body, (text, edges) => {
    const withoutProperties = onWholeLines(text, edges, (lines) => lines
      .replaceAll(LOGSEQ_TAGS, (_line: string, values: string) => {
        tags.push(...values.split(',').map(tagName).filter(Boolean));
        return '';
      })
      .replaceAll(LOGSEQ_HIDDEN_PROPERTY, ''));
    const linked = withoutProperties
      .replaceAll(EMBED, embedded)
      .replaceAll(WIKILINK, (_link: string, inner: string) => linkText(inner));
    return onWholeLines(linked, edges, (lines) => lines.replaceAll(EMPTY_BULLET, ''))
      .replaceAll(/\n[ \t]*(?:\n[ \t]*){2,}/g, '\n\n');
  }).trim();

  return { content, tags: cleanTags([...tags, ...hashTags(body)]), media: media.media, skippedMedia };
}
