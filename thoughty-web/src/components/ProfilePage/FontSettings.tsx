import type { ChangeEvent } from 'react';
import type { TranslationFunction } from './types';
import {
  entrySpacingStyle,
  LETTER_SPACING_OPTIONS,
  LINE_SPACING_OPTIONS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  resolveFontFamily,
  type FontFamilyPreference,
  type LetterSpacingPreference,
  type LineSpacingPreference,
} from '../../types/config';

const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: FontFamilyPreference; labelKey: string }> = [
  { value: 'system', labelKey: 'fontTypeSystem' },
  { value: 'serif', labelKey: 'fontTypeSerif' },
  { value: 'modern', labelKey: 'fontTypeModern' },
  { value: 'mono', labelKey: 'fontTypeMono' },
  { value: 'legible', labelKey: 'fontTypeLegible' },
];

/** `normal` → `lineSpacingNormal`, and so on. */
const stepLabelKey = (setting: 'lineSpacing' | 'letterSpacing', step: string) =>
  `${setting}${step.charAt(0).toUpperCase()}${step.slice(1)}`;

type HandleChange = (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;

function SpacingSelect({
  name,
  value,
  steps,
  handleChange,
  isDark,
  t,
}: Readonly<{
  name: 'lineSpacing' | 'letterSpacing';
  value: string;
  steps: readonly string[];
  handleChange: HandleChange;
  isDark: boolean;
  t: TranslationFunction;
}>) {
  const descriptionId = `${name}-description`;
  return (
    <div className="setting-row">
      <div className="setting-info">
        <label htmlFor={`${name}-select`} className="setting-label">{t(name)}</label>
        <span id={descriptionId} className="setting-description">{t(`${name}Description`)}</span>
      </div>
      <select
        id={`${name}-select`}
        name={name}
        value={value}
        onChange={handleChange}
        aria-describedby={descriptionId}
        className={`setting-select ${isDark ? 'dark' : 'light'}`}
      >
        {steps.map((step) => (
          <option key={step} value={step}>{t(stepLabelKey(name, step))}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * The typeface, size, color and spacing of the writer's text, with a live preview of them together.
 * The spacing steps apply to entry text wherever it is read or written.
 */
export default function FontSettings({
  handleChange,
  isDark,
  selectedFontColor,
  selectedFontFamily,
  selectedFontSize,
  selectedLineSpacing,
  selectedLetterSpacing,
  t,
}: Readonly<{
  handleChange: HandleChange;
  isDark: boolean;
  selectedFontColor: string;
  selectedFontFamily: FontFamilyPreference;
  selectedFontSize: number;
  selectedLineSpacing: LineSpacingPreference;
  selectedLetterSpacing: LetterSpacingPreference;
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

      <div className="settings-row-pair">
        <SpacingSelect
          name="lineSpacing"
          value={selectedLineSpacing}
          steps={LINE_SPACING_OPTIONS}
          handleChange={handleChange}
          isDark={isDark}
          t={t}
        />
        <SpacingSelect
          name="letterSpacing"
          value={selectedLetterSpacing}
          steps={LETTER_SPACING_OPTIONS}
          handleChange={handleChange}
          isDark={isDark}
          t={t}
        />
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
          <p className="font-preview-sample" data-testid="font-preview-sample" style={entrySpacingStyle({ lineSpacing: selectedLineSpacing, letterSpacing: selectedLetterSpacing })}>
            {t('fontPreviewSample')}
          </p>
        </div>
      </div>
    </>
  );
}
