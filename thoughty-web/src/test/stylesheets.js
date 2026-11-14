import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir` whose name ends with one of `extensions`, in every folder below it. */
export function listFiles(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return listFiles(path, extensions);
    return extensions.some((extension) => item.name.endsWith(extension)) ? [path] : [];
  });
}

/** Every stylesheet under `dir`. */
export function listStylesheets(dir) {
  return listFiles(dir, ['.css']);
}

/** A stylesheet without its comments. */
export function withoutComments(css) {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
}

/** The statements of a block: each prelude with its body (`null` for a statement ending with `;`). */
export function statements(css) {
  const found = [];
  let start = 0;
  let index = 0;
  while (index < css.length) {
    const char = css[index];
    if (char === ';') {
      found.push({ prelude: css.slice(start, index).trim(), body: null });
      start = index + 1;
    } else if (char === '{') {
      let depth = 1;
      let end = index + 1;
      while (end < css.length && depth > 0) {
        if (css[end] === '{') depth += 1;
        if (css[end] === '}') depth -= 1;
        end += 1;
      }
      found.push({ prelude: css.slice(start, index).trim(), body: css.slice(index + 1, end - 1) });
      start = end;
      index = end - 1;
    }
    index += 1;
  }
  return found;
}

/** Every `@keyframes` block of a stylesheet, those inside `@media` or `@supports` included: its name and body. */
export function keyframeBlocks(css) {
  return statements(withoutComments(css)).flatMap(({ prelude, body }) => {
    if (body === null) return [];
    const name = /^@keyframes\s+([\w-]+)/.exec(prelude)?.[1];
    if (name) return [{ name, body }];
    return prelude.startsWith('@') ? keyframeBlocks(body) : [];
  });
}
