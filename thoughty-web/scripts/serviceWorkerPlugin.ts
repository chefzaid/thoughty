import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import { selectPrecachePaths } from '../src/serviceWorker/precacheManifest.ts';

async function listFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => relative(folder, join(entry.parentPath, entry.name)));
}

/**
 * Writes `/sw.js` once the app is built: `src/serviceWorker/sw.ts` bundled with the build's files to keep
 * offline and a version taken from their contents and `index.html`'s, so every build whose shell changed
 * gets a new worker, which the browser then installs (and a new cache with it). Builds only: the dev server
 * registers no worker.
 */
export function serviceWorkerPlugin(): Plugin {
  let root = '';
  let outDir = '';
  return {
    name: 'thoughty-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const precache = selectPrecachePaths(await listFiles(outDir));
      const hash = createHash('sha256');
      for (const path of ['/index.html', ...precache]) {
        hash.update(path);
        hash.update(await readFile(join(outDir, path)));
      }
      await build({
        entryPoints: [resolve(root, 'src/serviceWorker/sw.ts')],
        outfile: join(outDir, 'sw.js'),
        bundle: true,
        format: 'iife',
        target: 'es2022',
        minify: true,
        legalComments: 'none',
        logLevel: 'warning',
        define: {
          __THOUGHTY_SW_VERSION__: JSON.stringify(hash.digest('hex').slice(0, 16)),
          __THOUGHTY_SW_PRECACHE__: JSON.stringify(precache),
        },
      });
    },
  };
}
