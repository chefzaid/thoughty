import { useState } from 'react';
import type { TranslationFunction } from './types';

interface DataPrivacySectionProps {
  t: TranslationFunction;
  isDark: boolean;
  onDownloadData: () => Promise<boolean>;
}

function DataPrivacySection({ t, isDark, onDownloadData }: Readonly<DataPrivacySectionProps>) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const handleDownload = async () => {
    setDownloadError('');
    setDownloading(true);
    const success = await onDownloadData();
    setDownloading(false);
    if (!success) {
      setDownloadError(t('downloadDataError'));
    }
  };

  return (
    <div className="profile-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <h3 className="section-title">{t('dataPrivacy')}</h3>
      </div>
      <div className="section-content">
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">{t('downloadMyData')}</span>
            <span className="setting-description">{t('downloadMyDataDescription')}</span>
          </div>
          <button
            type="button"
            className={`btn-download-data ${isDark ? 'dark' : 'light'}`}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? t('downloading') : t('downloadMyData')}
          </button>
        </div>
        {downloadError && <div className="password-error">{downloadError}</div>}
      </div>
    </div>
  );
}

export default DataPrivacySection;
