import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEntryTemplate,
  describeDiaryTemplate,
  diaryDefaultTemplate,
  getBuiltInEntryTemplates,
  getEntryTemplates,
  parseCustomEntryTemplates,
  serializeCustomEntryTemplates,
} from './entryTemplates';

describe('entryTemplates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ships a varied set of built-in journaling templates', () => {
    const builtIns = getEntryTemplates().filter((template) => template.builtIn);
    const names = builtIns.map((template) => template.name);

    expect(names).toEqual(expect.arrayContaining([
      'Decision notes',
      'Rant it out',
      'Philosophical musing',
      'Life check-in',
    ]));
    expect(names).not.toContain('Meeting notes');
    expect(new Set(builtIns.map((template) => template.id)).size).toBe(builtIns.length);
    expect(builtIns.every((template) => template.content.trim() && template.tags.length > 0)).toBe(true);
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

  it('finds the template of the diary picked, or of the default diary while every diary is shown', () => {
    const templates = getEntryTemplates(JSON.stringify([
      { id: 'custom-1', name: 'Walk', content: 'Where:', tags: [], visibility: 'private', format: 'plain' },
    ]));
    const diaries = [
      { id: 1, isDefault: true, defaultTemplateId: 'builtin-gratitude' },
      { id: 2, isDefault: false, defaultTemplateId: 'custom-1' },
      { id: 3, isDefault: false, defaultTemplateId: 'custom-deleted' },
      { id: 4, isDefault: false, defaultTemplateId: null },
    ];

    expect(diaryDefaultTemplate(diaries, 2, templates)?.name).toBe('Walk');
    expect(diaryDefaultTemplate(diaries, null, templates)?.id).toBe('builtin-gratitude');
    expect(diaryDefaultTemplate(diaries, 3, templates)).toBeNull();
    expect(diaryDefaultTemplate(diaries, 4, templates)).toBeNull();
    expect(diaryDefaultTemplate(diaries, 99, templates)).toBeNull();
    expect(diaryDefaultTemplate([], null, templates)).toBeNull();
  });

  it('describes a diary’s template, a deleted one, and none', () => {
    const t = (key: string, params?: Record<string, string | number>) => `${key}${params ? `:${params.name}` : ''}`;
    const templates = getEntryTemplates();

    expect(describeDiaryTemplate('builtin-gratitude', templates, t)).toBe('diaryDefaultTemplateSummary:Gratitude journal');
    expect(describeDiaryTemplate('custom-gone', templates, t)).toBe('diaryDefaultTemplateSummary:diaryDefaultTemplateMissing');
    expect(describeDiaryTemplate(null, templates, t)).toBeNull();
  });

  describe('in French', () => {
    it('gives every built-in template a French name and text, with the same ID, tags and format', () => {
      const english = getBuiltInEntryTemplates('en');
      const french = getBuiltInEntryTemplates('fr');

      expect(french.map(({ id, tags, visibility, format, sealYears, builtIn }) => ({ id, tags, visibility, format, sealYears, builtIn })))
        .toEqual(english.map(({ id, tags, visibility, format, sealYears, builtIn }) => ({ id, tags, visibility, format, sealYears, builtIn })));
      french.forEach((template, index) => {
        expect(template.name).not.toBe(english[index]?.name);
        expect(template.content).not.toBe(english[index]?.content);
        expect(template.name).not.toMatch(/^template/);
        expect(template.content.trim()).not.toBe('');
      });
      expect(french.find((template) => template.id === 'builtin-gratitude')).toMatchObject({
        name: 'Journal de gratitude',
        content: expect.stringMatching(/^Aujourd'hui, je dis merci pour :/),
      });
    });

    it('keeps the markdown headings of the markdown templates', () => {
      const french = getBuiltInEntryTemplates('fr').filter((template) => template.format === 'markdown');
      expect(french.every((template) => /^## |\*\*/m.test(template.content))).toBe(true);
    });

    it('falls back to English for a missing or unknown language', () => {
      expect(getBuiltInEntryTemplates()).toEqual(getBuiltInEntryTemplates('en'));
      expect(getBuiltInEntryTemplates('de')[0]?.name).toBe('Gratitude journal');
    });

    it('leaves the writer’s own templates exactly as saved', () => {
      const custom = { id: 'custom-1', name: 'Evening walk', content: 'Where I walked:', tags: ['walks'], visibility: 'private', format: 'plain' };
      const templates = getEntryTemplates(JSON.stringify([custom]), 'fr');

      expect(templates.find((template) => template.id === 'custom-1')).toEqual({ ...custom, builtIn: false });
      expect(templates.filter((template) => template.builtIn)).toEqual(getBuiltInEntryTemplates('fr'));
    });

    it('resolves a diary’s default template, stored by ID, in the writer’s language', () => {
      const diaries = [{ id: 1, isDefault: true, defaultTemplateId: 'builtin-daily-reflection' }];
      const t = (key: string, params?: Record<string, string | number>) => `${key}:${params?.name}`;

      expect(diaryDefaultTemplate(diaries, null, getEntryTemplates(undefined, 'fr'))?.content).toMatch(/^Que s'est-il passé aujourd'hui \?/);
      expect(describeDiaryTemplate('builtin-daily-reflection', getEntryTemplates(undefined, 'fr'), t)).toBe('diaryDefaultTemplateSummary:Réflexion du jour');
    });
  });
});
