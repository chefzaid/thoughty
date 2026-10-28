import { EventEmitter } from 'node:events';
import { Request, Response } from 'express';
import { JsonLogger } from './json-logger.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';

function createResponse(statusCode: number): Response & EventEmitter & { headers: Record<string, string> } {
  const response = new EventEmitter() as Response & EventEmitter & { headers: Record<string, string> };
  response.statusCode = statusCode;
  response.headers = {};
  response.setHeader = jest.fn((name: string, value: string) => {
    response.headers[name] = value;
    return response;
  }) as never;
  return response;
}

describe('RequestLoggingMiddleware', () => {
  let logger: Pick<JsonLogger, 'error' | 'log' | 'warn'>;
  let httpMetrics: { record: jest.Mock };
  let featureTelemetry: { record: jest.Mock };
  let middleware: RequestLoggingMiddleware;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
    httpMetrics = { record: jest.fn() };
    featureTelemetry = { record: jest.fn() };
    middleware = new RequestLoggingMiddleware(logger as JsonLogger, httpMetrics as never, featureTelemetry as never);
  });

  it('logs successful requests with request id, route, latency, and user id', () => {
    const req = {
      headers: { 'x-request-id': 'req-123' },
      method: 'GET',
      originalUrl: '/api/entries?search=private',
      user: { userId: 42 },
    } as unknown as Request;
    const res = createResponse(200);
    const next = jest.fn();

    middleware.use(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(logger.log).toHaveBeenCalledWith(
      'HTTP request completed',
      expect.objectContaining({
        requestId: 'req-123',
        method: 'GET',
        path: '/api/entries',
        statusCode: 200,
        userId: 42,
        latencyMs: expect.any(Number),
      }),
      RequestLoggingMiddleware.name,
    );
    expect(httpMetrics.record).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/entries',
      statusCode: 200,
      latencyMs: expect.any(Number),
    });
    expect(featureTelemetry.record).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/entries',
      statusCode: 200,
    });
  });

  it('names a private share link by its route, never its token', () => {
    const token = 'q3Jm0bX9vN2kR7sT1uW4yZ6aC8eG0iK2mO4qS6uW8yA';
    for (const [url, path] of [
      [`/api/shared/${token}`, '/api/shared/:token'],
      [`/api/shared/${token}/attachments/31?x=1`, '/api/shared/:token/attachments/31'],
    ]) {
      const res = createResponse(404);
      middleware.use({ headers: {}, method: 'GET', originalUrl: url } as unknown as Request, res, jest.fn());
      res.emit('finish');

      expect(logger.warn).toHaveBeenLastCalledWith('HTTP request completed', expect.objectContaining({ path }), RequestLoggingMiddleware.name);
      expect(httpMetrics.record).toHaveBeenLastCalledWith(expect.objectContaining({ path }));
      expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(token);
    }
  });

  it('logs client and server errors at warning/error levels', () => {
    const req = {
      headers: {},
      method: 'POST',
      url: '/api/auth/login',
    } as unknown as Request;

    const clientErrorResponse = createResponse(401);
    middleware.use(req, clientErrorResponse, jest.fn());
    clientErrorResponse.emit('finish');

    expect(logger.warn).toHaveBeenCalledWith(
      'HTTP request completed',
      expect.objectContaining({ statusCode: 401, path: '/api/auth/login' }),
      RequestLoggingMiddleware.name,
    );

    const serverErrorResponse = createResponse(503);
    middleware.use(req, serverErrorResponse, jest.fn());
    serverErrorResponse.emit('finish');

    expect(logger.error).toHaveBeenCalledWith(
      'HTTP request completed',
      expect.objectContaining({ statusCode: 503, path: '/api/auth/login' }),
      RequestLoggingMiddleware.name,
    );
  });

  it('uses the first request id when multiple header values are provided', () => {
    const req = {
      headers: { 'x-request-id': ['req-first', 'req-second'] },
      method: 'GET',
      path: '/api/health',
    } as unknown as Request;
    const res = createResponse(200);

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-first');
    expect(logger.log).toHaveBeenCalledWith(
      'HTTP request completed',
      expect.objectContaining({ requestId: 'req-first', path: '/api/health' }),
      RequestLoggingMiddleware.name,
    );
  });
});
