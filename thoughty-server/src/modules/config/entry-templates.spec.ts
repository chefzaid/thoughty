import { BadRequestException } from '@nestjs/common';
import {
  assertValidEntryTemplates,
  ENTRY_TEMPLATE_NAME_MAX_LENGTH,
  readableEntryTemplates,
} from './entry-templates';

const template = (overrides: Record<string, unknown> = {}) => ({
  id: 'custom-1',
  name: 'Evening wins',
  content: 'Three things that went well:',
  tags: ['gratitude'],
  visibility: 'private',
  format: 'plain',
  ...overrides,
});

const codeOf = (raw: string) => {
  try {
    assertValidEntryTemplates(raw);
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return ((error as BadRequestException).getResponse() as { code: string }).code;
  }
};

describe('assertValidEntryTemplates', () => {
  it('accepts a list of templates, an empty list and empty text', () => {
    expect(codeOf(JSON.stringify([template(), template({ id: 'custom-2', visibility: 'public', format: 'markdown', tags: [] })]))).toBeNull();
    expect(codeOf('[]')).toBeNull();
    expect(codeOf('')).toBeNull();
  });

  it('accepts a name of exactly the limit, counting an emoji as one character', () => {
    expect(codeOf(JSON.stringify([template({ name: 'a'.repeat(ENTRY_TEMPLATE_NAME_MAX_LENGTH) })]))).toBeNull();
    expect(codeOf(JSON.stringify([template({ name: '🌙'.repeat(ENTRY_TEMPLATE_NAME_MAX_LENGTH) })]))).toBeNull();
  });

  it('refuses a longer name with ENTRY_TEMPLATE_NAME_TOO_LONG, naming the template', () => {
    const raw = JSON.stringify([template(), template({ id: 'custom-2', name: 'a'.repeat(101) })]);

    expect(codeOf(raw)).toBe('ENTRY_TEMPLATE_NAME_TOO_LONG');
    expect(() => assertValidEntryTemplates(raw)).toThrow('Template 2: a template name can be up to 100 characters');
  });

  it.each([
    ['text that is not JSON', '{not json'],
    ['JSON that is not a list', JSON.stringify({ templates: [] })],
    ['an item that is not an object', JSON.stringify(['Evening wins'])],
    ['an item that is a list', JSON.stringify([[template()]])],
    ['a blank name', JSON.stringify([template({ name: '   ' })])],
    ['a name that is not text', JSON.stringify([template({ name: 7 })])],
    ['no id', JSON.stringify([template({ id: undefined })])],
    ['an id a diary could not name', JSON.stringify([template({ id: 'custom 1' })])],
    ['text that is not a string', JSON.stringify([template({ content: null })])],
    ['tags that are not a list', JSON.stringify([template({ tags: 'gratitude' })])],
    ['a tag that is not text', JSON.stringify([template({ tags: ['gratitude', 3] })])],
    ['an unknown visibility', JSON.stringify([template({ visibility: 'friends' })])],
    ['an unknown format', JSON.stringify([template({ format: 'html' })])],
  ])('refuses %s with ENTRY_TEMPLATES_INVALID', (_case, raw) => {
    expect(codeOf(raw)).toBe('ENTRY_TEMPLATES_INVALID');
  });
});

describe('readableEntryTemplates', () => {
  it('returns templates within the rules exactly as stored', () => {
    const raw = JSON.stringify([template(), template({ id: 'custom-2', extra: 'kept' })]);

    expect(readableEntryTemplates(raw)).toBe(raw);
    expect(readableEntryTemplates('')).toBe('');
  });

  it('reads a name saved before the limit as its first 100 characters, keeping the template', () => {
    const long = `${'🌙'.repeat(60)}${'b'.repeat(60)}`;
    const readable = readableEntryTemplates(JSON.stringify([template({ name: long }), template({ id: 'custom-2' })]));

    const templates = JSON.parse(readable!) as Array<{ id: string; name: string; content: string }>;
    expect(templates.map(({ id }) => id)).toEqual(['custom-1', 'custom-2']);
    expect([...templates[0].name]).toHaveLength(ENTRY_TEMPLATE_NAME_MAX_LENGTH);
    expect(templates[0].name).toBe(`${'🌙'.repeat(60)}${'b'.repeat(40)}`);
    expect(templates[0].content).toBe('Three things that went well:');
    expect(() => assertValidEntryTemplates(readable!)).not.toThrow();
  });

  it('leaves out items that are not templates, which the web never showed', () => {
    const readable = readableEntryTemplates(JSON.stringify([template(), { name: 'Half a template' }, template({ id: 'custom-3', name: '' }), 'text']));

    expect(JSON.parse(readable!)).toEqual([template()]);
  });

  it('gives nothing for a value that is not a JSON list', () => {
    expect(readableEntryTemplates('{not json')).toBeUndefined();
    expect(readableEntryTemplates('{"a":1}')).toBeUndefined();
  });
});
