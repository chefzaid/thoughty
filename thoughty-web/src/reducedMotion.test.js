import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listFiles, listStylesheets, statements, withoutComments } from './test/stylesheets';

/**
 * When the system asks for less motion, one rule in `index.css` ends every animation and transition
 * at once (`*`, `*::before`, `*::after`), so no stylesheet has to remember its own guard. These tests
 * keep that rule in place, keep anything from outranking it, and keep scripts from scrolling
 * smoothly past it.
 */
const SRC = import.meta.dirname;
const REDUCE = /prefers-reduced-motion:\s*reduce/;
const MOTION_PROPERTY = /^(?:animation|transition)(?:-[\w-]+)?$/;
/** What an animation kept under reduced motion may change: nothing that moves. */
const STILL_PROPERTIES = new Set(['opacity', 'color', 'background-color', 'border-color', 'box-shadow', 'outline-color']);

/** The declarations of a rule's body (its last one may go without a semicolon). */
function declarations(body) {
  return statements(`${body};`)
    .filter((statement) => statement.body === null && statement.prelude.includes(':'))
    .map(({ prelude }) => {
      const colon = prelude.indexOf(':');
      return { property: prelude.slice(0, colon).trim().toLowerCase(), value: prelude.slice(colon + 1).trim() };
    });
}

/** Every style rule of a stylesheet with its selectors, its declarations and whether reduced motion gates it. */
function styleRules(css, reduced = false) {
  return statements(withoutComments(css)).flatMap(({ prelude, body }) => {
    if (body === null || prelude.startsWith('@keyframes')) return [];
    if (prelude.startsWith('@')) return styleRules(body, reduced || (prelude.startsWith('@media') && REDUCE.test(prelude)));
    return [{ selectors: prelude.split(',').map((selector) => selector.trim()), declarations: declarations(body), reduced }];
  });
}

/** The properties each `@keyframes` of a stylesheet changes, by name. */
function keyframeProperties(css) {
  const found = new Map();
  for (const { prelude, body } of statements(withoutComments(css))) {
    if (body === null) continue;
    const name = /^@keyframes\s+([\w-]+)/.exec(prelude)?.[1];
    if (name) {
      found.set(name, new Set(statements(body).flatMap((frame) => declarations(frame.body ?? '').map(({ property }) => property))));
    } else if (prelude.startsWith('@')) {
      for (const [inner, properties] of keyframeProperties(body)) found.set(inner, properties);
    }
  }
  return found;
}

const IMPORTANT = /!\s*important\s*$/;

/** Whether a stylesheet holds the rule that stops all motion when the system asks for less. */
function stopsAllMotion(css) {
  return styleRules(css).some(({ selectors, declarations: found, reduced }) => {
    const value = (property) => found.find((declaration) => declaration.property === property)?.value ?? '';
    return reduced
      && ['*', '*::before', '*::after'].every((selector) => selectors.includes(selector))
      && /^0s?\s*!\s*important$/.test(value('animation-duration'))
      && /^1\s*!\s*important$/.test(value('animation-iteration-count'))
      && /^0s?\s*!\s*important$/.test(value('transition-duration'))
      && /^0s?\s*!\s*important$/.test(value('transition-delay'))
      && /^auto\s*!\s*important$/.test(value('scroll-behavior'));
  });
}

/** Motion declarations marked `!important` outside a reduced-motion block: they would outrank the rule. */
function outrankingMotion(css) {
  return styleRules(css)
    .filter((rule) => !rule.reduced)
    .flatMap(({ selectors, declarations: found }) => found
      .filter(({ property, value }) => MOTION_PROPERTY.test(property) && IMPORTANT.test(value))
      .map(({ property }) => `${selectors.join(', ')} { ${property} }`));
}

/** Keyframes an animation kept under reduced motion runs, that move something. */
function movingReducedAnimations(css, keyframes) {
  return styleRules(css)
    .filter((rule) => rule.reduced)
    .flatMap(({ selectors, declarations: found }) => found
      .filter(({ property, value }) => (property === 'animation' || property === 'animation-name') && IMPORTANT.test(value))
      .flatMap(({ value }) => value.split(/[\s,]+/).filter((word) => keyframes.has(word)))
      .filter((name) => [...keyframes.get(name)].some((property) => !STILL_PROPERTIES.has(property)))
      .map((name) => `${selectors.join(', ')} runs ${name}`));
}

const GLOBAL = readFileSync(join(SRC, 'index.css'), 'utf8');
const stylesheets = listStylesheets(SRC).map((file) => ({ name: relative(SRC, file), css: readFileSync(file, 'utf8') }));
const scripts = listFiles(SRC, ['.ts', '.tsx'])
  .filter((file) => !/\.test(?:-helpers)?\.tsx?$/.test(file) && !file.includes(`${join(SRC, 'generated')}`))
  .map((file) => ({ name: relative(SRC, file), source: readFileSync(file, 'utf8') }));

describe('reduced motion', () => {
  it('reads the rule that stops all motion and what would outrank it', () => {
    const guarded = `
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0s !important; animation-iteration-count: 1 !important;
          transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important;
        }
        .loader { animation: fade 2s infinite !important; }
        .spinner { animation: turn 1s infinite !important; }
      }
      @keyframes fade { 50% { opacity: 0.4; } }
      @keyframes turn { to { transform: rotate(1turn); } }
      .card { transition: transform 0.2s !important; animation-duration: 1s; }
      @media (min-width: 1px) { .panel { animation: fade 1s ! important; } }`;
    expect(stopsAllMotion(guarded)).toBe(true);
    expect(stopsAllMotion(guarded.replace('transition-duration: 0s !important;', ''))).toBe(false);
    expect(stopsAllMotion(guarded.replace('prefers-reduced-motion: reduce', 'prefers-reduced-motion: no-preference'))).toBe(false);
    expect(outrankingMotion(guarded)).toEqual(['.card { transition }', '.panel { animation }']);
    expect(movingReducedAnimations(guarded, keyframeProperties(guarded))).toEqual(['.spinner runs turn']);
  });

  it('stops every animation, transition and smooth scroll in index.css, which main.tsx loads', () => {
    expect(stopsAllMotion(GLOBAL)).toBe(true);
    expect(readFileSync(join(SRC, 'main.tsx'), 'utf8')).toMatch(/^import '\.\/index\.css';$/m);
  });

  it('covers every stylesheet that animates, by its own guard or the global one', () => {
    const animating = stylesheets.filter(({ css }) => /@keyframes|\banimation\s*:|\btransition\s*:/.test(withoutComments(css)));
    expect(animating.length).toBeGreaterThan(10);
    const globalGuard = stopsAllMotion(GLOBAL);
    expect(animating.filter(({ css }) => !globalGuard && !REDUCE.test(css)).map(({ name }) => name)).toEqual([]);
  });

  it('lets nothing outrank it outside a reduced-motion block', () => {
    expect(stylesheets.flatMap(({ name, css }) => outrankingMotion(css).map((rule) => `${name}: ${rule}`))).toEqual([]);
    // Tailwind's important modifier (`!animate-spin`, `!transition-all`, `!duration-300`) would too
    const importantUtilities = scripts.filter(({ source }) => /[\s"'`:]!(?:animate|transition|duration|delay)-/.test(source));
    expect(importantUtilities.map(({ name }) => name)).toEqual([]);
  });

  it('keeps only still animations, such as the loaders fading in place, when motion is reduced', () => {
    const keyframes = new Map(stylesheets.flatMap(({ css }) => [...keyframeProperties(css)]));
    expect(keyframes.get('motion-loader-fade')).toEqual(new Set(['opacity']));
    expect(stylesheets.flatMap(({ name, css }) => movingReducedAnimations(css, keyframes).map((rule) => `${name}: ${rule}`))).toEqual([]);
  });

  it('scrolls from scripts through scrollBehavior() and animates nothing from them', () => {
    // A script's `behavior: 'smooth'` ignores the stylesheet's `scroll-behavior`, and the Web
    // Animations API (`element.animate()`) ignores the stylesheet entirely.
    const smooth = scripts.filter(({ name, source }) => name !== join('utils', 'motion.ts') && /['"]smooth['"]/.test(source));
    expect(smooth.map(({ name }) => name)).toEqual([]);
    expect(scripts.filter(({ source }) => /\.animate\(/.test(source)).map(({ name }) => name)).toEqual([]);
  });
});
