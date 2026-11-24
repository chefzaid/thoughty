import { vi } from 'vitest';

/** Stubs `matchMedia` so the system asks for the light theme or not, and lets a test switch it. */
export function stubSystemScheme(light: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: light,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return {
    listeners,
    switchTo(nextLight: boolean) {
      query.matches = nextLight;
      listeners.forEach((listener) => listener({ matches: nextLight } as MediaQueryListEvent));
    },
  };
}

/** Stubs the browser's preferred languages. */
export function stubBrowserLanguages(languages: readonly string[]) {
  vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue(languages);
}
