const BRACKET_REFERENCE_PATTERN = /\[\[(\d{4}-\d{2}-\d{2})(?:#(\d+))?\]\]/gi;
const LEGACY_REFERENCE_PATTERN = /entry\s*\((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/gi;

function patternReferencesTarget(
  pattern: RegExp,
  content: string,
  targetDate: string,
  targetIndex: number,
): boolean {
  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const [, date, rawIndex] = match;
    const referenceIndex = rawIndex ? Number.parseInt(rawIndex, 10) : 1;
    if (date === targetDate && referenceIndex === targetIndex) {
      return true;
    }
  }

  return false;
}

export function entryContentReferencesTarget(
  content: string,
  targetDate: string,
  targetIndex: number,
): boolean {
  return patternReferencesTarget(BRACKET_REFERENCE_PATTERN, content, targetDate, targetIndex)
    || patternReferencesTarget(LEGACY_REFERENCE_PATTERN, content, targetDate, targetIndex);
}
