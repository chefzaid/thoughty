import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import OfflineNotice from './OfflineNotice';
import { getTranslation } from '../../utils/translations';

const en = (key: string) => getTranslation('en', key);
const fr = (key: string) => getTranslation('fr', key);

function setBrowserOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => { globalThis.dispatchEvent(new Event(online ? 'online' : 'offline')); });
}

describe('OfflineNotice', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says nothing while the app is online', () => {
    render(<OfflineNotice offline={false} t={en} />);

    expect(screen.queryByTestId('offline-notice')).toBeNull();
  });

  it('says the journal is offline while the session waits for the API, in French too', () => {
    const { rerender } = render(<OfflineNotice offline t={en} />);

    expect(screen.getByRole('status')).toHaveTextContent('You’re offline You can keep writing: your draft stays on this device');

    rerender(<OfflineNotice offline t={fr} theme="light" />);
    expect(screen.getByRole('status')).toHaveTextContent('Vous êtes hors ligne');
    expect(screen.getByRole('status').className).toContain('bg-amber-50');
  });

  it('follows the browser losing and getting back its connection', () => {
    render(<OfflineNotice offline={false} t={en} />);

    setBrowserOnline(false);
    expect(screen.getByTestId('offline-notice')).toBeInTheDocument();

    setBrowserOnline(true);
    expect(screen.queryByTestId('offline-notice')).toBeNull();
  });
});
