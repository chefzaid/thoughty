import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeJsonParse, createAuthFetch } from './base';

describe('safeJsonParse', () => {
  it('returns null for null response', async () => {
    const result = await safeJsonParse(null);
    expect(result).toBeNull();
  });

  it('returns null for undefined response', async () => {
    const result = await safeJsonParse(undefined);
    expect(result).toBeNull();
  });

  it('parses valid JSON response', async () => {
    const response = new Response(JSON.stringify({ key: 'value' }));
    const result = await safeJsonParse(response);
    expect(result).toEqual({ key: 'value' });
  });

  it('returns null for invalid JSON text', async () => {
    const response = {
      json: () => Promise.reject(new Error('invalid')),
      text: () => Promise.resolve('not json'),
    } as unknown as Response;
    // safeJsonParse tries json first, catches, then tries text → JSON.parse
    const result = await safeJsonParse(response);
    expect(result).toBeNull();
  });

  it('returns null for empty text response', async () => {
    const response = {
      json: () => Promise.reject(new Error('no json')),
      text: () => Promise.resolve(''),
    } as unknown as Response;
    const result = await safeJsonParse(response);
    expect(result).toBeNull();
  });

  it('parses JSON from text fallback when json method is not a function', async () => {
    const data = { fallback: true };
    const response = {
      json: 'not a function',
      text: () => Promise.resolve(JSON.stringify(data)),
    } as unknown as Response;
    const result = await safeJsonParse(response);
    expect(result).toEqual(data);
  });
});

describe('createAuthFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses authFetch when provided and it returns a response', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const authFetch = vi.fn().mockResolvedValue(mockResponse);
    const fetcher = createAuthFetch(authFetch, undefined);

    const result = await fetcher('/api/test');
    expect(authFetch).toHaveBeenCalledWith('/api/test', {});
    expect(result).toBe(mockResponse);
  });

  it('falls back to fetch with token when authFetch is undefined', async () => {
    const mockResponse = new Response('ok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);
    const getAccessToken = vi.fn().mockReturnValue('my-token');

    const fetcher = createAuthFetch(undefined, getAccessToken);
    const result = await fetcher('/api/test');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-token',
      }),
    }));
    expect(result).toBe(mockResponse);
  });

  it('falls back to fetch without token when getAccessToken returns null', async () => {
    const mockResponse = new Response('ok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);
    const getAccessToken = vi.fn().mockReturnValue(null);

    const fetcher = createAuthFetch(undefined, getAccessToken);
    await fetcher('/api/test');

    const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1]?.headers;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('falls back to fetch when getAccessToken is undefined', async () => {
    const mockResponse = new Response('ok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const fetcher = createAuthFetch(undefined, undefined);
    await fetcher('/api/test');

    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('falls back to native fetch when authFetch returns non-response', async () => {
    const authFetch = vi.fn().mockResolvedValue(undefined);
    const mockResponse = new Response('ok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);
    const getAccessToken = vi.fn().mockReturnValue('token');

    const fetcher = createAuthFetch(authFetch, getAccessToken);
    const result = await fetcher('/api/test');

    expect(authFetch).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(result).toBe(mockResponse);
  });

  it('passes custom options to fetch', async () => {
    const mockResponse = new Response('ok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const fetcher = createAuthFetch(undefined, undefined);
    await fetcher('/api/test', { method: 'POST', body: '{}' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      body: '{}',
    }));
  });
});
