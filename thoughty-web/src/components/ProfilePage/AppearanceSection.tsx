import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';
import './AppearanceSection.css';
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_SPACING,
  entriesPerPageChoices,
  normalizeEntriesPerPage,
  normalizeFontSize,
  resolveFontColor,
} from '../../types/config';
import { getPreferredSpeechVoice, getSpeechLang, getSpeechVoicesForLanguage } from '../../utils/speechVoices';
import AppearanceAccessibilitySettings from './AppearanceAccessibilitySettings';
import SettingSwitch from './SettingSwitch';
import FontSettings from './FontSettings';

interface AppearanceSectionProps {
  localConfig: ProfileConfig;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  handleThemeToggle: () => void;
  isDark: boolean;
  isLight: boolean;
  t: TranslationFunction;
}

type HandleAppearanceChange = AppearanceSectionProps['handleChange'];

function useSpeechVoicePreferences(
  language: string,
  ttsVoiceUri: string | undefined,
  previewText: string,
) {
  const [voiceOptions, setVoiceOptions] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const speechAvailable = typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis;

  useEffect(() => {
    if (!speechAvailable) {
      setVoiceOptions([]);
      return;
    }

    const synth = globalThis.speechSynthesis;
    const loadVoices = () => {
      setVoiceOptions(getSpeechVoicesForLanguage(synth.getVoices(), language));
    };

    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      synth.cancel();
    };
  }, [language, speechAvailable]);

  const selectedVoiceValue = useMemo(() => {
    return voiceOptions.some((voice) => voice.voiceURI === ttsVoiceUri)
      ? ttsVoiceUri ?? ''
      : '';
  }, [ttsVoiceUri, voiceOptions]);

  const previewVoice = useCallback(() => {
    if (!speechAvailable) {
      return;
    }

    const synth = globalThis.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(previewText);
    utterance.lang = getSpeechLang(language);

    const selectedVoice = getPreferredSpeechVoice(
      synth.getVoices(),
      language,
      ttsVoiceUri,
    );

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => setPreviewingVoice(false);
    utterance.onerror = () => setPreviewingVoice(false);

    synth.cancel();
    setPreviewingVoice(true);
    synth.speak(utterance);
  }, [language, previewText, speechAvailable, ttsVoiceUri]);

  return {
    previewingVoice,
    previewVoice,
    selectedVoiceValue,
    speechAvailable,
    voiceOptions,
  };
}

function LanguageSetting({
  language,
  handleChange,
  isDark,
  t,
}: Readonly<{
  language: string;
  handleChange: HandleAppearanceChange;
  isDark: boolean;
  t: TranslationFunction;
}>) {
  return (
    <div className="setting-row">
      <span className="setting-label">{t('language')}</span>
      <div className="language-selector">
        <button
          type="button"
          className={`lang-btn ${language === 'en' ? 'active' : ''} ${isDark ? 'dark' : 'light'}`}
          onClick={() => handleChange({ target: { name: 'language', value: 'en' } })}
          title="English"
        >
          <img src="/flags/gb.svg" alt="" className="flag-icon" /> English
        </button>
        <button
          type="button"
          className={`lang-btn ${language === 'fr' ? 'active' : ''} ${isDark ? 'dark' : 'light'}`}
          onClick={() => handleChange({ target: { name: 'language', value: 'fr' } })}
          title="Français"
        >
          <img src="/flags/fr.svg" alt="" className="flag-icon" /> Français
        </button>
      </div>
    </div>
  );
}

function ThemeAndPaginationSettings({
  entriesPerPage,
  maxPinnedEntries,
  handleChange,
  handleThemeToggle,
  isDark,
  isLight,
  t,
}: Readonly<{
  entriesPerPage: ProfileConfig['entriesPerPage'];
  maxPinnedEntries: ProfileConfig['maxPinnedEntries'];
  handleChange: HandleAppearanceChange;
  handleThemeToggle: () => void;
  isDark: boolean;
  isLight: boolean;
  t: TranslationFunction;
}>) {
  return (
    <div className="settings-row-pair">
      <div className="setting-row horizontal">
        <div className="setting-info">
          <span className="setting-label">{t('theme')}</span>
          <span className="setting-description">{t('themeDescription')}</span>
        </div>
        <div className="theme-switch-container">
          <span className={`theme-label ${isLight ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="theme-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </span>
          <button
            type="button"
            className={`theme-switch ${isDark ? 'dark' : 'light'}`}
            onClick={handleThemeToggle}
            aria-label={t('toggleTheme')}
          >
            <span className={`switch-thumb ${isDark ? 'on' : 'off'}`} />
          </button>
          <span className={`theme-label ${isDark ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="theme-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </span>
        </div>
      </div>

      <div className="setting-row horizontal">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-entries-per-page">{t('entriesPerPage')}</label>
          <span id="profile-entries-per-page-description" className="setting-description">{t('entriesPerPageDescription')}</span>
        </div>
        <select
          id="profile-entries-per-page"
          name="entriesPerPage"
          aria-describedby="profile-entries-per-page-description"
          value={String(normalizeEntriesPerPage(entriesPerPage))}
          onChange={handleChange}
          className={`setting-select ${isDark ? 'dark' : 'light'}`}
        >
          {entriesPerPageChoices(normalizeEntriesPerPage(entriesPerPage)).map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      <div className="setting-row horizontal">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-max-pinned-entries">{t('maxPinnedEntries')}</label>
          <span id="profile-max-pinned-entries-description" className="setting-description">{t('maxPinnedEntriesDescription')}</span>
        </div>
        <select
          id="profile-max-pinned-entries"
          name="maxPinnedEntries"
          aria-describedby="profile-max-pinned-entries-description"
          value={maxPinnedEntries || '3'}
          onChange={handleChange}
          className={`setting-select ${isDark ? 'dark' : 'light'}`}
        >
          <option value="1">1</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
        </select>
      </div>
    </div>
  );
}

function SpeechSettings({
  handleChange,
  isDark,
  previewingVoice,
  previewVoice,
  readDates,
  selectedVoiceValue,
  speechAvailable,
  t,
  voiceOptions,
}: Readonly<{
  handleChange: HandleAppearanceChange;
  isDark: boolean;
  previewingVoice: boolean;
  previewVoice: () => void;
  readDates: boolean | undefined;
  selectedVoiceValue: string;
  speechAvailable: boolean;
  t: TranslationFunction;
  voiceOptions: SpeechSynthesisVoice[];
}>) {
  return (
    <>
      <SettingSwitch
        name="readDates"
        label={t('readDates')}
        description={t('readDatesDescription')}
        enabled={readDates !== false}
        handleChange={handleChange}
        rowClassName="read-dates-row"
      />

      <div className="setting-row horizontal">
        <div className="setting-info">
          <label className="setting-label" htmlFor="profile-tts-voice">{t('ttsVoice')}</label>
          <span id="profile-tts-voice-description" className="setting-description">{t('ttsVoiceDescription')}</span>
        </div>
        <div className="voice-controls">
          <select
            id="profile-tts-voice"
            name="ttsVoiceUri"
            value={selectedVoiceValue}
            onChange={handleChange}
            aria-describedby="profile-tts-voice-description"
            className={`setting-select ${isDark ? 'dark' : 'light'}`}
            disabled={!speechAvailable}
          >
            <option value="">{t('ttsVoiceDefault')}</option>
            {voiceOptions.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.default ? `${voice.name} (${t('ttsVoiceSystemLabel')})` : voice.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={previewVoice}
            disabled={!speechAvailable || previewingVoice}
            className={`voice-preview-btn ${isDark ? 'dark' : 'light'}`}
          >
            {previewingVoice ? t('previewingTtsVoice') : t('previewTtsVoice')}
          </button>
        </div>
      </div>
    </>
  );
}

function AppearanceSection({
  localConfig,
  handleChange,
  handleThemeToggle,
  isDark,
  isLight,
  t
}: Readonly<AppearanceSectionProps>) {
  const selectedFontFamily = localConfig.fontFamily ?? DEFAULT_FONT_FAMILY;
  const selectedFontSize = normalizeFontSize(localConfig.fontSize);
  const selectedFontColor = resolveFontColor(localConfig.fontColor, localConfig.theme);
  const selectedLineSpacing = localConfig.lineSpacing ?? DEFAULT_LINE_SPACING;
  const selectedLetterSpacing = localConfig.letterSpacing ?? DEFAULT_LETTER_SPACING;
  const selectedLanguage = localConfig.language ?? 'en';
  const {
    previewingVoice,
    previewVoice,
    selectedVoiceValue,
    speechAvailable,
    voiceOptions,
  } = useSpeechVoicePreferences(
    selectedLanguage,
    localConfig.ttsVoiceUri,
    t('ttsVoicePreviewSample'),
  );

  return (
  <div className="profile-section">
    <div className="section-header">
      <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
      <h2 className="section-title">{t('appearance')}</h2>
    </div>
    <div className="section-content">
      <LanguageSetting
        language={selectedLanguage}
        handleChange={handleChange}
        isDark={isDark}
        t={t}
      />

      <ThemeAndPaginationSettings
        entriesPerPage={localConfig.entriesPerPage}
        maxPinnedEntries={localConfig.maxPinnedEntries}
        handleChange={handleChange}
        handleThemeToggle={handleThemeToggle}
        isDark={isDark}
        isLight={isLight}
        t={t}
      />

      <FontSettings
        handleChange={handleChange}
        isDark={isDark}
        selectedFontColor={selectedFontColor}
        selectedFontFamily={selectedFontFamily}
        selectedFontSize={selectedFontSize}
        selectedLineSpacing={selectedLineSpacing}
        selectedLetterSpacing={selectedLetterSpacing}
        t={t}
      />

      <AppearanceAccessibilitySettings
        highContrast={localConfig.highContrast}
        handleChange={handleChange}
        t={t}
      />

      <SettingSwitch
        name="streakCard"
        label={t('streakCardSetting')}
        description={t('streakCardSettingDescription')}
        enabled={localConfig.streakCard !== false}
        handleChange={handleChange}
      />

      <SettingSwitch
        name="quietMode"
        label={t('quietModeSetting')}
        description={t('quietModeSettingDescription')}
        enabled={localConfig.quietMode === true}
        handleChange={handleChange}
      />

      <SettingSwitch
        name="comfortReads"
        label={t('comfortReadsSetting')}
        description={t('comfortReadsSettingDescription')}
        enabled={localConfig.comfortReads !== false}
        handleChange={handleChange}
      />

      <SpeechSettings
        handleChange={handleChange}
        isDark={isDark}
        previewingVoice={previewingVoice}
        previewVoice={previewVoice}
        readDates={localConfig.readDates}
        selectedVoiceValue={selectedVoiceValue}
        speechAvailable={speechAvailable}
        t={t}
        voiceOptions={voiceOptions}
      />
    </div>
  </div>
  );
}

export default AppearanceSection;
