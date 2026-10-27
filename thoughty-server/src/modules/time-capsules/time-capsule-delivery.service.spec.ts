import { Logger } from '@nestjs/common';
import { TimeCapsule } from '@/database/entities';
import { TimeCapsuleDeliveryService } from './time-capsule-delivery.service';

interface DueRow {
  id: number;
  email: string | null;
  email_verified: boolean;
}

describe('TimeCapsuleDeliveryService', () => {
  const now = new Date('2027-10-27T07:00:20Z');
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let capsules: { findOneByOrFail: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let timeCapsuleService: { openCapsule: jest.Mock };
  let configService: { getConfig: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendRenderedEmail: jest.Mock };
  let service: TimeCapsuleDeliveryService;

  const capsule = (id: number, userId = 3) =>
    ({ id, userId, entryId: id + 10, timeZone: 'Europe/Paris', createdAt: new Date('2026-10-27T09:00:00Z') }) as TimeCapsule;
  const withBatches = (...batches: DueRow[][]) => {
    for (const batch of batches) manager.query.mockResolvedValueOnce(batch);
    manager.query.mockResolvedValue([]);
  };

  beforeEach(() => {
    capsules = { findOneByOrFail: jest.fn(async ({ id }: { id: number }) => capsule(id)) };
    manager = { query: jest.fn(), getRepository: jest.fn(() => capsules) };
    dataSource = { transaction: jest.fn((work: (m: unknown) => unknown) => work(manager)) };
    timeCapsuleService = {
      openCapsule: jest.fn(async (_manager: unknown, { entryId }: TimeCapsule) => ({
        id: entryId, date: '2026-10-27', title: 'Dear future me', content: 'Remember the harbor.',
      })),
    };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'fr' }) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true), sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
    const nestConfig = { get: jest.fn((_key: string, fallback: string) => fallback) };
    service = new TimeCapsuleDeliveryService(
      dataSource as never,
      timeCapsuleService as never,
      configService as never,
      emailService as never,
      nestConfig as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('opens the due capsules of live entries and accounts and emails each to its verified address in the writer’s language', async () => {
    withBatches([{ id: 1, email: 'writer@example.com', email_verified: true }]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain('tc.opened_at IS NULL AND tc.open_at <= $1');
    expect(sql).toContain('JOIN entries e ON e.id = tc.entry_id AND e.deleted_at IS NULL');
    expect(sql).toContain('JOIN users u ON u.id = tc.user_id AND u.deleted_at IS NULL');
    expect(sql).toContain('FOR UPDATE OF tc SKIP LOCKED');
    expect(params).toEqual([now, 50]);
    expect(timeCapsuleService.openCapsule).toHaveBeenCalledWith(manager, capsule(1), now);
    expect(emailService.sendRenderedEmail).toHaveBeenCalledWith('writer@example.com', expect.objectContaining({
      subject: 'Votre capsule temporelle s’est ouverte',
    }));
    expect(emailService.sendRenderedEmail.mock.calls[0][1].text).toContain('http://localhost:5173/journal?entry=11');
  });

  it('opens capsules without emailing an unverified or missing address, or when this server cannot send email', async () => {
    withBatches([
      { id: 1, email: 'writer@example.com', email_verified: false },
      { id: 2, email: null, email_verified: true },
    ]);
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(timeCapsuleService.openCapsule).toHaveBeenCalledTimes(2);

    emailService.isConfigured.mockReturnValue(false);
    withBatches([{ id: 3, email: 'writer@example.com', email_verified: true }]);
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(timeCapsuleService.openCapsule).toHaveBeenCalledTimes(3);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('works through full batches until one comes back short', async () => {
    const full = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, email: 'w@example.com', email_verified: true }));
    withBatches(full, [{ id: 51, email: 'w@example.com', email_verified: true }]);

    await expect(service.deliverDue(now)).resolves.toBe(51);
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('keeps going when an email fails and logs only the writer’s ID and the error’s name and code', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    withBatches([
      { id: 1, email: 'secret@example.com', email_verified: true },
      { id: 2, email: 'other@example.com', email_verified: true },
    ]);
    emailService.sendRenderedEmail.mockRejectedValueOnce(Object.assign(new Error('550 secret@example.com rejected'), { responseCode: 550 }));
    configService.getConfig.mockResolvedValueOnce({ language: 'en' });

    await expect(service.deliverDue(now)).resolves.toBe(1);
    expect(warn).toHaveBeenCalledWith('Time capsule email for user 3 failed: Error 550');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret@example.com');
  });

  it('names an error without a reply code by its name, or as unknown', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    withBatches([{ id: 1, email: 'w@example.com', email_verified: true }]);
    emailService.sendRenderedEmail.mockRejectedValueOnce('down');

    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(warn).toHaveBeenCalledWith('Time capsule email for user 3 failed: unknown error');
  });

  it('reads the sealing day in UTC when the stored zone is no longer known', async () => {
    capsules.findOneByOrFail.mockResolvedValueOnce({ ...capsule(1), timeZone: 'Gone/Zone', createdAt: new Date('2026-10-27T23:30:00Z') });
    configService.getConfig.mockResolvedValueOnce({ language: 'en' });
    withBatches([{ id: 1, email: 'w@example.com', email_verified: true }]);

    await service.deliverDue(now);
    expect(emailService.sendRenderedEmail.mock.calls[0][1].text).toContain('On October 27, 2026, you sealed');
  });
});
