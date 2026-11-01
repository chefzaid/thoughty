import { describe, expect, it } from 'vitest';
import {
  entrySpacingStyle,
  entrySpacingVariables,
  entryTextStyle,
  LETTER_SPACING_OPTIONS,
  LINE_SPACING_OPTIONS,
  resolveFontFamily,
  resolveLetterSpacing,
  resolveLineHeight,
  type LetterSpacingPreference,
  type LineSpacingPreference,
} from './config';

describe('reading comfort settings', () => {
  it('offers the spacing steps from the narrowest, normal first', () => {
    expect(LINE_SPACING_OPTIONS).toEqual(['normal', 'relaxed', 'loose']);
    expect(LETTER_SPACING_OPTIONS).toEqual(['normal', 'wide', 'wider']);
  });

  it('gives each line spacing step a growing line height, and none for normal', () => {
    expect(resolveLineHeight('normal')).toBeUndefined();
    expect(resolveLineHeight(undefined)).toBeUndefined();
    expect(resolveLineHeight('relaxed')).toBe(1.9);
    expect(resolveLineHeight('loose')).toBe(2.2);
  });

  it('gives each letter spacing step a growing spacing, and none for normal', () => {
    expect(resolveLetterSpacing('normal')).toBeUndefined();
    expect(resolveLetterSpacing(undefined)).toBeUndefined();
    expect(resolveLetterSpacing('wide')).toBe('0.06em');
    expect(resolveLetterSpacing('wider')).toBe('0.12em');
  });

  it('ignores a step it does not know, keeping the view as it is', () => {
    expect(resolveLineHeight('huge' as LineSpacingPreference)).toBeUndefined();
    expect(resolveLineHeight('toString' as LineSpacingPreference)).toBeUndefined();
    expect(resolveLetterSpacing('constructor' as LetterSpacingPreference)).toBeUndefined();
  });

  it('styles entry text with the color and both spacings, and titles without the line height', () => {
    const preferences = { fontColor: '#123456', lineSpacing: 'loose', letterSpacing: 'wide' } as const;

    expect(entryTextStyle(preferences, 'light')).toEqual({ color: '#123456', lineHeight: 2.2, letterSpacing: '0.06em' });
    expect(entryTextStyle(preferences, 'light', { title: true })).toEqual({ color: '#123456', letterSpacing: '0.06em' });
  });

  it('leaves today’s look for normal spacing: the theme color and nothing else', () => {
    expect(entryTextStyle({}, 'light')).toEqual({ color: '#111827', lineHeight: undefined, letterSpacing: undefined });
    expect(entrySpacingStyle({ lineSpacing: 'normal', letterSpacing: 'normal' })).toEqual({ lineHeight: undefined, letterSpacing: undefined });
    expect(entrySpacingVariables({ lineSpacing: 'normal', letterSpacing: 'normal' })).toEqual({});
  });

  it('gives the spacing as custom properties for text a stylesheet places', () => {
    expect(entrySpacingVariables({ lineSpacing: 'relaxed', letterSpacing: 'wider' })).toEqual({
      '--entry-line-height': '1.9',
      '--entry-letter-spacing': '0.12em',
    });
    expect(entrySpacingVariables({ letterSpacing: 'wide' })).toEqual({ '--entry-letter-spacing': '0.06em' });
  });

  it('names the self-hosted easy-to-read font first, with system fonts behind it', () => {
    expect(resolveFontFamily('legible')).toMatch(/^"Atkinson Hyperlegible", system-ui/);
  });
});
