import { useLayoutEffect, useRef } from 'react';
import type { EntryTemplate } from '../../utils/entryTemplates';

interface DiaryTemplatePrefillOptions {
  /** The template of the diary a new entry goes to, or null when it has none. */
  readonly template: EntryTemplate | null;
  /** Changes whenever the composer starts a new entry: another diary is picked, or the last entry was saved. */
  readonly scope: string;
  /** Whether the composer may be filled now: the draft is loaded, and no draft saved elsewhere waits for an answer. */
  readonly enabled: boolean;
  /** The composer holds no text and no title. */
  readonly empty: boolean;
  /** The composer holds the template it was filled with last, untouched. */
  readonly untouched: boolean;
  /** Fills the composer from the template, or empties it of an untouched template when null. */
  readonly fill: (template: EntryTemplate | null) => void;
}

/**
 * Starts a new entry from its diary's default template, once for each diary picked and each entry saved.
 * The writer's own words are never replaced: the template goes only into an empty composer, and makes way
 * for another diary's template (or none) only while it is untouched. A composer emptied by the writer stays
 * empty, and a draft restored or offered from another device comes first. When the writer changes the
 * interface language, an untouched built-in template is filled again in the new one.
 *
 * The composer is filled in a layout effect, in the same task as the render that found it empty. A passive
 * effect could still be pending when the writer typed: React runs it before rendering the keystroke, so the
 * fill, judged on the older render's "empty", came after the letter and replaced it.
 */
export function useDiaryTemplatePrefill({ template, scope, enabled, empty, untouched, fill }: DiaryTemplatePrefillOptions): void {
  const handled = useRef<string | null>(null);
  const filledText = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const target = `${scope}|${template?.id ?? ''}`;
    // The same built-in template in the writer's new language takes the place of its untouched older text
    const relocalized = untouched && template !== null && template.content !== filledText.current;
    if (handled.current === target && !relocalized) return;
    handled.current = target;
    if (untouched || (empty && template)) {
      filledText.current = template?.content ?? null;
      fill(template);
    }
  }, [empty, enabled, fill, scope, template, untouched]);
}
