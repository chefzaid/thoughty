import { useEffect, useState } from 'react';
import TagOrganizationSection from '../ProfilePage/TagOrganizationSection';
import type { ProfileConfig, TranslationFunction } from '../ProfilePage/types';
import { normalizeTagKey, parseTagMetadata, renameTagMetadata, serializeTagMetadata } from '../../utils/tagMetadata';

interface TagManagerPageProps {
  readonly config: ProfileConfig;
  readonly allTags: string[];
  readonly onUpdateConfig: (config: ProfileConfig) => Promise<void>;
  readonly onRenameTag: (currentTag: string, nextTag: string) => Promise<boolean>;
  readonly t: TranslationFunction;
}

function TagManagerPage({ config, allTags, onUpdateConfig, onRenameTag, t }: Readonly<TagManagerPageProps>) {
  const [localConfig, setLocalConfig] = useState<ProfileConfig>(config);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    setLocalConfig(config);
    setRenameDrafts({});
  }, [config]);

  const isDark = localConfig.theme !== 'light';

  const handleSave = (): void => {
    void (async () => {
      const pendingRenames = allTags
        .map((tag) => ({ currentTag: tag, nextTag: (renameDrafts[tag] ?? tag).trim() }))
        .filter(({ currentTag, nextTag }) => nextTag && normalizeTagKey(nextTag) !== normalizeTagKey(currentTag));

      let nextMetadata = parseTagMetadata(localConfig.tagMetadata);

      for (const { currentTag, nextTag } of pendingRenames) {
        const success = await onRenameTag(currentTag, nextTag);
        if (!success) {
          return;
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    })();
  };

  return (
    <div className={`profile-page ${isDark ? 'dark' : 'light'}`}>
      <div className={`tag-manager-header ${isDark ? 'dark' : 'light'}`}>
        <div>
          <h1 className="profile-page-title">{t('tags')}</h1>
          <p className="profile-page-subtitle">{t('tagOrganizationDescription')}</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="btn-save"
        >
          {t('saveSettings')}
        </button>
      </div>

      <TagOrganizationSection
        allTags={allTags}
        localConfig={localConfig}
        setLocalConfig={setLocalConfig}
        renameDrafts={renameDrafts}
        setRenameDrafts={setRenameDrafts}
        isDark={isDark}
        t={t}
      />

      {saveSuccess && (
        <div className="profile-save-toast">{t('settingsSaved')}</div>
      )}
    </div>
  );
}

export default TagManagerPage;