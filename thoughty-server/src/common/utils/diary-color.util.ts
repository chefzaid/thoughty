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

export function getDefaultDiaryColor(index = 0): string {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  return DEFAULT_DIARY_COLORS[safeIndex % DEFAULT_DIARY_COLORS.length] ?? DEFAULT_DIARY_COLORS[0];
}