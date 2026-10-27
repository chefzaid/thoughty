import { replaceInlineImages } from './inline-image.util';

export type ArchiveLanguage = 'en' | 'fr';

export interface ArchiveEntry {
  date: string;
  title?: string | null;
  timeOfDay?: string | null;
  mood?: number | null;
  feelings?: string[] | null;
  content: string;
  tags: string[];
  format: 'plain' | 'markdown';
  visibility: 'public' | 'private';
  isFavorite: boolean;
  isArchived: boolean;
  /** When a sealed time capsule opens. */
  sealedUntil?: Date | null;
}

export interface ArchiveLink {
  /** The attachment's ID, which inline images of the entry name. */
  id?: number;
  /** Path relative to the entry's Markdown file. */
  path: string;
  name: string;
  mimetype: string;
  transcript?: string | null;
}

// Path separators, characters Windows reserves, and control characters
const UNSAFE_NAME_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** A file or folder name every common OS accepts, or `fallback` when nothing usable is left. */
export function safeArchiveName(name: string, fallback: string): string {
  const cleaned = name
    .normalize('NFC')
    .replace(UNSAFE_NAME_CHARACTERS, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80)
    .trim();
  return cleaned && !WINDOWS_RESERVED_NAMES.test(cleaned) ? cleaned : fallback;
}

/** Splits `photo.final.jpg` into `photo.final` and `.jpg`. */
export function splitExtension(name: string): { stem: string; extension: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1 || name.length - dot > 10) {
    return { stem: name, extension: '' };
  }
  return { stem: name.slice(0, dot), extension: name.slice(dot).toLowerCase() };
}

/** Hands out paths that never collide, even on case-insensitive file systems. */
export class ArchivePathAllocator {
  private readonly used = new Set<string>();

  /** Returns `base + extension`, or `base-2 + extension`, `base-3 + extension`… when it is taken. */
  allocate(base: string, extension = ''): string {
    let candidate = `${base}${extension}`;
    for (let suffix = 2; this.used.has(candidate.toLowerCase()); suffix++) {
      candidate = `${base}-${suffix}${extension}`;
    }
    this.used.add(candidate.toLowerCase());
    return candidate;
  }
}

function escapeLinkText(text: string): string {
  return text.replaceAll(/([\\[\]])/g, String.raw`\$1`);
}

/**
 * A Markdown entry's inline images pointing at their files in the archive, and the links the text
 * does not place. An inline image whose file is not in the archive (deleted, or unreadable) keeps
 * its alt text.
 */
function placeArchiveImages(entry: ArchiveEntry, links: ArchiveLink[]): { content: string; trailing: ArchiveLink[] } {
  if (entry.format !== 'markdown') {
    return { content: entry.content, trailing: links };
  }
  const byId = new Map(links.filter((link) => link.id !== undefined).map((link) => [link.id as number, link]));
  const placed = new Set<ArchiveLink>();
  const content = replaceInlineImages(entry.content, (reference) => {
    const link = reference.id === null ? undefined : byId.get(reference.id);
    if (!link) {
      return reference.alt;
    }
    placed.add(link);
    return `![${reference.alt}](<${link.path}>)`;
  });
  return { content, trailing: links.filter((link) => !placed.has(link)) };
}

/** One entry as Markdown with YAML front matter, followed by links to the attachments its text does not place. */
export function renderArchiveEntry(entry: ArchiveEntry, diaryName: string | null, links: ArchiveLink[]): string {
  const frontMatter = ['---'];
  if (entry.title) {
    frontMatter.push(`title: ${JSON.stringify(entry.title)}`);
  }
  frontMatter.push(`date: ${entry.date}`);
  if (entry.timeOfDay) {
    // Quoted: YAML 1.1 readers take an unquoted 08:30 for a number of minutes
    frontMatter.push(`time: ${JSON.stringify(entry.timeOfDay)}`);
  }
  if (diaryName) {
    frontMatter.push(`diary: ${JSON.stringify(diaryName)}`);
  }
  if (entry.mood) {
    frontMatter.push(`mood: ${entry.mood}`);
  }
  if (entry.feelings && entry.feelings.length > 0) {
    frontMatter.push(`feelings: ${JSON.stringify(entry.feelings)}`);
  }
  frontMatter.push(
    `tags: ${JSON.stringify(entry.tags)}`,
    `visibility: ${entry.visibility}`,
    `format: ${entry.format}`,
  );
  if (entry.isFavorite) {
    frontMatter.push('favorite: true');
  }
  if (entry.isArchived) {
    frontMatter.push('archived: true');
  }
  if (entry.sealedUntil) {
    frontMatter.push(`sealed_until: ${JSON.stringify(entry.sealedUntil.toISOString())}`);
  }
  frontMatter.push('---');

  const { content, trailing } = placeArchiveImages(entry, links);
  const attachmentBlocks = trailing.map((link) => {
    const markup = `${link.mimetype.startsWith('image/') ? '!' : ''}[${escapeLinkText(link.name)}](<${link.path}>)`;
    const transcript = link.transcript?.trim();
    return transcript ? `${markup}\n\n> ${transcript.replaceAll('\n', '\n> ')}` : markup;
  });

  return `${[frontMatter.join('\n'), content.trim(), ...attachmentBlocks].filter(Boolean).join('\n\n')}\n`;
}

const README_TEXT: Record<ArchiveLanguage, { title: string; summary: (entries: number, diaries: number, date: string) => string; layout: string }> = {
  en: {
    title: 'Thoughty export',
    summary: (entries, diaries, date) => `Exported on ${date}: ${entries} ${entries === 1 ? 'entry' : 'entries'} in ${diaries} ${diaries === 1 ? 'diary' : 'diaries'}.`,
    layout:
      'Each diary is a folder with one folder per year. Every entry is a Markdown file named after its date and title, starting with YAML front matter (title, date, time, diary, mood from 1 for very low to 5 for very good, feelings, tags, visibility, format, favorite, archived, and sealed_until for a time capsule still sealed). Photos, recordings, and other attachments are in the year’s `attachments` folder and linked from their entry, so the folder opens as it is in Markdown editors such as Obsidian.',
  },
  fr: {
    title: 'Export Thoughty',
    summary: (entries, diaries, date) => `Exporté le ${date} : ${entries} ${entries === 1 ? 'entrée' : 'entrées'} dans ${diaries} ${diaries === 1 ? 'journal' : 'journaux'}.`,
    layout:
      'Chaque journal est un dossier, avec un dossier par année. Chaque entrée est un fichier Markdown nommé d’après sa date et son titre, qui commence par un en-tête YAML (titre, date, heure, journal, humeur de 1 pour très basse à 5 pour très bonne, ressentis, tags, visibilité, format, favori, archivé, et sealed_until pour une capsule temporelle encore scellée). Les photos, enregistrements et autres pièces jointes sont dans le dossier `attachments` de l’année et liés depuis leur entrée : le dossier s’ouvre tel quel dans les éditeurs Markdown comme Obsidian.',
  },
};

export function renderArchiveReadme(language: ArchiveLanguage, entryCount: number, diaryCount: number, exportedOn: string): string {
  const text = README_TEXT[language];
  return `# ${text.title}\n\n${text.summary(entryCount, diaryCount, exportedOn)}\n\n${text.layout}\n`;
}

export function archiveUnfiledFolderName(language: ArchiveLanguage): string {
  return language === 'fr' ? 'Sans journal' : 'No diary';
}
