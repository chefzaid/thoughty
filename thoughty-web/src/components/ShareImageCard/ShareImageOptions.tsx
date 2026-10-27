import { useId } from 'react';
import type { TranslationFunction as TranslationFn } from '../../types';
import {
  CARD_SIZE_IDS,
  CARD_TEXT_MAX_LENGTH,
  CARD_THEME_IDS,
  type CardSizeId,
  type CardThemeId,
} from './shareCardLayout';

const THEME_LABELS: Record<CardThemeId, string> = {
  light: 'shareImageThemeLight',
  dark: 'shareImageThemeDark',
  violet: 'shareImageThemeViolet',
};

const SIZE_LABELS: Record<CardSizeId, string> = {
  square: 'shareImageSizeSquare',
  portrait: 'shareImageSizePortrait',
};

export interface ShareImageChoices {
  readonly text: string;
  readonly includeTitle: boolean;
  readonly showMark: boolean;
  readonly theme: CardThemeId;
  readonly size: CardSizeId;
}

interface ShareImageOptionsProps {
  readonly choices: ShareImageChoices;
  readonly wholeText: string;
  readonly hasTitle: boolean;
  readonly isDark: boolean;
  readonly onChange: (changes: Partial<ShareImageChoices>) => void;
  readonly t: TranslationFn;
}

interface ChoiceGroupProps<T extends string> {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly labelOf: (option: T) => string;
  readonly swatchOf?: (option: T) => string;
  readonly isDark: boolean;
  readonly onSelect: (option: T) => void;
}

/** A row of radio buttons drawn as pills; arrow keys move between them as with any radio group. */
function ChoiceGroup<T extends string>({ legend, name, options, value, labelOf, swatchOf, isDark, onSelect }: Readonly<ChoiceGroupProps<T>>) {
  const idleClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-sky-500 ${value === option ? 'border-sky-500 bg-sky-500/15' : idleClass}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onSelect(option)}
              className="sr-only"
            />
            {swatchOf && (
              <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full border ${isDark ? 'border-gray-500' : 'border-gray-300'} ${swatchOf(option)}`} />
            )}
            {labelOf(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const SWATCHES: Record<CardThemeId, string> = {
  light: 'bg-white',
  dark: 'bg-gray-900',
  violet: 'bg-gradient-to-br from-blue-500 via-violet-600 to-purple-600',
};

/** The card's text and look: the excerpt, the title and mark switches, the colors and the size. */
export default function ShareImageOptions({ choices, wholeText, hasTitle, isDark, onChange, t }: ShareImageOptionsProps) {
  const groupName = useId();
  const textId = useId();
  const hintId = useId();
  const inputClass = isDark
    ? 'border-gray-600 bg-gray-900 text-gray-100'
    : 'border-gray-300 bg-white text-gray-900';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor={textId} className="text-sm font-medium">{t('shareImageText')}</label>
          {choices.text !== wholeText && (
            <button
              type="button"
              onClick={() => onChange({ text: wholeText })}
              className="text-xs font-medium text-sky-500 underline-offset-2 hover:underline"
            >
              {t('shareImageUseWholeEntry')}
            </button>
          )}
        </div>
        <textarea
          id={textId}
          value={choices.text}
          onChange={(event) => onChange({ text: event.target.value })}
          maxLength={CARD_TEXT_MAX_LENGTH}
          rows={5}
          aria-describedby={hintId}
          className={`w-full resize-y rounded border px-3 py-2 text-sm outline-none focus:border-sky-500 ${inputClass}`}
        />
        <p id={hintId} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('shareImageTextHint')}</p>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {hasTitle && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={choices.includeTitle} onChange={(event) => onChange({ includeTitle: event.target.checked })} />
            {t('shareImageIncludeTitle')}
          </label>
        )}
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={choices.showMark} onChange={(event) => onChange({ showMark: event.target.checked })} />
          {t('shareImageShowMark')}
        </label>
      </div>
      <ChoiceGroup
        legend={t('shareImageColors')}
        name={`${groupName}-theme`}
        options={CARD_THEME_IDS}
        value={choices.theme}
        labelOf={(theme) => t(THEME_LABELS[theme])}
        swatchOf={(theme) => SWATCHES[theme]}
        isDark={isDark}
        onSelect={(theme) => onChange({ theme })}
      />
      <ChoiceGroup
        legend={t('shareImageSize')}
        name={`${groupName}-size`}
        options={CARD_SIZE_IDS}
        value={choices.size}
        labelOf={(size) => t(SIZE_LABELS[size])}
        isDark={isDark}
        onSelect={(size) => onChange({ size })}
      />
    </div>
  );
}
