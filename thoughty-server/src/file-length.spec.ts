import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The most lines a source file may have before it has to be split by responsibility. */
const MAX_LINES = 500;
const SRC = __dirname;
/** Migrations are frozen once released, so they keep the length they were written with. */
const MIGRATIONS = join(SRC, 'database', 'migrations');

function listTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return path === MIGRATIONS ? [] : listTypeScriptFiles(path);
    return item.name.endsWith('.ts') ? [path] : [];
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

  it(`keeps every TypeScript file in src at ${MAX_LINES} lines or fewer`, () => {
    const files = listTypeScriptFiles(SRC);
    expect(files.length).toBeGreaterThan(100);

    const tooLong = files
      .map((file) => ({ file: relative(SRC, file), lines: countLines(readFileSync(file, 'utf8')) }))
      .filter(({ lines }) => lines > MAX_LINES)
      .map(({ file, lines }) => `${file}: ${lines} lines`);
    expect(tooLong).toEqual([]);
  });
});
