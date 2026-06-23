const createClient = jest.fn();

jest.mock('redis', () => ({
  createClient: (options: unknown) => createClient(options),
}));

describe('createThrottlerModuleOptions', () => {
  beforeEach(() => {
    jest.resetModules();
    createClient.mockReset();
  });

  it('uses process-local throttling when Redis is not configured', async () => {
    const { createThrottlerModuleOptions } = await import('./rate-limiting.options');

    expect(createThrottlerModuleOptions({})).toEqual([
      {
        name: 'default',
        limit: 100,
        ttl: 900000,
      },
    ]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses Redis storage when REDIS_URL is configured', async () => {
    createClient.mockReturnValue({ isOpen: false, connect: jest.fn(), eval: jest.fn(), quit: jest.fn() });
    const { createThrottlerModuleOptions } = await import('./rate-limiting.options');

    const options = createThrottlerModuleOptions({ REDIS_URL: 'redis://redis:6379/0' });

    expect(Array.isArray(options)).toBe(false);
    expect(options).toHaveProperty('storage');
    expect((options as { storage: unknown }).storage?.constructor.name).toBe('RedisThrottlerStorage');
    expect(options).toHaveProperty('throttlers', [{ name: 'default', limit: 100, ttl: 900000 }]);
    expect(createClient).toHaveBeenCalledWith({
      url: 'redis://redis:6379/0',
      password: undefined,
      database: 0,
      socket: undefined,
    });
  });

  it('builds host-based Redis options when REDIS_HOST is configured', async () => {
    createClient.mockReturnValue({ isOpen: false, connect: jest.fn(), eval: jest.fn(), quit: jest.fn() });
    const { createThrottlerModuleOptions } = await import('./rate-limiting.options');

    createThrottlerModuleOptions({
      REDIS_HOST: 'redis',
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'secret',
      REDIS_DB: '2',
      REDIS_TLS: 'true',
    });

    expect(createClient).toHaveBeenCalledWith({
      url: undefined,
      password: 'secret',
      database: 2,
      socket: {
        host: 'redis',
        port: 6380,
        tls: true,
      },
    });
  });
});
