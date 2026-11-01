import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { addSameDayOrder, findTaskListItems } from '@/common/utils';
import type { GetOpenTasksQueryDto, OpenTaskDto, OpenTasksResponseDto } from './dto';

/** Entries read at a time while the tasks are counted. */
export const OPEN_TASKS_BATCH_SIZE = 200;
const DEFAULT_LIMIT = 50;

/**
 * The open tasks across the journal: the unticked task list items of the writer's Markdown entries,
 * newest entries first (in the journal's order within a day) and top to bottom in each entry.
 *
 * They are read from the entries themselves rather than kept in a table of their own, so no write path
 * (editing, importing, restoring a revision or from the recycle bin, opening a time capsule...) has to
 * keep one in step. Only entries whose text holds an empty box (`[ ]`) are read, a few at a time, which
 * keeps the cost to the entries with tasks still open. Sealed time capsules and the recycle bin are
 * left out; archived entries count, since their tasks are still to do.
 */
@Injectable()
export class EntryOpenTasksService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async list(userId: number, query: GetOpenTasksQueryDto): Promise<OpenTasksResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const first = (page - 1) * limit;
    const tasks: OpenTaskDto[] = [];
    let total = 0;

    for (let offset = 0; ; offset += OPEN_TASKS_BATCH_SIZE) {
      const entries = await this.findCandidates(userId, query.diaryId, offset);
      for (const entry of entries) {
        for (const item of findTaskListItems(entry.content)) {
          if (item.checked) {
            continue;
          }
          if (total >= first && tasks.length < limit) {
            tasks.push({ entryId: entry.id, date: entry.date, title: entry.title, line: item.line, text: item.text });
          }
          total += 1;
        }
      }
      if (entries.length < OPEN_TASKS_BATCH_SIZE) {
        break;
      }
    }

    return { tasks, total, page, totalPages: Math.ceil(total / limit) };
  }

  /** A batch of the writer's Markdown entries, outside time capsules, whose text holds an empty box. */
  private findCandidates(userId: number, diaryId: number | undefined, offset: number): Promise<Entry[]> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .select(['e.id', 'e.date', 'e.timeOfDay', 'e.index', 'e.title', 'e.content'])
      .where('e.user_id = :userId', { userId })
      .andWhere("e.format = 'markdown'")
      .andWhere('e.sealed_until IS NULL')
      .andWhere("strpos(e.content, '[ ]') > 0");
    if (diaryId) {
      qb.andWhere('e.diary_id = :diaryId', { diaryId });
    }
    return addSameDayOrder(qb.orderBy('e.date', 'DESC'), 'e')
      .addOrderBy('e.id', 'ASC')
      .offset(offset)
      .limit(OPEN_TASKS_BATCH_SIZE)
      .getMany();
  }
}
