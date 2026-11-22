import { createAccountActivityMock } from '@/modules/auth/account-activity/account-activity.test-helpers';
import { UserDataExportService } from './user-data-export.service';

/** A repository with nothing in it, for the parts of the download this spec does not look at. */
const emptyRepository = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  query: jest.fn().mockResolvedValue([]),
});

describe('UserDataExportService imported calendar events', () => {
  it('lists every imported event, oldest import first, with its UID and how a repeating one repeats', async () => {
    const calendarEvents = emptyRepository();
    const importedAt = new Date('2026-11-21T18:00:00Z');
    const startsAt = new Date('2026-11-22T19:30:00Z');
    const recurrence = { rule: { freq: 'YEARLY', interval: 1, weekStart: 1 }, until: null, rdates: [], exdates: ['2027-03-01'], timeZone: 'UTC' };
    calendarEvents.find.mockResolvedValue([
      { id: 4, userId: 1, uid: 'dinner@example', summary: 'Dinner', location: 'Lyon', allDay: false, startsAt, endsAt: startsAt, startDate: null, endDate: null, recurrence: null, createdAt: importedAt, updatedAt: importedAt },
      { id: 5, userId: 1, uid: 'birthday@example', summary: 'Birthday', location: null, allDay: true, startsAt: null, endsAt: null, startDate: '2026-03-01', endDate: '2026-03-01', recurrence, createdAt: importedAt, updatedAt: importedAt },
    ]);
    // Constructor order: 19 repositories, the time capsules service, seven more, the account activity, four more, then the calendar events
    const Service = UserDataExportService as unknown as new (...dependencies: unknown[]) => UserDataExportService;
    const service = new Service(
      ...Array.from({ length: 19 }, emptyRepository),
      { reveal: jest.fn(async (rows: unknown[]) => rows) },
      ...Array.from({ length: 7 }, emptyRepository),
      createAccountActivityMock(),
      ...Array.from({ length: 4 }, emptyRepository),
      calendarEvents,
    );

    const data = await service.downloadData(1);

    expect(data.calendarEvents).toEqual([
      { uid: 'dinner@example', summary: 'Dinner', location: 'Lyon', allDay: false, startsAt, endsAt: startsAt, startDate: null, endDate: null, recurrence: null, importedAt, updatedAt: importedAt },
      { uid: 'birthday@example', summary: 'Birthday', location: null, allDay: true, startsAt: null, endsAt: null, startDate: '2026-03-01', endDate: '2026-03-01', recurrence, importedAt, updatedAt: importedAt },
    ]);
    expect(calendarEvents.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC', id: 'ASC' } });
  });
});
