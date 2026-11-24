import { Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  ACCOUNT_ACTIVITY_PAGE_SIZE,
  AccountActivityService,
  accountActivityCutoff,
  NEW_BROWSER_EMAIL_SETTING,
} from './account-activity.service';
import { runWithClientSoftware } from './client-software';

const FIREFOX_LINUX = { browser: 'Firefox', system: 'Linux' };
const user = { id: 4, email: 'writer@example.com' };

function setup() {
  const events = {
    create: jest.fn((row: object) => row),
    save: jest.fn(async (row: object) => ({ id: 9, createdAt: new Date('2026-11-21T09:00:00Z'), ...row })),
    exists: jest.fn().mockResolvedValue(false),
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 3 }),
  };
  const manager = { query: jest.fn().mockResolvedValue([]), getRepository: jest.fn(() => events) };
  Object.assign(events, { manager: { transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)) } });
  const settings = {
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const email = {
    isConfigured: jest.fn().mockReturnValue(true),
    sendRenderedEmail: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn((_key: string, fallback: string) => fallback) };
  const service = new AccountActivityService(events as never, settings as never, email as never, config as never);
  return { events, manager, settings, email, service };
}

describe('AccountActivityService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records an event with the browser and system of the request, never failing what it records', async () => {
    const { events, service } = setup();
    await runWithClientSoftware(FIREFOX_LINUX, () => service.record(4, 'pin_set'));
    expect(events.save).toHaveBeenCalledWith({ userId: 4, kind: 'pin_set', browser: 'Firefox', system: 'Linux' });

    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    events.save.mockRejectedValueOnce(new Error('database down'));
    await expect(service.record(4, 'sign_out')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('Account activity not recorded (sign_out): database down');
    events.save.mockRejectedValueOnce('down');
    await expect(service.record(4, 'sign_out')).resolves.toBeUndefined();
    expect(error).toHaveBeenLastCalledWith('Account activity not recorded (sign_out): unknown error');
  });

  it('emails a sign-in from a browser and system the account has not signed in from before', async () => {
    const { events, manager, settings, email, service } = setup();
    events.exists.mockImplementation(async ({ where }: { where: { browser?: unknown } }) => !('browser' in where));
    settings.findOne.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === 'language' ? { value: 'fr' } : null,
    );

    await runWithClientSoftware(FIREFOX_LINUX, () => service.recordSignIn(user));
    await service.emailsSettled();

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['account_sign_ins', 4]);
    expect(events.exists).toHaveBeenCalledWith({
      where: { userId: 4, kind: 'sign_in', browser: 'Firefox', system: 'Linux' },
    });
    expect(events.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sign_in', browser: 'Firefox' }));
    expect(email.sendRenderedEmail).toHaveBeenCalledWith(
      'writer@example.com',
      expect.objectContaining({ subject: 'Nouvelle connexion à votre compte Thoughty' }),
    );
  });

  it('matches an unknown browser and system as unknown', async () => {
    const { events, service } = setup();
    await service.recordSignIn(user);
    expect(events.exists).toHaveBeenCalledWith({
      where: { userId: 4, kind: 'sign_in', browser: IsNull(), system: IsNull() },
    });
  });

  it.each([
    ['a first sign-in', [false, false], true, true],
    ['a known browser', [true, true], true, true],
    ['an account with the email turned off', [true, false], false, true],
    ['a server without mail', [true, false], true, false],
  ])('sends nothing for %s', async (_label, [before, known], emailOn, mailConfigured) => {
    const { events, settings, email, service } = setup();
    events.exists.mockResolvedValueOnce(known).mockResolvedValueOnce(before);
    settings.findOne.mockResolvedValue(emailOn ? null : { value: 'false' });
    email.isConfigured.mockReturnValue(mailConfigured);

    await service.recordSignIn(user);
    await service.emailsSettled();

    expect(events.save).toHaveBeenCalled();
    expect(email.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('sends nothing to an account without an address, and logs a failed send without the address', async () => {
    const { events, email, service } = setup();
    for (const address of ['', 'user-4@invalid']) {
      events.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      await service.recordSignIn({ id: 4, email: address });
      await service.emailsSettled();
    }
    expect(email.sendRenderedEmail).not.toHaveBeenCalled();

    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    events.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    email.sendRenderedEmail.mockRejectedValueOnce(Object.assign(new Error('to writer@example.com refused'), { responseCode: 550 }));
    await service.recordSignIn(user);
    await service.emailsSettled();
    expect(warn).toHaveBeenCalledWith('New sign-in email not sent to user 4: Error 550');
  });

  it('waits for the emails in flight, before shutting down too', async () => {
    const { events, email, service } = setup();
    events.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    let finishSending!: () => void;
    email.sendRenderedEmail.mockReturnValueOnce(new Promise<void>((resolve) => (finishSending = resolve)));
    await service.recordSignIn(user);

    let settled = false;
    const shutdown = service.beforeApplicationShutdown().then(() => (settled = true));
    await new Promise((resolve) => setImmediate(resolve));
    expect(email.sendRenderedEmail).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishSending();
    await shutdown;
    expect(settled).toBe(true);
    await expect(service.emailsSettled()).resolves.toBeUndefined();
  });

  it('never fails a sign-in it cannot record', async () => {
    const { events, service } = setup();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    events.exists.mockRejectedValue(new Error('database down'));

    await expect(service.recordSignIn(user)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('Account activity not recorded (sign_in): database down');
  });

  it('lists the past year a page at a time, newest first, with the email setting', async () => {
    const { events, settings, service } = setup();
    const now = new Date('2026-11-21T12:00:00Z');
    const rows = Array.from({ length: ACCOUNT_ACTIVITY_PAGE_SIZE + 1 }, (_, index) => ({
      id: 200 - index,
      kind: 'sign_in',
      browser: 'Chrome',
      system: 'Windows',
      createdAt: now,
      userId: 4,
    }));
    events.find.mockResolvedValueOnce(rows);
    settings.findOne.mockResolvedValueOnce({ value: 'false' });

    const page = await service.list(4, undefined, now);

    expect(events.find).toHaveBeenCalledWith({
      where: { userId: 4, createdAt: expect.objectContaining({ _type: 'moreThan', _value: accountActivityCutoff(now) }) },
      order: { id: 'DESC' },
      take: ACCOUNT_ACTIVITY_PAGE_SIZE + 1,
    });
    expect(page.events).toHaveLength(ACCOUNT_ACTIVITY_PAGE_SIZE);
    expect(page.events[0]).toEqual({ id: 200, kind: 'sign_in', browser: 'Chrome', system: 'Windows', createdAt: now });
    expect(page.nextBefore).toBe(200 - ACCOUNT_ACTIVITY_PAGE_SIZE + 1);
    expect(page.newBrowserEmail).toBe(false);

    events.find.mockResolvedValueOnce(rows.slice(0, 2));
    const last = await service.list(4, 151, now);
    expect(events.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: expect.objectContaining({ _type: 'lessThan', _value: 151 }) }) }),
    );
    expect(last.nextBefore).toBeNull();
    expect(last.newBrowserEmail).toBe(true);
  });

  it('lists the past year oldest first for the data download', async () => {
    const { events, service } = setup();
    events.find.mockResolvedValueOnce([{ id: 1, kind: 'pin_set', browser: null, system: null, createdAt: new Date(0), userId: 4 }]);

    await expect(service.listForDownload(4)).resolves.toEqual([
      { id: 1, kind: 'pin_set', browser: null, system: null, createdAt: new Date(0) },
    ]);
    expect(events.find).toHaveBeenCalledWith(expect.objectContaining({ order: { id: 'ASC' } }));
  });

  it('saves the new-browser email setting', async () => {
    const { settings, service } = setup();
    await expect(service.setNewBrowserEmail(4, false)).resolves.toBe(false);
    expect(settings.upsert).toHaveBeenCalledWith(
      { userId: 4, key: NEW_BROWSER_EMAIL_SETTING, value: 'false' },
      ['userId', 'key'],
    );
  });

  it('removes the events older than a year', async () => {
    const { events, service } = setup();
    const now = new Date('2026-11-21T12:00:00Z');
    await expect(service.purgeExpired(now)).resolves.toBe(3);
    expect(events.delete).toHaveBeenCalledWith({
      createdAt: expect.objectContaining({ _type: 'lessThan', _value: new Date('2025-11-21T12:00:00Z') }),
    });
    events.delete.mockResolvedValueOnce({});
    await expect(service.purgeExpired(now)).resolves.toBe(0);
  });
});
