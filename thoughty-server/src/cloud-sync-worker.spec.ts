async function flushBootstrap(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('cloud-sync-worker bootstrap', () => {
  const originalExit = process.exit;

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    process.exit = originalExit;
  });

  it('starts the worker and registers shutdown handlers', async () => {
    const handlers: Record<string, () => void> = {};
    const logger = { log: jest.fn(), error: jest.fn() };
    const start = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const app = { close, get: jest.fn().mockReturnValue({ start }) };
    const createApplicationContext = jest.fn().mockResolvedValue(app);
    const FakeAppModule = class {};
    const FakeWorkerService = class {};

    jest.spyOn(process, 'once').mockImplementation(((signal: string, handler: () => void) => {
      handlers[signal] = handler;
      return process;
    }) as never);
    process.exit = jest.fn() as never;

    jest.doMock('@nestjs/core', () => ({ NestFactory: { createApplicationContext } }));
    jest.doMock('./app.module', () => ({ AppModule: FakeAppModule }));
    jest.doMock('./common', () => ({ JsonLogger: jest.fn(() => logger) }));
    jest.doMock('./modules/cloud-sync/cloud-sync-worker.service', () => ({ CloudSyncWorkerService: FakeWorkerService }));

    await import('./cloud-sync-worker');
    await flushBootstrap();

    expect(createApplicationContext).toHaveBeenCalledWith(FakeAppModule, {
      logger,
    });
    expect(app.get).toHaveBeenCalledWith(FakeWorkerService);
    expect(start).toHaveBeenCalled();
    expect(typeof handlers.SIGINT).toBe('function');
    expect(typeof handlers.SIGTERM).toBe('function');

    handlers.SIGINT();
    await flushBootstrap();

    expect(logger.log).toHaveBeenCalledWith('Received SIGINT, shutting down cloud sync worker');
    expect(close).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('logs startup failures and exits with code 1', async () => {
    const logger = { log: jest.fn(), error: jest.fn() };
    const createApplicationContext = jest.fn().mockRejectedValue(new Error('boom'));

    process.exit = jest.fn() as never;

    jest.doMock('@nestjs/core', () => ({ NestFactory: { createApplicationContext } }));
    jest.doMock('./app.module', () => ({ AppModule: class {} }));
    jest.doMock('./common', () => ({ JsonLogger: jest.fn(() => logger) }));
    jest.doMock('./modules/cloud-sync/cloud-sync-worker.service', () => ({ CloudSyncWorkerService: class {} }));

    await import('./cloud-sync-worker');
    await flushBootstrap();

    expect(logger.error).toHaveBeenCalledWith('Failed to start cloud sync worker', expect.any(String));
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
