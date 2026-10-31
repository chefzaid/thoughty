import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every stylesheet ships in the same bundle, so a print rule that targets the whole page (`body *`,
 * `html, body`, `:root`, `*`) or an unnamed `@page` changes the print of every screen of the app.
 * Such rules have to be scoped to a class the printing view sets on `<html>` (or `<body>`) while it
 * is shown, and page sizes go in a named `@page` that view's content selects.
 */
const SRC = import.meta.dirname;

function listStylesheets(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return listStylesheets(path);
    return item.name.endsWith('.css') ? [path] : [];
  });
}

/** The statements of a block: each prelude with its body (`null` for a statement ending with `;`). */
function statements(css) {
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

/** A selector that starts at the document, body or every element without a class or attribute on it. */
const WHOLE_PAGE = /^(?:html|body|:root|\*)(?![\w.#[-])/;

/** The rules that would leak into every print of the app, as readable lines. */
function leakingPrintRules(css, inPrint = false) {
  const leaks = [];
  for (const { prelude, body } of statements(css.replaceAll(/\/\*[\s\S]*?\*\//g, ''))) {
    if (body === null) continue;
    if (/^@page\b/.test(prelude)) {
      // `@page` and `@page :first` apply to every printed page, in print or not
      if (/^@page\s*(?::[\w-]+\s*)*$/.test(prelude)) leaks.push(`unnamed ${prelude}`);
    } else if (prelude.startsWith('@media')) {
      leaks.push(...leakingPrintRules(body, inPrint || /\bprint\b/.test(prelude)));
    } else if (prelude.startsWith('@')) {
      leaks.push(...leakingPrintRules(body, inPrint));
    } else if (inPrint) {
      const selectors = prelude.split(',').map((selector) => selector.trim());
      leaks.push(...selectors.filter((selector) => WHOLE_PAGE.test(selector)).map((selector) => `@media print { ${selector} }`));
    }
  }
  return leaks;
}

describe('print stylesheets', () => {
  it('finds whole-page print rules and unnamed pages', () => {
    const leaking = `
      /* body { color: red } in a comment is fine */
      @media print {
        @page { size: A5; }
        @page :first { margin: 0; }
        html, body { background: #fff; }
        body * { visibility: hidden; }
        :root { color: black; }
        * { box-shadow: none; }
      }
      @media only screen and (min-width: 1px), print { body > nav { display: none; } }
      @page { margin: 1cm; }`;
    expect(leakingPrintRules(leaking)).toEqual([
      'unnamed @page',
      'unnamed @page :first',
      '@media print { html }',
      '@media print { body }',
      '@media print { body * }',
      '@media print { :root }',
      '@media print { * }',
      '@media print { body > nav }',
      'unnamed @page',
    ]);
  });

  it('accepts print rules scoped to a class on the page, named pages and screen rules', () => {
    const scoped = `
      body { margin: 0; }
      @media (max-width: 600px) { body * { font-size: 14px; } }
      @media print {
        @page booklet { size: A5; }
        @page booklet:first { margin: 0; }
        html.booklet-active, html.booklet-active body { background: #fff; }
        body.printing > :not(.sheet) { display: none; }
        .sheet, .sheet * { visibility: visible; }
        @supports (page: x) { html.booklet-active body { page: booklet; } }
        bodyguard { color: black; }
      }`;
    expect(leakingPrintRules(scoped)).toEqual([]);
  });

  it('keeps every print rule in src scoped to the view that prints', () => {
    const files = listStylesheets(SRC);
    expect(files.length).toBeGreaterThan(10);

    const leaks = files.flatMap((file) =>
      leakingPrintRules(readFileSync(file, 'utf8')).map((leak) => `${relative(SRC, file)}: ${leak}`),
    );
    expect(leaks).toEqual([]);
  });
});
