import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Attachment, Entry } from '@/database/entities';
import { findInlineImages, inlineImageIds, replaceInlineImages, type InlineImageReference } from '@/common/utils';

/** Text about to be saved on an entry. */
export interface InlineImageDraft {
  readonly content: string;
  readonly format?: 'plain' | 'markdown' | null;
  /** The entry being edited; none for a new entry. */
  readonly entryId?: number;
  /** The text the entry holds now, whose references stay even when their attachment is gone. */
  readonly previousContent?: string;
}

export interface CheckedInlineImages {
  readonly content: string;
  /** The writer's attachments not on any entry yet that the text places: they join the entry once it is saved. */
  readonly placed: number[];
}

/** What a reference points at, whatever its alt text: an attachment ID or a file an import has yet to send. */
function targetOf(reference: InlineImageReference): string {
  return reference.id === null ? `file:${reference.fileName}` : `id:${reference.id}`;
}

/** A file an app import stored on an entry. */
export interface StoredImportFile {
  readonly id: number;
  readonly entryId: number;
  readonly originalFilename: string;
}

/**
 * Keeps the inline images of Markdown entries to the entry's own attachments. On save, a reference
 * stays when its attachment is on this entry, is the writer's own and on no entry yet (uploaded from
 * the composer: it then joins the entry), or was already in the entry's text (its attachment has
 * since been deleted, and the journal shows a placeholder; or a photo an interrupted app import has
 * yet to send). Any other reference, to another entry's attachment, another writer's, or one that
 * never existed, is replaced by its alt text, so a save is never refused for a pasted picture.
 * Plain-text entries are saved as written.
 */
@Injectable()
export class EntryInlineImagesService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async check(userId: number, draft: InlineImageDraft): Promise<CheckedInlineImages> {
    if (draft.format !== 'markdown') {
      return { content: draft.content, placed: [] };
    }
    const ids = inlineImageIds(draft.content);
    const owners = new Map<number, number | null>();
    if (ids.length > 0) {
      const attachments = await this.attachmentRepository.find({
        select: { id: true, entryId: true },
        where: { userId, id: In(ids) },
      });
      for (const attachment of attachments) {
        owners.set(attachment.id, attachment.entryId);
      }
    }

    const earlier = new Set(findInlineImages(draft.previousContent ?? '').map(targetOf));
    const placed = new Set<number>();
    const content = replaceInlineImages(draft.content, (reference) => {
      if (reference.id !== null && owners.has(reference.id)) {
        const owner = owners.get(reference.id);
        if (owner === null) {
          placed.add(reference.id);
          return reference.raw;
        }
        if (owner === draft.entryId) {
          return reference.raw;
        }
      }
      return earlier.has(targetOf(reference)) ? reference.raw : reference.alt;
    });
    return { content, placed: [...placed] };
  }

  /** Puts the attachments the saved text placed on the entry, unless another entry took them meanwhile. */
  async attachPlaced(userId: number, entryId: number, placed: number[]): Promise<void> {
    if (placed.length > 0) {
      await this.attachmentRepository.update({ userId, id: In(placed), entryId: IsNull() }, { entryId });
    }
  }

  /**
   * Turns the file-name references of imported entries into references to the files just stored on
   * them. A name that matches several files on one entry takes the first of them.
   */
  async resolveImportedFiles(userId: number, files: StoredImportFile[]): Promise<void> {
    const byEntry = new Map<number, Map<string, number>>();
    for (const file of files) {
      const names = byEntry.get(file.entryId) ?? new Map<string, number>();
      if (!names.has(file.originalFilename)) {
        names.set(file.originalFilename, file.id);
      }
      byEntry.set(file.entryId, names);
    }
    if (byEntry.size === 0) {
      return;
    }

    const entries = await this.entryRepository.find({
      select: { id: true, content: true },
      where: { userId, id: In([...byEntry.keys()]) },
    });
    for (const entry of entries) {
      const names = byEntry.get(entry.id) as Map<string, number>;
      const content = replaceInlineImages(entry.content, (reference) => {
        const id = reference.fileName === null ? undefined : names.get(reference.fileName);
        return id === undefined ? reference.raw : `![${reference.alt}](attachment:${id})`;
      });
      if (content !== entry.content) {
        await this.entryRepository.update({ id: entry.id, userId }, { content });
      }
    }
  }
}
