import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { WeeklyReflection } from '@/database/entities';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import type { YearEntry } from './year-review.service';
import { WeeklyReflectionService, weekEndingOn } from './weekly-reflection.service';

describe('WeeklyReflectionService', () => {
  const manager = {
    delete: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn(async (values: object) => ({ ...values, createdAt: new Date('2026-11-21T18:00:00Z') })),
  };
  const dataSource = { transaction: jest.fn(async (work: (entityManager: typeof manager) => unknown) => work(manager)) };
  const reflectionRepository = { findOne: jest.fn() };
  const yearReviewService = { assertOwnedDiary: jest.fn(), loadEntries: jest.fn() };
  const aiWeeklyReflectionService = { reflect: jest.fn() };
  const aiCredentialsService = { getStatus: jest.fn() };
  const service = new WeeklyReflectionService(
    dataSource as never,
    reflectionRepository as never,
    yearReviewService as never,
    aiWeeklyReflectionService as never,
    aiCredentialsService as never,
  );

  const entry = (id: number, date: string, overrides: Partial<YearEntry> = {}): YearEntry => ({
    id,
    date,
    index: 1,
    content: `Entry ${id} about the **garden**.`,
    tags: [],
    isFavorite: false,
    isArchived: false,
    mood: null,
    feelings: [],
    words: 5,
    ...overrides,
  });
  const reading = { themes: ['garden'], summary: 'You spent your evenings outside.', question: 'What will you plant next?' };
  const saved = (weekEnd: string) => ({
    userId: 7,
    diaryId: null,
    weekStart: '2026-11-08',
    weekEnd,
    themes: ['garden'],
    summary: 'Calm.',
    question: 'What next?',
    analyzedEntries: 2,
    createdAt: new Date('2026-11-14T08:00:00Z'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    yearReviewService.assertOwnedDiary.mockResolvedValue(undefined);
    aiCredentialsService.getStatus.mockResolvedValue({ aiAvailable: true });
    reflectionRepository.findOne.mockResolvedValue(null);
  });

  it('reads the writer’s day and the six days before it', () => {
    expect(weekEndingOn('2026-11-21')).toEqual({ from: '2026-11-15', to: '2026-11-21' });
    expect(weekEndingOn('2026-03-02')).toEqual({ from: '2026-02-24', to: '2026-03-02' });
  });

  it('counts the week’s readable entries, never locked ones, and shows a reflection asked during these seven days', async () => {
    yearReviewService.loadEntries.mockResolvedValue([
      entry(1, '2026-11-15'),
      entry(2, '2026-11-18', { isArchived: true }),
      entry(3, '2026-11-20', { words: 0, content: '' }),
      entry(4, '2026-11-21'),
    ]);
    reflectionRepository.findOne.mockResolvedValue(saved('2026-11-15'));

    await expect(service.getWeek(7, '2026-11-21', 3)).resolves.toEqual({
      weekStart: '2026-11-15',
      weekEnd: '2026-11-21',
      entries: 2,
      reflection: {
        weekStart: '2026-11-08',
        weekEnd: '2026-11-15',
        themes: ['garden'],
        summary: 'Calm.',
        question: 'What next?',
        analyzedEntries: 2,
        generatedAt: '2026-11-14T08:00:00.000Z',
      },
      aiAvailable: true,
    });
    expect(yearReviewService.assertOwnedDiary).toHaveBeenCalledWith(7, 3);
    expect(yearReviewService.loadEntries).toHaveBeenCalledWith(7, { from: '2026-11-15', to: '2026-11-21' }, 3, { leaveLockedOut: true, forAi: true });
    expect(reflectionRepository.findOne).toHaveBeenCalledWith({ where: { userId: 7, diaryId: 3 } });
  });

  it('leaves out a reflection from an earlier week, or one dated after the writer’s day', async () => {
    yearReviewService.loadEntries.mockResolvedValue([]);
    aiCredentialsService.getStatus.mockResolvedValue({ aiAvailable: false });

    reflectionRepository.findOne.mockResolvedValueOnce(saved('2026-11-14'));
    await expect(service.getWeek(7, '2026-11-21')).resolves.toMatchObject({ entries: 0, reflection: null, aiAvailable: false });
    reflectionRepository.findOne.mockResolvedValueOnce(saved('2026-11-22'));
    await expect(service.getWeek(7, '2026-11-21')).resolves.toMatchObject({ reflection: null });
    expect(reflectionRepository.findOne).toHaveBeenCalledWith({ where: { userId: 7, diaryId: IsNull() } });
  });

  it('sends up to 21 plain-text entries spread across the week and keeps the reflection in place of the old one', async () => {
    yearReviewService.loadEntries.mockResolvedValue([
      ...Array.from({ length: 30 }, (_, index) => entry(index + 1, '2026-11-20')),
      entry(40, '2026-11-21', { content: 'x'.repeat(1500) }),
    ]);
    aiWeeklyReflectionService.reflect.mockResolvedValue(reading);

    await expect(service.generate(7, '2026-11-21', 3)).resolves.toEqual({
      weekStart: '2026-11-15',
      weekEnd: '2026-11-21',
      ...reading,
      analyzedEntries: 21,
      generatedAt: '2026-11-21T18:00:00.000Z',
    });
    const [, week, sent] = aiWeeklyReflectionService.reflect.mock.calls[0] as [number, unknown, Array<{ date: string; text: string }>];
    expect(week).toEqual({ from: '2026-11-15', to: '2026-11-21' });
    expect(sent).toHaveLength(21);
    expect(sent[0]).toEqual({ date: '2026-11-20', text: 'Entry 1 about the garden.' });
    expect(sent[20]?.text.length).toBeLessThanOrEqual(1001);
    expect(manager.delete).toHaveBeenCalledWith(WeeklyReflection, { userId: 7, diaryId: 3 });
    expect(manager.create).toHaveBeenCalledWith(WeeklyReflection, expect.objectContaining({ userId: 7, diaryId: 3, weekStart: '2026-11-15', weekEnd: '2026-11-21', analyzedEntries: 21 }));
  });

  it('reflects on all diaries when none is named', async () => {
    yearReviewService.loadEntries.mockResolvedValue([entry(1, '2026-11-21')]);
    aiWeeklyReflectionService.reflect.mockResolvedValue(reading);

    await service.generate(7, '2026-11-21');

    expect(manager.delete).toHaveBeenCalledWith(WeeklyReflection, { userId: 7, diaryId: IsNull() });
    expect(manager.create).toHaveBeenCalledWith(WeeklyReflection, expect.objectContaining({ diaryId: null }));
  });

  it('refuses a week without entries to read, an answer it cannot use, and another writer’s diary', async () => {
    yearReviewService.loadEntries.mockResolvedValue([entry(1, '2026-11-20', { isArchived: true })]);
    await expectApiError(service.generate(7, '2026-11-21'), BadRequestException, 'REVIEW_WEEK_EMPTY');

    yearReviewService.loadEntries.mockResolvedValue([entry(1, '2026-11-20')]);
    aiWeeklyReflectionService.reflect.mockResolvedValue(null);
    await expectApiError(service.generate(7, '2026-11-21'), ServiceUnavailableException, 'REVIEW_REFLECTION_UNAVAILABLE');
    expect(dataSource.transaction).not.toHaveBeenCalled();

    yearReviewService.assertOwnedDiary.mockRejectedValue(new NotFoundException());
    await expect(service.generate(7, '2026-11-21', 99)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getWeek(7, '2026-11-21', 99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
