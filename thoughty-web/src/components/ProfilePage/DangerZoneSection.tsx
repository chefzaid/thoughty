import React from 'react';
import type { TranslationFunction } from './types';

interface DangerZoneSectionProps {
  t: TranslationFunction;
  isDark: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (value: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (value: string) => void;
  deleteError: string;
  setDeleteError: (value: string) => void;
  deletingAccount: boolean;
  handleDeleteAccount: () => void;
}

const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  t,
  isDark,
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConfirmText,
  setDeleteConfirmText,
  deleteError,
  setDeleteError,
  deletingAccount,
  handleDeleteAccount
}) => (
  <div className="profile-section danger-section">
    <div className="section-header">
      <svg xmlns="http://www.w3.org/2000/svg" className="section-icon danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h3 className="section-title danger">{t('dangerZone')}</h3>
    </div>
    <div className="section-content">
      <div className="setting-row">
        <div className="setting-info">
          <span className="setting-label danger">{t('deleteAccount')}</span>
          <span className="setting-description">{t('deleteAccountDescription')}</span>
        </div>
        {showDeleteConfirm ? (
          <div className="delete-confirm-container">
            <p className="delete-warning">{t('deleteAccountWarning')}</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={t('typeDeleteToConfirm')}
              className={`setting-input delete-confirm-input ${isDark ? 'dark' : 'light'}`}
            />
            {deleteError && <div className="password-error">{deleteError}</div>}
            <div className="delete-actions">
              <button
                type="button"
                className="btn-cancel-delete"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
              >
                {deletingAccount ? t('deleting') : t('confirmDelete')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-delete-account" onClick={() => setShowDeleteConfirm(true)}>
            {t('deleteAccount')}
          </button>
        )}
      </div>
    </div>
  </div>
);

export default DangerZoneSection;
