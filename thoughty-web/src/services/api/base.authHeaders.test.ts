import { describe, expect, it } from 'vitest';
import { buildAuthHeaders } from './base';

const JSON_TYPE = { 'Content-Type': 'application/json' };

describe('buildAuthHeaders', () => {
  it('sends JSON text, and requests without a body, as application/json', () => {
    expect(buildAuthHeaders({ method: 'POST', body: JSON.stringify({ a: 1 }) }, null)).toEqual(JSON_TYPE);
    expect(buildAuthHeaders({}, null)).toEqual(JSON_TYPE);
    expect(buildAuthHeaders({ body: null }, null)).toEqual(JSON_TYPE);
  });

  it.each([
    ['FormData', () => new FormData()],
    ['Blob', () => new Blob(['audio'], { type: 'audio/webm' })],
    ['ArrayBuffer', () => new ArrayBuffer(4)],
    ['typed array', () => new Uint8Array([1, 2])],
    ['URLSearchParams', () => new URLSearchParams({ q: 'sea' })],
    ['ReadableStream', () => new ReadableStream()],
  ])('leaves the content type of a %s body to the browser', (_name, body) => {
    const headers = buildAuthHeaders({ method: 'POST', body: body() }, 'token');

    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain('content-type');
    expect(headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('never overrides a content type the caller set, whatever its case', () => {
    expect(buildAuthHeaders({ body: 'plain words', headers: { 'Content-Type': 'text/plain' } }, null))
      .toEqual({ 'Content-Type': 'text/plain' });
    expect(buildAuthHeaders({ body: '{}', headers: { 'content-type': 'application/merge-patch+json' } }, null))
      .toEqual({ 'content-type': 'application/merge-patch+json' });
  });

  it('keeps the caller headers given as a Headers object or as pairs', () => {
    expect(buildAuthHeaders({ headers: new Headers({ 'X-Trace': '1', 'Content-Type': 'text/csv' }) }, 'token'))
      .toEqual({ 'x-trace': '1', 'content-type': 'text/csv', Authorization: 'Bearer token' });
    expect(buildAuthHeaders({ body: new FormData(), headers: [['X-Trace', '2']] }, null)).toEqual({ 'x-trace': '2' });
  });

  it('adds the bearer token only when there is one', () => {
    expect(buildAuthHeaders({ body: '{}' }, 'abc')).toEqual({ ...JSON_TYPE, Authorization: 'Bearer abc' });
    expect(buildAuthHeaders({ body: '{}' }, null)).not.toHaveProperty('Authorization');
  });
});
