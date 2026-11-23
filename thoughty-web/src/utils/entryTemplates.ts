import type { Config, Diary } from '../types';
import { getTranslation } from './translations';
import type { BuiltInTemplatesTranslationKey } from './translations.builtInTemplates';

/** The longest name a custom template may have, in characters; the server refuses a longer one (`ENTRY_TEMPLATE_NAME_TOO_LONG`). */
export const MAX_TEMPLATE_NAME_LENGTH = 100;

export interface EntryTemplate {
  id: string;
  name: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  format: 'plain' | 'markdown';
  builtIn?: boolean;
  /** A built-in letter to the future: applying it offers to seal the entry as a time capsule this many years ahead. */
  sealYears?: number;
}

export interface EntryTemplateDraft {
  name: string;
  content: string;
  tags: string[];
  visibility: 'public' | 'private';
  format: 'plain' | 'markdown';
}

/** A built-in template; its name and text are translations, so they follow the writer's language. */
interface BuiltInEntryTemplate extends Omit<EntryTemplate, 'name' | 'content' | 'builtIn'> {
  nameKey: BuiltInTemplatesTranslationKey;
  contentKey: BuiltInTemplatesTranslationKey;
}

/** `Gratitude` for `templateGratitudeName` and `templateGratitudeText`. */
type BuiltInTemplateKey = BuiltInTemplatesTranslationKey extends infer Key
  ? Key extends `template${infer Stem}Name` ? Stem : never
  : never;

function builtIn(
  id: string,
  key: BuiltInTemplateKey,
  tags: string[],
  format: EntryTemplate['format'],
  extra: Pick<EntryTemplate, 'sealYears'> = {},
): BuiltInEntryTemplate {
  return {
    id,
    nameKey: `template${key}Name`,
    contentKey: `template${key}Text`,
    tags,
    visibility: 'private',
    format,
    ...extra,
  };
}

/**
 * The IDs are what a diary's default template stores, so they never change; the tags stay the same in
 * every language, so one writer's entries share them whatever language each was written in.
 */
const BUILT_IN_ENTRY_TEMPLATES: readonly BuiltInEntryTemplate[] = [
  builtIn('builtin-gratitude', 'Gratitude', ['gratitude'], 'plain'),
  builtIn('builtin-daily-reflection', 'DailyReflection', ['reflection'], 'plain'),
  builtIn('builtin-morning-intentions', 'MorningIntentions', ['morning', 'intentions'], 'plain'),
  builtIn('builtin-weekly-review', 'WeeklyReview', ['weekly-review'], 'markdown'),
  builtIn('builtin-decision-notes', 'DecisionNotes', ['decision'], 'markdown'),
  builtIn('builtin-rant', 'Rant', ['rant'], 'plain'),
  builtIn('builtin-worry-check', 'WorryCheck', ['anxiety'], 'plain'),
  builtIn('builtin-philosophical-musing', 'PhilosophicalMusing', ['philosophy'], 'plain'),
  builtIn('builtin-life-check-in', 'LifeCheckIn', ['life', 'check-in'], 'markdown'),
  builtIn('builtin-values-reflection', 'ValuesReflection', ['values'], 'plain'),
  builtIn('builtin-letter-to-future-self', 'LetterToFutureSelf', ['future-self'], 'plain', { sealYears: 1 }),
  builtIn('builtin-unsent-letter', 'UnsentLetter', ['unsent-letter'], 'plain'),
  builtIn('builtin-dream-log', 'DreamLog', ['dreams'], 'plain'),
];

/** The built-in templates in the language given (English when it is missing or unknown). */
export function getBuiltInEntryTemplates(language?: string): EntryTemplate[] {
  return BUILT_IN_ENTRY_TEMPLATES.map(({ nameKey, contentKey, tags, ...template }) => ({
    ...template,
    name: getTranslation(language ?? 'en', nameKey),
    content: getTranslation(language ?? 'en', contentKey),
    tags: [...tags],
    builtIn: true,
  }));
}

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

/**
 * The built-in templates in the writer's language, then their own, which stay exactly as they saved them.
 * A diary's default template is stored by ID, so it follows the language too.
 */
export function getEntryTemplates(rawTemplates?: Config['entryTemplates'], language?: string): EntryTemplate[] {
  return [...getBuiltInEntryTemplates(language), ...parseCustomEntryTemplates(rawTemplates)];
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

/**
 * The template a new entry in the diary starts from: the diary picked, or the default diary when the
 * journal shows every diary (where a new entry goes). Null when the diary names none, or a custom
 * template deleted since.
 */
export function diaryDefaultTemplate(
  diaries: readonly Pick<Diary, 'id' | 'isDefault' | 'defaultTemplateId'>[],
  diaryId: number | null,
  templates: readonly EntryTemplate[],
): EntryTemplate | null {
  const diary = diaries.find((candidate) => (diaryId === null ? candidate.isDefault : candidate.id === diaryId));
  const templateId = diary?.defaultTemplateId;
  return templateId ? templates.find((template) => template.id === templateId) ?? null : null;
}

/** What a diary card says of its default template, or null when it has none. */
export function describeDiaryTemplate(
  templateId: string | null,
  templates: readonly EntryTemplate[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (!templateId) return null;
  const template = templates.find((candidate) => candidate.id === templateId);
  return t('diaryDefaultTemplateSummary', { name: template?.name ?? t('diaryDefaultTemplateMissing') });
}
