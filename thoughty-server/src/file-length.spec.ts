import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The most lines a source file may have before it has to be split by responsibility. */
const MAX_LINES = 500;
/** The app's own folder: `src`, the contract specs in `test`, `scripts` and the config files. */
const ROOT = join(__dirname, '..');
/** Installed, built or generated, never written by hand. */
const OUTPUT_DIRS = new Set(['node_modules', 'dist', 'coverage']);
/** Migrations are frozen once released, so they keep the length they were written with. */
const MIGRATIONS = join(ROOT, 'src', 'database', 'migrations');

function listCodeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      const skipped = item.name.startsWith('.') || OUTPUT_DIRS.has(item.name) || path === MIGRATIONS;
      return skipped ? [] : listCodeFiles(path);
    }
    return /\.(ts|js|mjs|cjs)$/.test(item.name) ? [path] : [];
  });
}

/** Lines as `wc -l` and editors count them: a final newline does not start another line. */
function countLines(text: string): number {
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

  it(`keeps every code file of the app, specs included, at ${MAX_LINES} lines or fewer`, () => {
    const files = listCodeFiles(ROOT);
    expect(files.length).toBeGreaterThan(100);
    // The contract specs and the scripts outside src are checked too
    expect(files).toContain(join(ROOT, 'test', 'api-contract', 'contract-operations.ts'));
    expect(files).toContain(join(ROOT, 'scripts', 'seed.ts'));
    expect(files).toContain(join(ROOT, 'eslint.config.mjs'));

    const tooLong = files
      .map((file) => ({ file: relative(ROOT, file), lines: countLines(readFileSync(file, 'utf8')) }))
      .filter(({ lines }) => lines > MAX_LINES)
      .map(({ file, lines }) => `${file}: ${lines} lines`);
    expect(tooLong).toEqual([]);
  });
});
