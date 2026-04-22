import { describe, expect, it } from 'vitest';
import {
  AUTO_TAG_COLORS,
  DEFAULT_TAG_COLOR,
  assignMissingTagColors,
  getTagMetadata,
  getDefaultTagColor,
  normalizeTagCategory,
  normalizeTagColor,
  normalizeTagKey,
  parseTagMetadata,
  renameTagMetadata,
  serializeTagMetadata,
} from './tagMetadata';

describe('tagMetadata', () => {
  it('normalizes tag keys, colors, and categories', () => {
    expect(normalizeTagKey(' Focus ')).toBe('focus');
    expect(normalizeTagColor(' #1a2b3c ')).toBe('#1A2B3C');
    expect(normalizeTagCategory('  Deep Work  ')).toBe('Deep Work');
  });

  it('parses valid metadata and ignores invalid entries', () => {
    const metadata = parseTagMetadata(JSON.stringify({
      Focus: { color: '#1a2b3c', category: 'Work' },
      Empty: { color: 'blue' },
      Reflection: { category: '  Personal  ' },
    }));

    expect(metadata).toEqual({
      focus: { color: '#1A2B3C', category: 'Work' },
      reflection: { category: 'Personal' },
    });
  });

  it('returns empty metadata for invalid json', () => {
    expect(parseTagMetadata('{invalid')).toEqual({});
  });

  it('serializes metadata with normalized keys and values', () => {
    const serialized = serializeTagMetadata({
      Reflection: { category: ' Personal ' },
      Focus: { color: '#1a2b3c' },
      Empty: { category: '   ' },
    });

    expect(serialized).toBe(JSON.stringify({
      focus: { color: '#1A2B3C' },
      reflection: { category: 'Personal' },
    }));
  });

  it('looks up metadata case-insensitively', () => {
    const metadata = parseTagMetadata(JSON.stringify({
      focus: { color: '#2563EB', category: 'Work' },
    }));

    expect(getTagMetadata('Focus', metadata)).toEqual({ color: '#2563EB', category: 'Work' });
  });

  it('uses the default purple tag color when none is chosen', () => {
    expect(getDefaultTagColor('focus')).toBe(DEFAULT_TAG_COLOR);
    expect(getDefaultTagColor()).toBe(DEFAULT_TAG_COLOR);
  });

  it('assigns saved colors to tags that are missing metadata', () => {
    const metadata = assignMissingTagColors(
      ['Focus', 'Work', 'Personal'],
      {
        focus: { category: 'Deep Work' },
        personal: { color: '#123456', category: 'Life' },
      },
      () => 0,
    );

    expect(metadata.personal).toEqual({ color: '#123456', category: 'Life' });
    expect(metadata.focus?.category).toBe('Deep Work');
    expect(metadata.focus?.color).toBeDefined();
    expect(metadata.work?.color).toBeDefined();
    expect(AUTO_TAG_COLORS).toContain(metadata.focus?.color);
    expect(AUTO_TAG_COLORS).toContain(metadata.work?.color);
    expect(metadata.focus?.color).not.toBe(metadata.work?.color);
  });

  it('moves metadata to the renamed tag key', () => {
    const metadata = renameTagMetadata(
      {
        old: { color: '#2563EB', category: 'Work' },
        keep: { color: '#123456' },
      },
      'old',
      'new',
    );

    expect(metadata.old).toBeUndefined();
    expect(metadata.new).toEqual({ color: '#2563EB', category: 'Work' });
    expect(metadata.keep).toEqual({ color: '#123456' });
  });
});