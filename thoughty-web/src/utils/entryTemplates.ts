import type { Config } from '../types';

export interface EntryTemplate {
  id: string;
  name: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  format: 'plain' | 'markdown';
  builtIn?: boolean;
}

export interface EntryTemplateDraft {
  name: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  format: 'plain' | 'markdown';
}

const DEFAULT_ENTRY_TEMPLATES: EntryTemplate[] = [
  {
    id: 'builtin-gratitude',
    name: 'Gratitude journal',
    content: 'Today I am grateful for:\n\n1. \n2. \n3. \n\nOne small moment I want to remember:',
    tags: ['gratitude'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-daily-reflection',
    name: 'Daily reflection',
    content: 'What happened today?\n\nWhat did I learn?\n\nWhat should I carry into tomorrow?',
    tags: ['reflection'],
    visibility: 'private',
    format: 'plain',
    builtIn: true,
  },
  {
    id: 'builtin-meeting-notes',
    name: 'Meeting notes',
    content: '## Context\n\n## Decisions\n\n## Action items\n- ',
    tags: ['meeting'],
    visibility: 'private',
    format: 'markdown',
    builtIn: true,
  },
];

function isEntryTemplate(value: unknown): value is EntryTemplate {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EntryTemplate>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.content === 'string'
    && Array.isArray(candidate.tags)
    && candidate.tags.every((tag) => typeof tag === 'string')
    && (candidate.visibility === 'public' || candidate.visibility === 'private')
    && (candidate.format === 'plain' || candidate.format === 'markdown');
}

export function parseCustomEntryTemplates(rawTemplates?: Config['entryTemplates']): EntryTemplate[] {
  if (!rawTemplates || typeof rawTemplates !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawTemplates) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isEntryTemplate).map((template) => ({ ...template, builtIn: false }));
  } catch {
    return [];
  }
}

export function serializeCustomEntryTemplates(templates: EntryTemplate[]): string {
  return JSON.stringify(
    templates
      .filter((template) => !template.builtIn)
      .map(({ id, name, content, tags, visibility, format }) => ({
        id,
        name,
        content,
        tags,
        visibility,
        format,
      })),
  );
}

export function getEntryTemplates(rawTemplates?: Config['entryTemplates']): EntryTemplate[] {
  return [...DEFAULT_ENTRY_TEMPLATES, ...parseCustomEntryTemplates(rawTemplates)];
}

export function createEntryTemplate(draft: EntryTemplateDraft): EntryTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: draft.name.trim(),
    content: draft.content,
    tags: [...draft.tags],
    visibility: draft.visibility,
    format: draft.format,
    builtIn: false,
  };
}
