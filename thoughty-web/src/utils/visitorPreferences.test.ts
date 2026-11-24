import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserLanguage,
  rememberVisitorLanguage,
  rememberVisitorTheme,
  storedVisitorLanguage,
  storedVisitorTheme,
  systemTheme,
  watchSystemTheme,
} from './visitorPreferences';
import { stubSystemScheme } from '../test/systemScheme';


describe('visitorPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('reads the first English or French language the browser lists, English otherwise', () => {
    expect(browserLanguage(['fr-FR', 'en'])).toBe('fr');
    expect(browserLanguage(['FR'])).toBe('fr');
    expect(browserLanguage(['de-DE', 'en-GB', 'fr'])).toBe('en');
    expect(browserLanguage(['de-DE', 'fr-CA'])).toBe('fr');
    expect(browserLanguage(['de-DE'])).toBe('en');
    expect(browserLanguage(['french'])).toBe('en');
    expect(browserLanguage([])).toBe('en');
    // jsdom's browser is English
    expect(browserLanguage()).toBe('en');
  });

  it('follows the system theme, dark when it says nothing', () => {
    expect(systemTheme()).toBe('dark');
    stubSystemScheme(true);
    expect(systemTheme()).toBe('light');
    stubSystemScheme(false);
    expect(systemTheme()).toBe('dark');
  });

  it('reports a change of the system theme until it is stopped', () => {
    const scheme = stubSystemScheme(false);
    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);
    scheme.switchTo(true);
    expect(onChange).toHaveBeenLastCalledWith('light');
    scheme.switchTo(false);
    expect(onChange).toHaveBeenLastCalledWith('dark');
    stop();
    expect(scheme.listeners.size).toBe(0);
  });

  it('watches nothing where the browser cannot tell the system theme', () => {
    expect(() => watchSystemTheme(vi.fn())()).not.toThrow();
  });

  it('remembers the language and theme a visitor picked, and ignores anything else stored', () => {
    expect(storedVisitorLanguage()).toBeNull();
    expect(storedVisitorTheme()).toBeNull();
    rememberVisitorLanguage('fr');
    rememberVisitorTheme('light');
    expect(storedVisitorLanguage()).toBe('fr');
    expect(storedVisitorTheme()).toBe('light');

    localStorage.setItem('thoughty.visitorLanguage', 'de');
    localStorage.setItem('thoughty.visitorTheme', 'sepia');
    expect(storedVisitorLanguage()).toBeNull();
    expect(storedVisitorTheme()).toBeNull();
  });

  it('keeps working when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => rememberVisitorLanguage('fr')).not.toThrow();
    expect(() => rememberVisitorTheme('light')).not.toThrow();
    expect(storedVisitorLanguage()).toBeNull();
    expect(storedVisitorTheme()).toBeNull();
  });
});
