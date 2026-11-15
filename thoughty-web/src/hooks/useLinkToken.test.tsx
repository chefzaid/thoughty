import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useLinkToken } from './useLinkToken';

const wrapper = ({ children }: { children: ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;

function renderAt(path: string) {
  globalThis.history.replaceState({ start: true }, '', path);
  const lengthBefore = globalThis.history.length;
  const hook = renderHook(() => ({ token: useLinkToken(), navigate: useNavigate() }), { wrapper });
  return { ...hook, lengthBefore };
}

describe('useLinkToken', () => {
  it('reads the token and takes it out of the address without a new history entry', () => {
    const { result, lengthBefore } = renderAt('/verify-email?token=%20secret-token%20');

    expect(result.current.token).toBe('secret-token');
    expect(globalThis.location.pathname).toBe('/verify-email');
    expect(globalThis.location.search).toBe('');
    expect(globalThis.history.length).toBe(lengthBefore);
  });

  it('keeps the other parameters of the address', () => {
    renderAt('/complete-sign-up?lang=fr&token=secret-token');

    expect(globalThis.location.search).toBe('?lang=fr');
  });

  it('keeps the token it read once the address no longer has it', () => {
    const { result } = renderAt('/reset-password?token=secret-token');

    act(() => result.current.navigate('/reset-password?other=1', { replace: true }));

    expect(result.current.token).toBe('secret-token');
  });

  it('reads no token from an address without one, and leaves it as it was', () => {
    const { result } = renderAt('/reset-password?other=1');

    expect(result.current.token).toBe('');
    expect(globalThis.location.search).toBe('?other=1');
  });
});
