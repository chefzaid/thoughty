import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import TagOrganizationSection from '../ProfilePage/TagOrganizationSection';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { ProfileConfig, TranslationFunction } from '../ProfilePage/types';
import type { TagUsage } from '../../services/api/entriesService';
import {
  assignMissingTagColors,
  listKnownTags,
  normalizeTagKey,
  parseTagMetadata,
  removeTagMetadata,
  renameTagMetadata,
  serializeTagMetadata,
} from '../../utils/tagMetadata';
import JournalRetagReview from './JournalRetagReview';
import { useTransientMessage } from '../../hooks/useTransientMessage';
import AutoDismiss from '../AutoDismiss/AutoDismiss';

const MAX_TAG_LENGTH = 50;

interface TagManagerPageProps {
  readonly config: ProfileConfig;
  readonly allTags: string[];
  readonly onUpdateConfig: (config: ProfileConfig) => Promise<void>;
  readonly onRenameTag: (currentTag: string, nextTag: string) => Promise<boolean>;
  readonly onDeleteTag: (tag: string) => Promise<boolean>;
  readonly onLoadTagUsage: () => Promise<TagUsage[] | null>;
  readonly onRetagApplied: () => Promise<void>;
  readonly t: TranslationFunction;
}

function TagManagerPage({
  config,
  allTags,
  onUpdateConfig,
  onRenameTag,
  onDeleteTag,
  onLoadTagUsage,
  onRetagApplied,
  t,
}: Readonly<TagManagerPageProps>) {
  const [localConfig, setLocalConfig] = useState<ProfileConfig>(config);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const saveToast = useTransientMessage();
  const [tagUsage, setTagUsage] = useState<Record<string, number>>({});
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState('');
  const [tagPendingDelete, setTagPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const refreshTagUsage = useCallback(async (): Promise<void> => {
    const usage = await onLoadTagUsage();
    if (usage) {
      setTagUsage(Object.fromEntries(usage.map(({ tag, count }) => [tag, count])));
    }
  }, [onLoadTagUsage]);

  useEffect(() => {
    void refreshTagUsage();
  }, [refreshTagUsage, allTags]);

  const isDark = localConfig.theme !== 'light';
  const knownTags = useMemo(
    () => listKnownTags(allTags, parseTagMetadata(localConfig.tagMetadata)),
    [allTags, localConfig.tagMetadata],
  );

  const persistTagMetadata = async (tagMetadata: string): Promise<void> => {
    const nextConfig = { ...localConfig, tagMetadata };
    await onUpdateConfig(nextConfig);
    setLocalConfig(nextConfig);
  };

  const handleCreateTag = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const name = newTagName.trim().replace(/^#+/, '').trim().slice(0, MAX_TAG_LENGTH);
    if (!name) {
      return;
    }
    if (knownTags.some((tag) => normalizeTagKey(tag) === normalizeTagKey(name))) {
      setTagError(t('tagAlreadyExists'));
      return;
    }

    void (async () => {
      const metadata = assignMissingTagColors([name], parseTagMetadata(localConfig.tagMetadata));
      await persistTagMetadata(serializeTagMetadata(metadata));
      setNewTagName('');
      setTagError('');
    })();
  };

  const confirmDeleteTag = (): void => {
    const tag = tagPendingDelete;
    setTagPendingDelete(null);
    if (!tag) {
      return;
    }

    void (async () => {
      if (allTags.includes(tag) && !(await onDeleteTag(tag))) {
        setTagError(t('deleteTagFailed'));
        return;
      }

      const metadata = removeTagMetadata(parseTagMetadata(localConfig.tagMetadata), tag);
      await persistTagMetadata(serializeTagMetadata(metadata));
      setRenameDrafts(({ [tag]: _removed, ...rest }) => rest);
      setTagError('');
      await refreshTagUsage();
    })();
  };

  const handleSave = (): void => {
    void (async () => {
      const pendingRenames = knownTags
        .map((tag) => ({ currentTag: tag, nextTag: (renameDrafts[tag] ?? tag).trim() }))
        .filter(({ currentTag, nextTag }) => nextTag && normalizeTagKey(nextTag) !== normalizeTagKey(currentTag));

      let nextMetadata = parseTagMetadata(localConfig.tagMetadata);

      for (const { currentTag, nextTag } of pendingRenames) {
        // Tags created on this page have no entries yet, so only their metadata moves.
        if (allTags.includes(currentTag)) {
          const success = await onRenameTag(currentTag, nextTag);
          if (!success) {
            return;
          }
        }
        nextMetadata = renameTagMetadata(nextMetadata, currentTag, nextTag);
      }

      const nextConfig = {
        ...localConfig,
        tagMetadata: serializeTagMetadata(nextMetadata),
      };

      await onUpdateConfig(nextConfig);
      setLocalConfig(nextConfig);
      setRenameDrafts({});
      saveToast.show();
    })();
  };

  return (
    <div className={`profile-page ${isDark ? 'dark' : 'light'}`}>
      <div className={`tag-manager-header ${isDark ? 'dark' : 'light'}`}>
        <div>
          <h1 className="profile-page-title">{t('tags')}</h1>
          <p className="profile-page-subtitle">{t('tagOrganizationDescription')}</p>
        </div>
        <div className="tag-manager-header-actions">
          <JournalRetagReview isDark={isDark} onApplied={onRetagApplied} t={t} />
          <button type="button" onClick={handleSave} className="btn-save">
            {t('saveSettings')}
          </button>
        </div>
      </div>

      <form className={`tag-manager-create ${isDark ? 'dark' : 'light'}`} onSubmit={handleCreateTag}>
        <label className="tag-manager-field tag-manager-create-field">
          <span className="setting-label">{t('newTag')}</span>
          <input
            type="text"
            name="new-tag"
            value={newTagName}
            maxLength={MAX_TAG_LENGTH + 1}
            placeholder={t('newTagPlaceholder')}
            onChange={(event) => {
              setNewTagName(event.target.value);
              setTagError('');
            }}
            className={`setting-input ${isDark ? 'dark' : 'light'}`}
          />
        </label>
        <button type="submit" className="btn-save" disabled={!newTagName.trim()}>
          {t('addTag')}
        </button>
        {tagError && <p className="tag-manager-error" role="alert">{tagError}</p>}
      </form>

      <TagOrganizationSection
        allTags={allTags}
        localConfig={localConfig}
        setLocalConfig={setLocalConfig}
        renameDrafts={renameDrafts}
        setRenameDrafts={setRenameDrafts}
        tagUsage={tagUsage}
        onDeleteTag={setTagPendingDelete}
        isDark={isDark}
        t={t}
      />

      <ConfirmModal
        isOpen={tagPendingDelete !== null}
        onClose={() => setTagPendingDelete(null)}
        onConfirm={confirmDeleteTag}
        title={t('deleteTag')}
        message={t('deleteTagConfirm', {
          tag: tagPendingDelete ?? '',
          count: tagPendingDelete ? tagUsage[tagPendingDelete] ?? 0 : 0,
        })}
        theme={isDark ? 'dark' : 'light'}
        t={t}
      />

      <AutoDismiss message={saveToast} durationMs={3000}>
        <div className="profile-save-toast" role="status">{t('settingsSaved')}</div>
      </AutoDismiss>
    </div>
  );
}

export default TagManagerPage;
