import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEntryTemplate,
  getEntryTemplates,
  parseCustomEntryTemplates,
  serializeCustomEntryTemplates,
} from './entryTemplates';

describe('entryTemplates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns built-in templates plus valid custom templates', () => {
    const custom = JSON.stringify([
      {
        id: 'custom-1',
        name: 'Review',
        content: 'Wins:',
        tags: ['review'],
        visibility: 'private',
        format: 'plain',
      },
      { id: 'bad-template' },
    ]);

    const templates = getEntryTemplates(custom);

    expect(templates.map((template) => template.id)).toContain('builtin-gratitude');
    expect(templates).toContainEqual(expect.objectContaining({
      id: 'custom-1',
      name: 'Review',
      builtIn: false,
    }));
    expect(templates).not.toContainEqual(expect.objectContaining({ id: 'bad-template' }));
  });

  it('ignores invalid serialized custom templates', () => {
    expect(parseCustomEntryTemplates('not-json')).toEqual([]);
    expect(parseCustomEntryTemplates(JSON.stringify({ id: 'nope' }))).toEqual([]);
  });

  it('serializes only custom templates', () => {
    const serialized = serializeCustomEntryTemplates([
      {
        id: 'builtin',
        name: 'Built in',
        content: '',
        tags: [],
        visibility: 'private',
        format: 'plain',
        builtIn: true,
      },
      {
        id: 'custom-1',
        name: 'Custom',
        content: 'Draft',
        tags: ['tag'],
        visibility: 'public',
        format: 'markdown',
        builtIn: false,
      },
    ]);

    expect(JSON.parse(serialized)).toEqual([
      {
        id: 'custom-1',
        name: 'Custom',
        content: 'Draft',
        tags: ['tag'],
        visibility: 'public',
        format: 'markdown',
      },
    ]);
  });

  it('creates custom templates from the current draft', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);

    expect(createEntryTemplate({
      name: '  Review  ',
      content: 'Draft',
      tags: ['review'],
      visibility: 'private',
      format: 'plain',
    })).toEqual({
      id: 'custom-123',
      name: 'Review',
      content: 'Draft',
      tags: ['review'],
      visibility: 'private',
      format: 'plain',
      builtIn: false,
    });
  });
});
