import { BadRequestException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { DIARY_TEMPLATE_ID_PATTERN } from '@/modules/diaries/dto/diaries.dto';

/** The longest name a custom entry template may have, in characters (the web's name field stops there too). */
export const ENTRY_TEMPLATE_NAME_MAX_LENGTH = 100;

const VISIBILITIES: readonly unknown[] = ['public', 'private'];
const FORMATS: readonly unknown[] = ['plain', 'markdown'];

/** Characters as a reader counts them: an emoji is one, not two UTF-16 units. */
const characterCount = (text: string) => [...text].length;

/**
 * Whether a parsed item has the shape of a custom template, its name aside: an ID a diary can name
 * as its default template, text, a list of tags, a visibility and a format. Extra keys are kept.
 */
function hasTemplateShape(item: unknown): item is Record<string, unknown> & { name: unknown } {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const { id, content, tags, visibility, format } = item as Record<string, unknown>;
  return typeof id === 'string'
    && DIARY_TEMPLATE_ID_PATTERN.test(id)
    && typeof content === 'string'
    && Array.isArray(tags)
    && tags.every((tag) => typeof tag === 'string')
    && VISIBILITIES.includes(visibility)
    && FORMATS.includes(format);
}

const hasUsableName = (name: unknown): name is string => typeof name === 'string' && name.trim() !== '';

function parseList(raw: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Checks the `entryTemplates` setting before it is saved: a JSON list (or empty text, for none) of
 * templates, each with a non-blank name of at most {@link ENTRY_TEMPLATE_NAME_MAX_LENGTH} characters.
 * Throws `400 ENTRY_TEMPLATE_NAME_TOO_LONG` for a longer name and `400 ENTRY_TEMPLATES_INVALID` otherwise.
 */
export function assertValidEntryTemplates(raw: string): void {
  if (raw === '') return;
  const list = parseList(raw);
  if (!list) {
    throw apiError(BadRequestException, 'ENTRY_TEMPLATES_INVALID', 'entryTemplates must be a JSON list of templates');
  }
  list.forEach((item, index) => {
    if (!hasTemplateShape(item) || !hasUsableName(item.name)) {
      throw apiError(
        BadRequestException,
        'ENTRY_TEMPLATES_INVALID',
        `Template ${index + 1} needs an id (1 to 100 letters, digits, _ or -), a name, its text, a list of tags, ` +
        'a visibility (public or private) and a format (plain or markdown)',
      );
    }
    if (characterCount(item.name) > ENTRY_TEMPLATE_NAME_MAX_LENGTH) {
      throw apiError(
        BadRequestException,
        'ENTRY_TEMPLATE_NAME_TOO_LONG',
        `Template ${index + 1}: a template name can be up to ${ENTRY_TEMPLATE_NAME_MAX_LENGTH} characters`,
      );
    }
  });
}

/**
 * The stored `entryTemplates` setting as `GET /api/config` returns it, so the web can always save back
 * what it was given: a name saved before the limit and longer than it reads as its first
 * {@link ENTRY_TEMPLATE_NAME_MAX_LENGTH} characters, and an item that is not a template (which the web
 * never showed) is left out. The stored row stays as it is until the writer next saves their templates.
 * `undefined` when the value is not a JSON list at all, which the response then leaves out.
 */
export function readableEntryTemplates(raw: string): string | undefined {
  if (raw === '') return raw;
  const list = parseList(raw);
  if (!list) return undefined;

  let changed = false;
  const readable = list.flatMap((item) => {
    if (!hasTemplateShape(item) || !hasUsableName(item.name)) {
      changed = true;
      return [];
    }
    if (characterCount(item.name) <= ENTRY_TEMPLATE_NAME_MAX_LENGTH) return [item];
    changed = true;
    return [{ ...item, name: [...item.name].slice(0, ENTRY_TEMPLATE_NAME_MAX_LENGTH).join('') }];
  });
  return changed ? JSON.stringify(readable) : raw;
}
