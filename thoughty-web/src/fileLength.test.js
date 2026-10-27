import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The most lines a source file may have before it has to be split by responsibility. */
const MAX_LINES = 500;
const SRC = import.meta.dirname;
/** Written by `npm run api:types`, never by hand. */
const GENERATED = join(SRC, 'generated');

function listSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return path === GENERATED ? [] : listSourceFiles(path);
    return /\.(ts|tsx|css)$/.test(item.name) ? [path] : [];
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

  it(`keeps every TypeScript and CSS file in src at ${MAX_LINES} lines or fewer`, () => {
    const files = listSourceFiles(SRC);
    expect(files.length).toBeGreaterThan(100);

    const tooLong = files
      .map((file) => ({ file: relative(SRC, file), lines: countLines(readFileSync(file, 'utf8')) }))
      .filter(({ lines }) => lines > MAX_LINES)
      .map(({ file, lines }) => `${file}: ${lines} lines`);
    expect(tooLong).toEqual([]);
  });
});
