import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The most lines a source file may have before it has to be split by responsibility. */
const MAX_LINES = 500;
/** The app's own folder: `src`, the Playwright specs in `e2e`, `scripts` and the config files. */
const ROOT = join(import.meta.dirname, '..');
/** Installed, built or written by a test run, never by hand. */
const OUTPUT_DIRS = new Set(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report']);
/** Written by `npm run api:types`, never by hand. */
const GENERATED = join(ROOT, 'src', 'generated');

function listSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      const skipped = item.name.startsWith('.') || OUTPUT_DIRS.has(item.name) || path === GENERATED;
      return skipped ? [] : listSourceFiles(path);
    }
    return /\.(ts|tsx|js|jsx|mjs|cjs|css)$/.test(item.name) ? [path] : [];
  });
}

/** Lines as `wc -l` and editors count them: a final newline does not start another line. */
function countLines(text) {
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

describe('source file length', () => {
  it('counts lines like wc -l', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\n\nb\n')).toBe(3);
  });

  it(`keeps every code and CSS file of the app, specs included, at ${MAX_LINES} lines or fewer`, () => {
    const files = listSourceFiles(ROOT);
    expect(files.length).toBeGreaterThan(100);
    // The Playwright specs and the scripts outside src are checked too
    expect(files).toContain(join(ROOT, 'e2e', 'support', 'mockApp.shared.ts'));
    expect(files).toContain(join(ROOT, 'scripts', 'check-api-usage.mjs'));
    expect(files).toContain(join(ROOT, 'vite.config.ts'));

    const tooLong = files
      .map((file) => ({ file: relative(ROOT, file), lines: countLines(readFileSync(file, 'utf8')) }))
      .filter(({ lines }) => lines > MAX_LINES)
      .map(({ file, lines }) => `${file}: ${lines} lines`);
    expect(tooLong).toEqual([]);
  });
});
