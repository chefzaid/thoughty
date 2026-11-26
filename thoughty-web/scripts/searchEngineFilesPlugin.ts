import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { buildRobotsTxt, buildSitemap, SITE_ORIGIN_PLACEHOLDER } from '../src/utils/searchEngineFiles.ts';
import { buildSecurityTxt, SECURITY_TXT_PATH } from '../src/utils/securityTxt.ts';

const FILES: Readonly<Record<string, { readonly type: string; readonly build: (origin: string) => string }>> = {
  '/sitemap.xml': { type: 'application/xml; charset=utf-8', build: buildSitemap },
  '/robots.txt': { type: 'text/plain; charset=utf-8', build: buildRobotsTxt },
  [SECURITY_TXT_PATH]: { type: 'text/plain; charset=utf-8', build: buildSecurityTxt },
};

/** Answers `/sitemap.xml`, `/robots.txt` and `security.txt` on the dev and preview servers, with the address they were asked at. */
function serveWithRequestOrigin(request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction): void {
  const file = FILES[(request.url ?? '').split('?')[0] ?? ''];
  if (!file) {
    next();
    return;
  }
  response.setHeader('Content-Type', file.type);
  response.end(file.build(`http://${request.headers.host ?? 'localhost'}`));
}

/**
 * Writes `sitemap.xml` and `robots.txt` from the localized public pages (`src/utils/searchEngineFiles.ts`),
 * and `.well-known/security.txt` (`src/utils/securityTxt.ts`, valid for a year from the build), into the
 * build, naming the site with a placeholder NGINX fills in with each request's address.
 */
export function searchEngineFilesPlugin(): Plugin {
  return {
    name: 'thoughty-search-engine-files',
    generateBundle() {
      for (const [path, file] of Object.entries(FILES)) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: file.build(SITE_ORIGIN_PLACEHOLDER) });
      }
    },
    configureServer(server) {
      server.middlewares.use(serveWithRequestOrigin);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveWithRequestOrigin);
    },
  };
}
