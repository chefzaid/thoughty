import React, { ChangeEvent, RefObject } from 'react';
import type { TranslationFunction, ProfileConfig, ProfileUser } from './types';

interface ProfileHeaderCardProps {
  localConfig: ProfileConfig;
  user: ProfileUser | null;
  initial: string;
  memberSince: number;
  t: TranslationFunction;
  triggerPictureUpload: () => void;
  fileInputRef: RefObject<HTMLInputElement>;
  handlePictureUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  uploadingPicture: boolean;
}

const ProfileHeaderCard: React.FC<ProfileHeaderCardProps> = ({
  localConfig,
  user,
  initial,
  memberSince,
  t,
  triggerPictureUpload,
  fileInputRef,
  handlePictureUpload,
  uploadingPicture
}) => (
  <div className="profile-header-card">
    <div className="profile-avatar-container">
      <button
        type="button"
        className="profile-avatar-large clickable"
        onClick={triggerPictureUpload}
        title={t('changeProfilePicture')}
        aria-label={t('changeProfilePicture')}
      >
        {localConfig.avatarUrl || user?.avatarUrl ? (
          <img src={localConfig.avatarUrl || user?.avatarUrl} alt="Profile" className="avatar-image" />
        ) : (
          initial
        )}
        <div className="avatar-overlay">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePictureUpload}
        className="hidden-file-input"
      />
      {uploadingPicture && <div className="upload-spinner"></div>}
    </div>
    <div className="profile-header-info">
      <div className="profile-name-row">
        <h2 className="profile-display-name">{localConfig.name || t('user')}</h2>
        {user?.username && <span className="profile-username">@{user.username}</span>}
      </div>
      <p className="profile-member-since">
        <svg xmlns="http://www.w3.org/2000/svg" className="member-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {t('memberSince', { year: memberSince })}
      </p>
    </div>
  </div>
);

export default ProfileHeaderCard;
