import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';

interface AISectionProps {
  localConfig: ProfileConfig;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  t: TranslationFunction;
}

function AISection({
  localConfig,
  handleChange,
  t
}: Readonly<AISectionProps>) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="profile-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        <h3 className="section-title">{t('aiConfiguration')}</h3>
      </div>
      <div className="section-content">
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">{t('openRouterApiKey')}</span>
            <span className="setting-description">{t('openRouterApiKeyDescription')}</span>
          </div>
          <div className="api-key-input-container">
            <input
              type={showApiKey ? 'text' : 'password'}
              name="openRouterApiKey"
              value={localConfig.openRouterApiKey || ''}
              onChange={handleChange}
              placeholder={t('enterApiKey')}
              className={`setting-input ${localConfig.theme === 'light' ? 'light' : 'dark'} api-key-input`}
              autoComplete="off"
            />
            <button
              type="button"
              className="api-key-toggle"
              onClick={() => setShowApiKey(!showApiKey)}
              aria-label={showApiKey ? t('hideApiKey') : t('showApiKey')}
            >
              {showApiKey ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">{t('autoTagMaxTags')}</span>
            <span className="setting-description">{t('autoTagMaxTagsDescription')}</span>
          </div>
          <input
            type="number"
            min="0"
            max="10"
            name="autoTagMaxTags"
            value={localConfig.autoTagMaxTags ?? '0'}
            onChange={handleChange}
            className={`setting-input ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
          />
        </div>
      </div>
    </div>
  );
}

export default AISection;
