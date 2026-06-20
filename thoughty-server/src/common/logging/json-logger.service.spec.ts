import { JsonLogger } from './json-logger.service';

describe('JsonLogger', () => {
  let stdoutWrite: jest.SpyInstance;
  let stderrWrite: jest.SpyInstance;

  beforeEach(() => {
    stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes structured JSON logs with context and metadata', () => {
    const logger = new JsonLogger('TestContext');

    logger.log('ready', { requestId: 'req-1', statusCode: 200 });

    expect(stdoutWrite).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(stdoutWrite.mock.calls[0][0] as string);

    expect(payload).toEqual(
      expect.objectContaining({
        level: 'info',
        context: 'TestContext',
        message: 'ready',
        requestId: 'req-1',
        statusCode: 200,
      }),
    );
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  it('redacts sensitive strings and metadata fields', () => {
    const logger = new JsonLogger('Secrets');

    logger.warn('Reset URL https://thoughty.test/reset-password?token=abc123', {
      authorization: 'Bearer abc123',
      nested: { refreshToken: 'secret-refresh-token' },
    });

    expect(stderrWrite).toHaveBeenCalledTimes(1);
    const rawPayload = stderrWrite.mock.calls[0][0] as string;
    const payload = JSON.parse(rawPayload);

    expect(payload.message).toContain('token=[REDACTED]');
    expect(payload.authorization).toBe('[REDACTED]');
    expect(payload.nested.refreshToken).toBe('[REDACTED]');
    expect(rawPayload).not.toContain('abc123');
    expect(rawPayload).not.toContain('secret-refresh-token');
  });

  it('serializes errors, traces, arrays, and deeply nested metadata safely', () => {
    const logger = new JsonLogger('Errors');
    const error = new Error('Failed with password=hunter2');
    error.stack = 'Error: Failed\n    at token=secret';

    logger.error(error, 'Trace with Bearer abc123\n    at caller', {
      attempts: ['token=one', ['password=two', ['secret=three']]],
      nested: { level1: { level2: { value: 'hidden shape' } } },
    });

    expect(stderrWrite).toHaveBeenCalledTimes(1);
    const rawPayload = stderrWrite.mock.calls[0][0] as string;
    const payload = JSON.parse(rawPayload);

    expect(payload.level).toBe('error');
    expect(payload.message).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'Failed with password=[REDACTED]',
      }),
    );
    expect(payload.trace).toBe('Trace with Bearer [REDACTED]\n    at caller');
    expect(payload.attempts).toEqual(['token=[REDACTED]', '[Array]']);
    expect(payload.nested.level1).toBe('[Object]');
    expect(rawPayload).not.toContain('hunter2');
    expect(rawPayload).not.toContain('abc123');
  });

  it('supports debug and verbose logs without metadata', () => {
    const logger = new JsonLogger();

    logger.debug('debug message');
    logger.verbose('verbose message', 'VerboseContext');

    expect(stdoutWrite).toHaveBeenCalledTimes(2);
    expect(JSON.parse(stdoutWrite.mock.calls[0][0] as string)).toEqual(
      expect.objectContaining({
        level: 'debug',
        message: 'debug message',
      }),
    );
    expect(JSON.parse(stdoutWrite.mock.calls[1][0] as string)).toEqual(
      expect.objectContaining({
        level: 'verbose',
        context: 'VerboseContext',
        message: 'verbose message',
      }),
    );
  });

  it('keeps non-object optional params under details', () => {
    const logger = new JsonLogger('Details');

    logger.log('with extras', 1, 'two', false);

    const payload = JSON.parse(stdoutWrite.mock.calls[0][0] as string);
    expect(payload.details).toEqual([1, 'two', false]);
  });
});
