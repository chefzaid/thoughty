import { useMemo, type Dispatch, type SetStateAction } from 'react';
import TagBadge from '../TagBadge/TagBadge';
import type { ProfileConfig, TranslationFunction } from './types';
import {
  getDefaultTagColor,
  normalizeTagCategory,
  normalizeTagColor,
  normalizeTagKey,
  parseTagMetadata,
  serializeTagMetadata,
} from '../../utils/tagMetadata';

interface TagOrganizationSectionProps {
  readonly allTags: string[];
  readonly localConfig: ProfileConfig;
  readonly setLocalConfig: Dispatch<SetStateAction<ProfileConfig>>;
  readonly renameDrafts: Record<string, string>;
  readonly setRenameDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

function TagOrganizationSection({
  allTags,
  localConfig,
  setLocalConfig,
  renameDrafts,
  setRenameDrafts,
  isDark,
  t,
}: Readonly<TagOrganizationSectionProps>) {
  const metadata = useMemo(() => parseTagMetadata(localConfig.tagMetadata), [localConfig.tagMetadata]);

  const tags = useMemo(
    () => Array.from(new Set([...allTags, ...Object.keys(metadata)])).sort((left, right) => left.localeCompare(right)),
    [allTags, metadata],
  );

  const updateMetadata = (tag: string, nextColor?: string | null, nextCategory?: string | null): void => {
    const key = normalizeTagKey(tag);
    const mergedMetadata = { ...metadata };
    const category = normalizeTagCategory(nextCategory ?? mergedMetadata[key]?.category ?? '');
    const requestedColor = nextColor === undefined
      ? mergedMetadata[key]?.color ?? null
      : nextColor;
    let color = normalizeTagColor(requestedColor);

    if (category && !color) {
      color = getDefaultTagColor(tag);
    }

    if (!color && !category) {
      delete mergedMetadata[key];
    } else {
      mergedMetadata[key] = {
        ...(color ? { color } : {}),
        ...(category ? { category } : {}),
      };
    }

    setLocalConfig((prev) => ({
      ...prev,
      tagMetadata: serializeTagMetadata(mergedMetadata),
    }));
  };

  return (
    <div className="profile-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h6m-6 5h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
        <h3 className="section-title">{t('tagOrganization')}</h3>
      </div>
      <div className="section-content">
        {tags.length === 0 ? (
          <div className={`tag-manager-empty ${isDark ? 'dark' : 'light'}`}>{t('noTagsToOrganize')}</div>
        ) : (
          <div className="tag-manager-grid">
            {tags.map((tag) => {
              const currentMetadata = metadata[normalizeTagKey(tag)] ?? {};
              const color = currentMetadata.color ?? getDefaultTagColor(tag);
              const previewTag = (renameDrafts[tag] ?? tag).trim() || tag;

              return (
                <div key={tag} className={`tag-manager-row ${isDark ? 'dark' : 'light'}`}>
                  <div className="tag-manager-preview">
                    <div className="tag-manager-title-row">
                      <TagBadge
                        tag={previewTag}
                        theme={isDark ? 'dark' : 'light'}
                        color={color}
                        category=""
                        showHash
                        size="xs"
                        className="tag-manager-inline-badge"
                      />
                    </div>
                  </div>
                  <div className="tag-manager-fields">
                    <label className="tag-manager-field">
                      <span className="setting-label">Name</span>
                      <input
                        type="text"
                        name={`tag-name-${normalizeTagKey(tag)}`}
                        aria-label={`Name ${tag}`}
                        value={renameDrafts[normalizeTagKey(tag)] ?? tag}
                        placeholder={t('renameTagPlaceholder')}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setRenameDrafts((prev) => ({
                            ...prev,
                            [tag]: nextValue,
                          }));
                        }}
                        className={`setting-input ${isDark ? 'dark' : 'light'}`}
                      />
                    </label>
                    <label className="tag-manager-field">
                      <span className="setting-label">{t('tagCategory')}</span>
                      <input
                        type="text"
                        name={`tag-category-${normalizeTagKey(tag)}`}
                        aria-label={`${t('tagCategory')} ${tag}`}
                        value={currentMetadata.category ?? ''}
                        placeholder={t('tagCategoryPlaceholder')}
                        onChange={(event) => updateMetadata(tag, currentMetadata.color ?? null, event.target.value)}
                        className={`setting-input ${isDark ? 'dark' : 'light'}`}
                      />
                    </label>
                    <label className="tag-manager-field tag-manager-color-field">
                      <span className="setting-label">{t('tagColor')}</span>
                      <div className={`tag-manager-color-input ${isDark ? 'dark' : 'light'}`}>
                        <input
                          type="color"
                          name={`tag-color-${normalizeTagKey(tag)}`}
                          aria-label={`${t('tagColor')} ${tag}`}
                          value={color}
                          onChange={(event) => updateMetadata(tag, event.target.value, currentMetadata.category ?? '')}
                        />
                        <span>{currentMetadata.color ?? color}</span>
                      </div>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateMetadata(tag, null, '')}
                    className={`tag-manager-reset ${isDark ? 'dark' : 'light'}`}
                    title={t('resetTagAppearance')}
                    aria-label={`${t('resetTagAppearance')} ${tag}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 6H5v4" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.75 9.25A7 7 0 1112 19a6.96 6.96 0 01-4.95-2.05" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TagOrganizationSection;