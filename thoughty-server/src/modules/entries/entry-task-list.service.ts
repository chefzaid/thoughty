import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { DataSource } from 'typeorm';
import { Entry, EntryRevision } from '@/database/entities';
import { setTaskListItem, withoutTaskStates } from '@/common/utils';
import { entryRevisionSnapshot } from './entries-command.service';
import { UpdateEntryTaskDto } from './dto';
import { assertEntryNotSealed } from '@/modules/time-capsules/time-capsule.guard';

/** Ticks within this time of the entry's last revision add no revision of their own. */
export const TASK_REVISION_WINDOW_MS = 10 * 60 * 1000;

const sameList = (left: readonly string[] | null | undefined, right: readonly string[] | null | undefined): boolean =>
  (left ?? []).join('\u0000') === (right ?? []).join('\u0000');

/**
 * Whether the latest revision already holds the entry as it was before a run of ticks: it is recent,
 * and the entry has changed since only in which tasks are ticked. Keeping it then, instead of adding
 * one revision per tick, leaves the history with the version before the ticking began.
 */
export function revisionCoversTicks(revision: EntryRevision | null, entry: Entry, now: Date): boolean {
  if (!revision || now.getTime() - revision.createdAt.getTime() > TASK_REVISION_WINDOW_MS) {
    return false;
  }

  return withoutTaskStates(revision.content) === withoutTaskStates(entry.content)
    && revision.title === entry.title
    && revision.timeOfDay === entry.timeOfDay
    && revision.mood === entry.mood
    && sameList(revision.feelings, entry.feelings)
    && sameList(revision.tags, entry.tags)
    && revision.date === entry.date
    && revision.format === entry.format
    && revision.visibility === entry.visibility;
}

/** Ticking the task list items of Markdown entries from the journal. */
@Injectable()
export class EntryTaskListService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Sets one task of an entry as done or not. The entry is locked while it changes, so ticks sent
   * one after the other never undo each other. Like any edit it keeps the previous version in the
   * history, except within a few minutes of a revision that the ticks alone have moved away from.
   */
  async setTask(userId: number, id: number, dto: UpdateEntryTaskDto): Promise<{ success: boolean; entry: Entry }> {
    return this.dataSource.transaction(async (manager) => {
      const entries = manager.getRepository(Entry);
      const entry = await entries.findOne({ where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!entry) {
        throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
      }
      assertEntryNotSealed(entry);
      if (entry.format !== 'markdown') {
        throw apiError(BadRequestException, 'ENTRY_TASKS_MARKDOWN_ONLY');
      }

      const content = setTaskListItem(entry.content, dto.line, dto.checked);
      if (content === null) {
        throw apiError(ConflictException, 'ENTRY_TASK_CHANGED');
      }
      if (content === entry.content) {
        return { success: true, entry };
      }

      const revisions = manager.getRepository(EntryRevision);
      const latest = await revisions.findOne({ where: { entryId: entry.id }, order: { createdAt: 'DESC', id: 'DESC' } });
      if (!revisionCoversTicks(latest, entry, new Date())) {
        await revisions.save(entryRevisionSnapshot(entry));
      }

      entry.content = content;
      return { success: true, entry: await entries.save(entry) };
    });
  }
}
