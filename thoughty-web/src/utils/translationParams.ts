/** A `{name}` placeholder in a translated text. */
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Puts each parameter into the `{name}` placeholders of `text`, as written: a value is never read as a
 * replacement pattern (a file named `a$&b.pdf` stays `a$&b.pdf`) or as another placeholder (a diary named
 * `{count}` is not filled in again). Placeholders without a parameter are left as they are.
 */
export function fillTranslationParams(text: string, params: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(PLACEHOLDER, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder);
}
