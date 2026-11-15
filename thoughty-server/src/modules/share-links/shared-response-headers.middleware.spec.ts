import type { Request, Response } from 'express';
import { SHARED_RESPONSE_HEADERS, SHARED_ROUTES_PATH, sharedResponseHeaders } from './shared-response-headers.middleware';

describe('sharedResponseHeaders', () => {
  it('marks every shared answer uncached, unindexed, without referrer and same-origin only', () => {
    expect(SHARED_RESPONSE_HEADERS).toEqual({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    expect(SHARED_ROUTES_PATH).toBe('/api/shared');
  });

  it('sets the headers before passing the request on, replacing what an earlier middleware set', () => {
    const headers: Record<string, string> = { 'Referrer-Policy': 'strict-origin', 'Cross-Origin-Resource-Policy': 'cross-origin' };
    const res = { setHeader: jest.fn((name: string, value: string) => { headers[name] = value; }) };
    const next = jest.fn(() => expect(headers).toEqual(SHARED_RESPONSE_HEADERS));

    sharedResponseHeaders({} as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
