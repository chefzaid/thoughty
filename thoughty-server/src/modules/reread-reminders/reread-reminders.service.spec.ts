import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { createQueryBuilder } from '@/modules/entries/entries-query.test-helpers';
import { REREAD_REMINDER_HIGHLIGHT_LIMIT, RereadReminderService } from './reread-reminders.service';

describe('RereadReminderService', () => {
  const now = new Date('2026-10-31T10:00:00Z');
  let repository: Record<string, jest.Mock>;
  let service: RereadReminderService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn(async (entry: object) => entry),
      createQueryBuilder: jest.fn(),
    };
    service = new RereadReminderService(repository as never);
  });

  it('sets or replaces the reminder on the writer’s own entry', async () => {
    repository.findOne.mockResolvedValue({ id: 4, userId: 7, sealedUntil: null, rereadOn: '2026-11-02' });

    await expect(service.set(7, 4, '2027-10-31', '2026-10-31', now)).resolves.toEqual(
      expect.objectContaining({ id: 4, rereadOn: '2027-10-31' }),
    );
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 4, userId: 7 } });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ rereadOn: '2027-10-31' }));
  });

  it('refuses a day outside tomorrow to fifty years, or a day that cannot be the writer’s', async () => {
    await expectApiError(service.set(7, 4, '2026-10-31', '2026-10-31', now), BadRequestException, 'REREAD_DATE_INVALID');
    await expectApiError(service.set(7, 4, '2077-01-01', '2026-10-31', now), BadRequestException, 'REREAD_DATE_INVALID');
    await expectApiError(service.set(7, 4, '2020-01-02', '2020-01-01', now), BadRequestException, 'VALIDATION_FAILED');
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('refuses another writer’s entry, one in the recycle bin, and a sealed time capsule', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    await expectApiError(service.set(7, 4, '2026-11-07', '2026-10-31', now), NotFoundException, 'ENTRY_NOT_FOUND');

    repository.findOne.mockResolvedValueOnce({ id: 4, userId: 7, sealedUntil: new Date('2030-01-01T08:00:00Z'), rereadOn: null });
    await expectApiError(service.set(7, 4, '2026-11-07', '2026-10-31', now), ConflictException, 'ENTRY_SEALED');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('clears a reminder, and leaves an entry without one as it is', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 4, userId: 7, sealedUntil: null, rereadOn: '2026-10-30' });
    await expect(service.clear(7, 4)).resolves.toEqual(expect.objectContaining({ rereadOn: null }));
    expect(repository.save).toHaveBeenCalledTimes(1);

    repository.findOne.mockResolvedValueOnce({ id: 5, userId: 7, sealedUntil: null, rereadOn: null });
    await expect(service.clear(7, 5)).resolves.toEqual(expect.objectContaining({ id: 5, rereadOn: null }));
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('finds the reminders due by the writer’s day, longest waiting first, in one diary or all', async () => {
    const due = [{ id: 4, rereadOn: '2026-10-20' }];
    const qb = createQueryBuilder({ getMany: jest.fn().mockResolvedValue(due) });
    repository.createQueryBuilder.mockReturnValueOnce(qb);

    await expect(service.findDue(7, 3, '2026-10-31')).resolves.toBe(due);
    expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
    expect(qb.andWhere).toHaveBeenCalledWith('e.reread_on <= :today', { today: '2026-10-31' });
    expect(qb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(qb.orderBy).toHaveBeenCalledWith('e.reread_on', 'ASC');
    expect(qb.limit).toHaveBeenCalledWith(REREAD_REMINDER_HIGHLIGHT_LIMIT);

    const everyDiary = createQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) });
    repository.createQueryBuilder.mockReturnValueOnce(everyDiary);
    await service.findDue(7, undefined, '2026-10-31');
    expect(everyDiary.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
  });
});
