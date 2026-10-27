import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeJsonParse, readApiErrorMessage, createAuthFetch } from './base';

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

describe('readApiErrorMessage', () => {
  it('reads the error field from structured API failures', async () => {
    const response = new Response(JSON.stringify({ error: 'Email already registered' }), { status: 409 });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Email already registered');
  });

  it('joins validation message arrays into a readable sentence', async () => {
    const response = new Response(JSON.stringify({ message: ['email must be valid', 'password is too short'] }), {
      status: 400,
    });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe(
      'email must be valid, password is too short'
    );
  });

  it('extracts nested detail messages when available', async () => {
    const response = new Response(JSON.stringify({ details: { name: 'Name is required' } }), { status: 400 });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Name is required');
  });

  it('uses plain text response bodies before the fallback', async () => {
    const response = new Response('Request entity too large', { status: 413 });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Request entity too large');
  });

  it('falls back when the response has no readable error body', async () => {
    const response = new Response('', { status: 500 });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('prefers the NestJS message over its status name', async () => {
    const response = new Response(
      JSON.stringify({ statusCode: 404, message: 'Feature request not found', error: 'Not Found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Feature request not found');
  });

  it.each([
    ['an empty object', '{}'],
    ['only a status code', '{"statusCode":503}'],
    ['a blank message', '{"message":"   "}'],
    ['an empty message list', '{"message":[]}'],
    ['a message list without text', '{"message":[null, 4, ""]}'],
    ['a numeric message', '{"message":503}'],
    ['a top-level array', '["x"]'],
    ['JSON null', 'null'],
    ['a JSON number', '503'],
  ])('falls back when a JSON body has %s', async (_shape, body) => {
    const response = new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('reads a JSON string body as the message', async () => {
    const response = new Response(JSON.stringify('Too many requests'), { status: 429 });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Too many requests');
  });

  it('falls back on a whitespace-only body', async () => {
    await expect(readApiErrorMessage(new Response('  \n ', { status: 502 }), 'Fallback')).resolves.toBe('Fallback');
  });

  it('falls back on an HTML error page', async () => {
    const response = new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('falls back on markup even without an HTML content type', async () => {
    const response = new Response('<!DOCTYPE html><title>Error</title>', { status: 500 });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('falls back on text sent with an HTML content type', async () => {
    const response = new Response('Service Unavailable', { status: 503, headers: { 'Content-Type': 'text/html' } });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('falls back for a missing response', async () => {
    await expect(readApiErrorMessage(null, 'Fallback')).resolves.toBe('Fallback');
  });

  it('reads a response stand-in that only offers json()', async () => {
    const response = { json: () => Promise.resolve({}) } as unknown as Response;

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('falls back when a stand-in has neither JSON nor text', async () => {
    const response = { json: () => Promise.reject(new Error('no body')) } as unknown as Response;

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
  });

  it('falls back when reading the text fails', async () => {
    const response = {
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.reject(new Error('stream broken')),
    } as unknown as Response;

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('Fallback');
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

  it('falls back to fetch without a JSON content type for a multipart body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const body = new FormData();

    await createAuthFetch(undefined, () => 'token')('/api/attachments/upload', { method: 'POST', body });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/attachments/upload', {
      method: 'POST',
      body,
      headers: { Authorization: 'Bearer token' },
    });
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
