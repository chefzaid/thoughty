import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';
import {
  DEFAULT_FONT_FAMILY,
  normalizeFontSize,
  resolveFontColor,
  resolveFontFamily,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  type FontFamilyPreference,
} from '../../types/config';
import { getPreferredSpeechVoice, getSpeechLang, getSpeechVoicesForLanguage } from '../../utils/speechVoices';

const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: FontFamilyPreference; labelKey: string }> = [
  { value: 'system', labelKey: 'fontTypeSystem' },
  { value: 'serif', labelKey: 'fontTypeSerif' },
  { value: 'modern', labelKey: 'fontTypeModern' },
  { value: 'mono', labelKey: 'fontTypeMono' },
];

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
          <img src="/flags/gb.svg" alt="UK Flag" className="flag-icon" /> English
        </button>
        <button
          type="button"
          className={`lang-btn ${language === 'fr' ? 'active' : ''} ${isDark ? 'dark' : 'light'}`}
          onClick={() => handleChange({ target: { name: 'language', value: 'fr' } })}
          title="Français"
        >
          <img src="/flags/fr.svg" alt="French Flag" className="flag-icon" /> Français
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
            aria-label="Toggle theme"
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
          <span className="setting-label">{t('entriesPerPage')}</span>
          <span className="setting-description">{t('entriesPerPageDescription')}</span>
        </div>
        <select
          name="entriesPerPage"
          value={entriesPerPage || '10'}
          onChange={handleChange}
          className={`setting-select ${isDark ? 'dark' : 'light'}`}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="15">15</option>
          <option value="20">20</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>

      <div className="setting-row horizontal">
        <div className="setting-info">
          <span className="setting-label">{t('maxPinnedEntries')}</span>
          <span className="setting-description">{t('maxPinnedEntriesDescription')}</span>
        </div>
        <select
          name="maxPinnedEntries"
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

function FontSettings({
  handleChange,
  isDark,
  selectedFontColor,
  selectedFontFamily,
  selectedFontSize,
  t,
}: Readonly<{
  handleChange: HandleAppearanceChange;
  isDark: boolean;
  selectedFontColor: string;
  selectedFontFamily: FontFamilyPreference;
  selectedFontSize: number;
  t: TranslationFunction;
}>) {
  return (
    <>
      <div className="settings-row-pair">
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">{t('fontType')}</span>
            <span className="setting-description">{t('fontTypeDescription')}</span>
          </div>
          <select
            name="fontFamily"
            value={selectedFontFamily}
            onChange={handleChange}
            aria-label={t('fontType')}
            className={`setting-select ${isDark ? 'dark' : 'light'}`}
          >
            {FONT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-info font-size-heading">
            <div>
              <span className="setting-label">{t('fontSize')}</span>
              <span className="setting-description">{t('fontSizeDescription')}</span>
            </div>
            <span className={`font-size-value ${isDark ? 'dark' : 'light'}`}>{selectedFontSize}px</span>
          </div>
          <input
            type="range"
            name="fontSize"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step="1"
            value={selectedFontSize}
            onChange={handleChange}
            aria-label={t('fontSize')}
            className={`font-size-slider ${isDark ? 'dark' : 'light'}`}
          />
        </div>
      </div>

      <div className="setting-row horizontal">
        <div className="setting-info">
          <span className="setting-label">{t('fontColor')}</span>
          <span className="setting-description">{t('fontColorDescription')}</span>
        </div>
        <label className={`font-color-input ${isDark ? 'dark' : 'light'}`}>
          <input
            type="color"
            name="fontColor"
            value={selectedFontColor}
            onChange={handleChange}
            aria-label={t('fontColor')}
          />
          <span>{selectedFontColor.toUpperCase()}</span>
        </label>
      </div>

      <div className={`font-preview-card ${isDark ? 'dark' : 'light'}`}>
        <div className="font-preview-header">
          <div>
            <span className="setting-label">{t('fontPreview')}</span>
            <p className="setting-description font-preview-description">{t('fontPreviewDescription')}</p>
          </div>
          <span className={`font-preview-chip ${isDark ? 'dark' : 'light'}`}>{selectedFontSize}px</span>
        </div>
        <div
          className="font-preview-surface"
          data-testid="font-preview"
          style={{
            fontFamily: resolveFontFamily(selectedFontFamily),
            fontSize: `${selectedFontSize}px`,
            color: selectedFontColor,
          }}
        >
          <p className="font-preview-kicker">{t('fontPreviewKicker')}</p>
          <p className="font-preview-sample">{t('fontPreviewSample')}</p>
        </div>
      </div>
    </>
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
      <div className="setting-row horizontal read-dates-row">
        <div className="setting-info">
          <span className="setting-label">{t('readDates')}</span>
          <span className="setting-description">{t('readDatesDescription')}</span>
        </div>
        <div className="theme-switch-container setting-row-control">
          <button
            type="button"
            className={`theme-switch ${readDates === false ? 'light' : 'dark'}`}
            onClick={() => handleChange({ target: { name: 'readDates', value: readDates === false ? 'true' : 'false' } })}
            aria-label={t('readDates')}
          >
            <span className={`switch-thumb ${readDates === false ? 'off' : 'on'}`} />
          </button>
        </div>
      </div>

      <div className="setting-row horizontal">
        <div className="setting-info">
          <span className="setting-label">{t('ttsVoice')}</span>
          <span className="setting-description">{t('ttsVoiceDescription')}</span>
        </div>
        <div className="voice-controls">
          <select
            name="ttsVoiceUri"
            value={selectedVoiceValue}
            onChange={handleChange}
            aria-label={t('ttsVoice')}
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
      <h3 className="section-title">{t('appearance')}</h3>
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
        t={t}
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
