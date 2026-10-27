import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CARD_LOGO_SRC, useCardLogo } from './useCardLogo';

const images: FakeImage[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  src = '';
  constructor() {
    images.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  images.length = 0;
});

describe('useCardLogo', () => {
  it('loads the app logo and hands it over once it has loaded', () => {
    vi.stubGlobal('Image', FakeImage);
    const { result } = renderHook(() => useCardLogo());

    expect(result.current).toBeNull();
    expect(images[0]?.src).toBe(CARD_LOGO_SRC);

    act(() => images[0]?.onload?.());

    expect(result.current).toBe(images[0]);
  });

  it('stops listening once the dialog is gone', () => {
    vi.stubGlobal('Image', FakeImage);
    const { unmount } = renderHook(() => useCardLogo());

    unmount();

    expect(images[0]?.onload).toBeNull();
  });
});
