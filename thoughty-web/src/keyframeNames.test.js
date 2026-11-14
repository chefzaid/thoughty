import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import defaultTheme from 'tailwindcss/defaultTheme';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../tailwind.config';
import { keyframeBlocks, listStylesheets } from './test/stylesheets';

/**
 * Keyframe names are global to the page: when two stylesheets declare the same one, the one loaded
 * last runs every animation of that name, whichever stylesheet the animation comes from (a `spin`
 * that also moved its own spinner by `-50%, -50%` once shifted every other spinner). So each
 * `@keyframes` has a name of its own, and none takes a name Tailwind's animation utilities
 * (`animate-spin`, `animate-pulse`, ...) declare.
 */
const SRC = import.meta.dirname;
const TAILWIND_KEYFRAMES = [
  ...Object.keys(defaultTheme.keyframes),
  ...Object.keys(tailwindConfig.theme?.extend?.keyframes ?? {}),
];

/** Each keyframe name declared more than once, with every place that declares it. */
function clashingKeyframes(stylesheets, reserved) {
  const places = new Map(reserved.map((name) => [name, ['Tailwind']]));
  for (const { name: file, css } of stylesheets) {
    for (const { name } of keyframeBlocks(css)) places.set(name, [...(places.get(name) ?? []), file]);
  }
  return Object.fromEntries([...places].filter(([, where]) => where.length > 1));
}

const stylesheets = listStylesheets(SRC).map((file) => ({ name: relative(SRC, file), css: readFileSync(file, 'utf8') }));

describe('keyframe names', () => {
  it('finds a name declared twice, in one stylesheet or two, nested or not, or taken from Tailwind', () => {
    const sheets = [
      { name: 'a.css', css: '/* @keyframes note {} */ @keyframes fade { to { opacity: 0; } } @keyframes spin { to { transform: rotate(1turn); } }' },
      { name: 'b.css', css: '@media (min-width: 1px) { @keyframes fade { to { opacity: 1; } } } @keyframes slide { to { left: 0; } }' },
      { name: 'c.css', css: '@keyframes grow { to { width: 1px; } } @keyframes grow { to { width: 2px; } } .note { animation: note 1s; }' },
    ];
    expect(clashingKeyframes(sheets, ['spin'])).toEqual({
      spin: ['Tailwind', 'a.css'],
      fade: ['a.css', 'b.css'],
      grow: ['c.css', 'c.css'],
    });
  });

  it('gives every @keyframes of the app a name no other stylesheet or Tailwind utility declares', () => {
    expect(TAILWIND_KEYFRAMES).toContain('spin');
    expect(stylesheets.flatMap(({ css }) => keyframeBlocks(css)).length).toBeGreaterThan(10);
    expect(clashingKeyframes(stylesheets, TAILWIND_KEYFRAMES)).toEqual({});
  });
});
