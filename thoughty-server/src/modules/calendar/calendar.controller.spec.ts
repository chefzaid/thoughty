import { CalendarController } from './calendar.controller';

describe('CalendarController', () => {
  const calendarService = {
    summary: jest.fn(),
    eventsOn: jest.fn(),
    eventsOnDays: jest.fn(),
    import: jest.fn(),
    clear: jest.fn(),
  };
  const controller = new CalendarController(calendarService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('passes every call on for the signed-in writer', async () => {
    calendarService.summary.mockResolvedValue({ eventCount: 0, lastImportedAt: null, limit: 10000 });
    calendarService.eventsOn.mockResolvedValue({ events: [] });
    calendarService.eventsOnDays.mockResolvedValue({ days: [] });
    calendarService.import.mockResolvedValue({ imported: 1, skippedRecurring: 0, eventCount: 1 });
    calendarService.clear.mockResolvedValue({ success: true });
    const file = { buffer: Buffer.from('BEGIN:VCALENDAR') } as Express.Multer.File;

    await expect(controller.summary(user as never)).resolves.toEqual({ eventCount: 0, lastImportedAt: null, limit: 10000 });
    expect(calendarService.summary).toHaveBeenCalledWith(7);

    await expect(controller.events(user as never, { date: '2026-11-22', timeZone: 'Europe/Paris' })).resolves.toEqual({ events: [] });
    expect(calendarService.eventsOn).toHaveBeenCalledWith(7, '2026-11-22', 'Europe/Paris');

    await expect(controller.days(user as never, { dates: ['2026-11-20', '2026-11-22'], timeZone: 'Europe/Paris' })).resolves.toEqual({ days: [] });
    expect(calendarService.eventsOnDays).toHaveBeenCalledWith(7, ['2026-11-20', '2026-11-22'], 'Europe/Paris');

    await expect(controller.import(user as never, { timeZone: 'Europe/Paris' }, file)).resolves.toEqual({ imported: 1, skippedRecurring: 0, eventCount: 1 });
    expect(calendarService.import).toHaveBeenCalledWith(7, file, 'Europe/Paris');

    await expect(controller.clear(user as never)).resolves.toEqual({ success: true });
    expect(calendarService.clear).toHaveBeenCalledWith(7);
  });
});
