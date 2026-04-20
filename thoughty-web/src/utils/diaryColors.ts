const DIARY_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export const DEFAULT_DIARY_COLORS = [
  '#E76F51',
  '#2A9D8F',
  '#3A86FF',
  '#F4A261',
  '#D62828',
  '#6A994E',
  '#8C5E58',
  '#264653',
];

export function normalizeDiaryColor(color?: string | null): string | null {
  if (typeof color !== 'string') {
    return null;
  }

  const normalized = color.trim().toUpperCase();
  return DIARY_COLOR_PATTERN.test(normalized) ? normalized : null;
}

function getColorSeed(value?: string | number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(Math.trunc(value));
  }

  if (typeof value !== 'string') {
    return 0;
  }

  let hash = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    hash = Math.trunc((hash * 31) + codePoint);
  }

  return Math.abs(hash);
}

export function getDiaryFallbackColor(seed?: string | number | null): string {
  const index = getColorSeed(seed) % DEFAULT_DIARY_COLORS.length;
  return DEFAULT_DIARY_COLORS[index] ?? DEFAULT_DIARY_COLORS[0] ?? '#E76F51';
}

export function resolveDiaryColor(diary: {
  color?: string | null;
  id?: number | null;
  name?: string | null;
}): string {
  return normalizeDiaryColor(diary.color) ?? getDiaryFallbackColor(diary.id ?? diary.name);
}

export function withAlpha(color: string, alpha: number): string {
  const normalized = normalizeDiaryColor(color);
  if (!normalized) {
    return `rgba(59, 130, 246, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}