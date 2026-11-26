import { describe, expect, it, vi } from 'vitest';

import { searchEngineFilesPlugin } from '../scripts/searchEngineFilesPlugin';
import { SITE_ORIGIN_PLACEHOLDER } from './utils/searchEngineFiles';

// A JavaScript spec, like securityHeaders.test.js: the plugin runs in Node, whose types the app's type check leaves out
describe('search engine files plugin', () => {
  it('writes the three files into the build with the placeholder NGINX fills in, and serves them in dev with the request’s address', () => {
    const plugin = searchEngineFilesPlugin();
    const emitFile = vi.fn();
    plugin.generateBundle.call({ emitFile });
    expect(emitFile.mock.calls.map(([file]) => [file.fileName, file.source.includes(`${SITE_ORIGIN_PLACEHOLDER}/`)])).toEqual([
      ['sitemap.xml', true],
      ['robots.txt', true],
      ['.well-known/security.txt', true],
    ]);

    const use = vi.fn();
    plugin.configureServer({ middlewares: { use } });
    plugin.configurePreviewServer({ middlewares: { use } });
    const middleware = use.mock.calls[0]?.[0];
    expect(use.mock.calls[1]?.[0]).toBe(middleware);

    const response = { setHeader: vi.fn(), end: vi.fn() };
    middleware({ url: '/robots.txt?x=1', headers: { host: 'localhost:5173' } }, response, vi.fn());
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(response.end.mock.calls[0]?.[0]).toContain('Sitemap: http://localhost:5173/sitemap.xml');

    middleware({ url: '/sitemap.xml', headers: {} }, response, vi.fn());
    expect(response.end.mock.calls[1]?.[0]).toContain('<loc>http://localhost/</loc>');

    middleware({ url: '/.well-known/security.txt', headers: { host: 'localhost:5173' } }, response, vi.fn());
    expect(response.setHeader).toHaveBeenLastCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(response.end.mock.calls[2]?.[0]).toContain('Contact: http://localhost:5173/contact\n');

    const next = vi.fn();
    middleware({ url: '/about', headers: {} }, response, next);
    expect(next).toHaveBeenCalled();
  });
});
