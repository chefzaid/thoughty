import { getColorSeed, normalizeHexColor } from './colorUtils';

export { HEX_COLOR_PATTERN as TAG_COLOR_PATTERN } from './colorUtils';

export const DEFAULT_TAG_COLOR = '#8B5CF6';

export const AUTO_TAG_COLORS = [
  '#2563EB',
  '#EA580C',
  '#059669',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#CA8A04',
  '#BE185D',
  '#4F46E5',
  '#0F766E',
  '#B45309',
  '#C026D3',
];

export const DEFAULT_TAG_COLORS = [
  DEFAULT_TAG_COLOR,
];

const MAX_TAG_CATEGORY_LENGTH = 40;

export interface TagMetadata {
  color?: string | null;
  category?: string;
}

export type TagMetadataMap = Record<string, TagMetadata>;

export function normalizeTagKey(tag?: string | null): string {
  if (typeof tag !== 'string') {
    return '';
  }

  return tag.trim().toLowerCase();
}

export function normalizeTagColor(color?: string | null): string | null {
  return normalizeHexColor(color);
}

export function normalizeTagCategory(category?: string | null): string {
  if (typeof category !== 'string') {
    return '';
  }

  return category.trim().slice(0, MAX_TAG_CATEGORY_LENGTH);
}

export function getDefaultTagColor(seed?: string | number | null): string {
  const index = getColorSeed(seed) % DEFAULT_TAG_COLORS.length;
  return DEFAULT_TAG_COLORS[index] ?? DEFAULT_TAG_COLORS[0] ?? DEFAULT_TAG_COLOR;
}

function sanitizeMetadata(value: unknown): TagMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const color = normalizeTagColor(typeof record.color === 'string' ? record.color : null);
  const category = normalizeTagCategory(typeof record.category === 'string' ? record.category : null);

  if (!color && !category) {
    return null;
  }

  return {
    ...(color ? { color } : {}),
    ...(category ? { category } : {}),
  };
}

export function parseTagMetadata(raw?: string | null): TagMetadataMap {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([tag, metadata]) => {
        const normalizedKey = normalizeTagKey(tag);
        const normalizedMetadata = sanitizeMetadata(metadata);
        return normalizedKey && normalizedMetadata ? [normalizedKey, normalizedMetadata] as const : null;
      })
      .filter((entry): entry is readonly [string, TagMetadata] => entry !== null);

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function serializeTagMetadata(metadata: TagMetadataMap): string {
  const normalizedEntries = Object.entries(metadata)
    .map(([tag, value]) => {
      const normalizedKey = normalizeTagKey(tag);
      const normalizedMetadata = sanitizeMetadata(value);
      return normalizedKey && normalizedMetadata ? [normalizedKey, normalizedMetadata] as const : null;
    })
    .filter((entry): entry is readonly [string, TagMetadata] => entry !== null)
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify(Object.fromEntries(normalizedEntries));
}

export function getTagMetadata(tag: string, metadata: TagMetadataMap): TagMetadata | undefined {
  return metadata[normalizeTagKey(tag)];
}

export function renameTagMetadata(
  metadata: TagMetadataMap,
  oldTag: string,
  newTag: string,
): TagMetadataMap {
  const sourceKey = normalizeTagKey(oldTag);
  const targetKey = normalizeTagKey(newTag);

  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return metadata;
  }

  const nextMetadata = { ...metadata };
  const sourceMetadata = nextMetadata[sourceKey];
  const targetMetadata = nextMetadata[targetKey];

  delete nextMetadata[sourceKey];

  const color = normalizeTagColor(targetMetadata?.color ?? sourceMetadata?.color ?? null);
  const category = normalizeTagCategory(targetMetadata?.category ?? sourceMetadata?.category ?? '');

  if (color || category) {
    nextMetadata[targetKey] = {
      ...(color ? { color } : {}),
      ...(category ? { category } : {}),
    };
  }

  return nextMetadata;
}

function pickStableAutoColor(tag: string, usedColors: Set<string>, fallbackIndex: number): string {
  if (AUTO_TAG_COLORS.length === 0) {
    return DEFAULT_TAG_COLOR;
  }

  const preferredIndex = getColorSeed(tag) % AUTO_TAG_COLORS.length;

  for (let offset = 0; offset < AUTO_TAG_COLORS.length; offset += 1) {
    const color = AUTO_TAG_COLORS[(preferredIndex + offset) % AUTO_TAG_COLORS.length];
    if (color && !usedColors.has(color)) {
      return color;
    }
  }

  return AUTO_TAG_COLORS[fallbackIndex % AUTO_TAG_COLORS.length] ?? DEFAULT_TAG_COLOR;
}

export function assignMissingTagColors(
  tags: readonly string[],
  metadata: TagMetadataMap,
): TagMetadataMap {
  const missingTags = Array.from(
    new Set(tags.map((tag) => normalizeTagKey(tag)).filter(Boolean)),
  )
    .filter((tag) => !normalizeTagColor(metadata[tag]?.color ?? null))
    .sort((left, right) => left.localeCompare(right));

  if (missingTags.length === 0) {
    return metadata;
  }

  const nextMetadata: TagMetadataMap = { ...metadata };
  const usedColors = new Set(
    Object.values(nextMetadata)
      .map((value) => normalizeTagColor(value?.color ?? null))
      .filter((value): value is string => value !== null),
  );

  missingTags.forEach((tag, index) => {
    const existingCategory = normalizeTagCategory(nextMetadata[tag]?.category ?? '');
    const assignedColor = pickStableAutoColor(tag, usedColors, index);

    usedColors.add(assignedColor);

    nextMetadata[tag] = {
      ...(existingCategory ? { category: existingCategory } : {}),
      color: assignedColor,
    };
  });

  return nextMetadata;
}