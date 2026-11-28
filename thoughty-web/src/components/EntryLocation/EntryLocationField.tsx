import type { Dispatch, SetStateAction } from 'react';
import type { TranslationFunction } from '../../types';
import { formatCoordinates, hasCoordinates, MAX_LOCATION_NAME_LENGTH, type EntryLocationDraft } from '../../utils/entryLocation';
import { mutedTextClass } from '../../utils/tintedText';
import { useDeviceLocation, type DeviceLocationStatus } from './useDeviceLocation';

interface EntryLocationFieldProps {
  readonly id: string;
  readonly value: EntryLocationDraft;
  readonly onChange: Dispatch<SetStateAction<EntryLocationDraft>>;
  readonly inputClass: string;
  readonly theme?: 'light' | 'dark';
  readonly language: string;
  readonly t: TranslationFunction;
}

const STATUS_MESSAGES: Partial<Record<DeviceLocationStatus, string>> = {
  locating: 'entryLocationLocating',
  found: 'entryLocationFound',
  denied: 'entryLocationDenied',
  unavailable: 'entryLocationUnavailable',
};

/**
 * The entry's optional place: a name the writer types, and the device's coordinates when they press for them.
 * Nothing is asked of the browser until then.
 */
export default function EntryLocationField({ id, value, onChange, inputClass, theme, language, t }: EntryLocationFieldProps) {
  const device = useDeviceLocation((coordinates) => onChange((current) => ({ ...current, ...coordinates })));
  const muted = mutedTextClass(theme !== 'light');
  const buttonClass = `h-10 shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors disabled:opacity-60 ${theme === 'light'
    ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
    : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
    }`;
  const message = STATUS_MESSAGES[device.status];

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">{t('entryLocationLabel')}</label>
        <input
          id={id}
          type="text"
          value={value.name}
          onChange={(event) => {
            const name = event.target.value;
            onChange((current) => ({ ...current, name }));
          }}
          maxLength={MAX_LOCATION_NAME_LENGTH}
          placeholder={t('entryLocationPlaceholder')}
          title={t('entryLocationLabel')}
          className={`${inputClass} privacy-text min-w-[12rem] flex-1`}
        />
        {device.supported && (
          <button type="button" onClick={device.locate} disabled={device.status === 'locating'} className={buttonClass}>
            <span className="codicon codicon-location" aria-hidden="true" />
            {t('entryLocationUseCurrent')}
          </button>
        )}
      </div>
      {hasCoordinates(value) && (
        <p className={`flex flex-wrap items-center gap-2 text-xs ${muted}`}>
          <span className="privacy-text">
            {t('entryLocationCoordinates', { coordinates: formatCoordinates(value.latitude as number, value.longitude as number, language, t) })}
          </span>
          <button
            type="button"
            onClick={() => onChange((current) => ({ ...current, latitude: null, longitude: null }))}
            className="underline underline-offset-2"
          >
            {t('entryLocationRemoveCoordinates')}
          </button>
        </p>
      )}
      <p role="status" className={`text-xs ${muted}`}>{message ? t(message) : ''}</p>
    </div>
  );
}
