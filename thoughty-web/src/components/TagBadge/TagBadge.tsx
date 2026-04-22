import { withAlpha } from '../../utils/diaryColors';
import {
  normalizeTagCategory,
  normalizeTagColor,
  getTagMetadata,
  type TagMetadataMap,
} from '../../utils/tagMetadata';

function getBadgeSizeClass(size: TagBadgeProps['size']): string {
  if (size === '2xs') {
    return 'text-[0.625rem] px-1.25 py-0.5 gap-1';
  }

  if (size === 'xs') {
    return 'text-xs px-2 py-1 gap-1';
  }

  return 'text-sm px-2.5 py-1 gap-1.5';
}

function getCategoryClass(size: TagBadgeProps['size']): string {
  return size === '2xs'
    ? 'inline-flex items-center rounded-full px-1 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.08em]'
    : 'inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em]';
}

function getFallbackToneClass(isLight: boolean): string {
  return isLight
    ? 'bg-purple-100 text-purple-700 border-purple-300'
    : 'bg-purple-900/30 text-purple-300 border-purple-500/20';
}

function getBadgeStyle(resolvedColor: string | null, isLight: boolean) {
  if (!resolvedColor) {
    return undefined;
  }

  return {
    color: isLight ? '#111827' : '#F9FAFB',
    borderColor: withAlpha(resolvedColor, isLight ? 0.55 : 0.85),
    backgroundColor: withAlpha(resolvedColor, isLight ? 0.18 : 0.28),
    boxShadow: `inset 0 0 0 1px ${withAlpha(resolvedColor, isLight ? 0.12 : 0.22)}`,
  };
}

function getCategoryStyle(resolvedColor: string | null, isLight: boolean) {
  if (!resolvedColor) {
    return undefined;
  }

  return {
    backgroundColor: withAlpha(resolvedColor, isLight ? 0.18 : 0.22),
    color: resolvedColor,
  };
}

interface TagBadgeProps {
  readonly tag: string;
  readonly metadata?: TagMetadataMap;
  readonly theme?: 'light' | 'dark';
  readonly color?: string | null;
  readonly category?: string;
  readonly showHash?: boolean;
  readonly removable?: boolean;
  readonly onRemove?: () => void;
  readonly size?: 'sm' | 'xs' | '2xs';
  readonly suffix?: string;
  readonly className?: string;
}

function TagBadge({
  tag,
  metadata,
  theme = 'dark',
  color,
  category,
  showHash = true,
  removable = false,
  onRemove,
  size = 'sm',
  suffix = '',
  className = '',
}: Readonly<TagBadgeProps>) {
  const isLight = theme === 'light';
  const tagMetadata = metadata ? getTagMetadata(tag, metadata) : undefined;
  const resolvedColor = normalizeTagColor(color ?? tagMetadata?.color ?? null);
  const resolvedCategory = normalizeTagCategory(category ?? tagMetadata?.category ?? '');

  const baseClass = getBadgeSizeClass(size);
  const fallbackToneClass = getFallbackToneClass(isLight);
  const style = getBadgeStyle(resolvedColor, isLight);
  const categoryStyle = getCategoryStyle(resolvedColor, isLight);
  const categoryClass = getCategoryClass(size);

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border font-medium ${baseClass} ${resolvedColor ? '' : fallbackToneClass} ${className}`.trim()}
      style={style}
    >
      {resolvedCategory && (
        <span
          className={categoryClass}
          style={categoryStyle}
        >
          {resolvedCategory}
        </span>
      )}
      <span className="truncate">
        {showHash ? '#' : ''}
        {tag}
        {suffix}
      </span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${tag} tag`}
          className="font-bold leading-none opacity-80 transition-opacity hover:opacity-100"
        >
          &times;
        </button>
      )}
    </span>
  );
}

export default TagBadge;