import type { ChangeEvent } from 'react';
import type { ProfileConfig, TranslationFunction } from './types';
import { COMMENT_POLICY_OPTIONS } from '../FeedPage/commentPolicyOptions';

interface PublicEntriesSectionProps {
  readonly defaultCommentPolicy: ProfileConfig['defaultCommentPolicy'];
  readonly handleChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

/** What applies to every public entry unless the entry says otherwise: who may comment on it. */
function PublicEntriesSection({ defaultCommentPolicy, handleChange, isDark, t }: PublicEntriesSectionProps) {
  return (
    <div className="profile-section">
      <div className="section-header">
        <span className="codicon codicon-comment-discussion section-icon" aria-hidden="true" />
        <h2 className="section-title">{t('publicEntriesSettings')}</h2>
      </div>
      <div className="section-content">
        <div className="setting-row horizontal">
          <div className="setting-info">
            <label className="setting-label" htmlFor="profile-default-comment-policy">{t('defaultCommentPolicy')}</label>
            <span id="profile-default-comment-policy-description" className="setting-description">
              {t('defaultCommentPolicyDescription')}
            </span>
          </div>
          <select
            id="profile-default-comment-policy"
            name="defaultCommentPolicy"
            aria-describedby="profile-default-comment-policy-description"
            value={defaultCommentPolicy || 'everyone'}
            onChange={handleChange}
            className={`setting-select ${isDark ? 'dark' : 'light'}`}
          >
            {COMMENT_POLICY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{t(option.label)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default PublicEntriesSection;
