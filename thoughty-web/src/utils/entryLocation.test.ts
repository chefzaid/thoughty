import { describe, expect, it } from 'vitest';
import { getTranslation } from './translations';
import { formatCoordinates, hasCoordinates, isLocationSet, locationDraft, locationLabel, locationPayload, NO_LOCATION } from './entryLocation';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const tFr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

describe('entry places', () => {
  it('reads a saved place into the editor, and none as an empty one', () => {
    expect(locationDraft({ name: 'Annecy', latitude: 45.9, longitude: 6.13 })).toEqual({ name: 'Annecy', latitude: 45.9, longitude: 6.13 });
    expect(locationDraft({ name: null, latitude: 45.9, longitude: null })).toEqual({ name: '', latitude: null, longitude: null });
    expect(locationDraft(null)).toBe(NO_LOCATION);
    expect(locationDraft(undefined)).toBe(NO_LOCATION);
  });

  it('sends a name on one line, coordinates as a pair, and null for no place', () => {
    expect(locationPayload({ name: '  Lake \n Annecy ', latitude: null, longitude: null })).toEqual({ name: 'Lake Annecy' });
    expect(locationPayload({ name: '', latitude: 45.9, longitude: 6.13 })).toEqual({ name: null, latitude: 45.9, longitude: 6.13 });
    expect(locationPayload({ name: '   ', latitude: null, longitude: null })).toBeNull();
    expect(isLocationSet(NO_LOCATION)).toBe(false);
    expect(hasCoordinates({ latitude: 1, longitude: null })).toBe(false);
  });

  it('writes coordinates with the hemispheres, in the app language', () => {
    expect(formatCoordinates(48.846_23, 2.337_19, 'en', t)).toBe('48.8462° N, 2.3372° E');
    expect(formatCoordinates(-33.868_8, -70.5, 'en', t)).toBe('33.8688° S, 70.5° W');
    expect(formatCoordinates(48.846_23, -2.337_19, 'fr', tFr)).toBe('48,8462° N, 2,3372° O');
  });

  it('labels a place by its name, else its coordinates, and nothing without one', () => {
    expect(locationLabel({ name: ' Home ', latitude: 1, longitude: 2 }, 'en', t)).toBe('Home');
    expect(locationLabel({ name: null, latitude: 1, longitude: 2 }, 'en', t)).toBe('1° N, 2° E');
    expect(locationLabel({ name: '', latitude: null, longitude: null }, 'en', t)).toBeNull();
    expect(locationLabel(null, 'en', t)).toBeNull();
  });
});
