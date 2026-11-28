import type { ComponentType } from 'react';
import { act, render, screen } from '@testing-library/react';
import { Navigate, type NavigateProps, UNSAFE_createMemoryHistory, unstable_HistoryRouter as HistoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { historyWithLateNavigation, type MemoryHistory } from '../test/lateNavigation';
import Redirect from './Redirect';

type RedirectComponent = ComponentType<NavigateProps>;

function Page({ redirect: Redirecting }: Readonly<{ redirect: RedirectComponent }>) {
  const { pathname } = useLocation();
  return pathname === '/' ? <Redirecting to="/fr/" replace /> : <p>{`Shown at ${pathname}`}</p>;
}

function renderWith(redirect: RedirectComponent, history: MemoryHistory) {
  return render(
    <HistoryRouter history={history}>
      <Page redirect={redirect} />
    </HistoryRouter>,
  );
}

describe('Redirect', () => {
  it('redirects again when a navigation brings the page back before its redirect was shown', async () => {
    const history = historyWithLateNavigation('/', '/fr/');
    renderWith(Redirect, history);

    expect(await screen.findByText('Shown at /fr/')).toBeVisible();
    expect(history.location.pathname).toBe('/fr/');
  });

  it('is needed: React Router’s own Navigate stays on an empty page then', async () => {
    const history = historyWithLateNavigation('/', '/fr/');
    const { container } = renderWith(Navigate, history);
    await act(async () => {});

    expect(history.location.pathname).toBe('/');
    expect(container).toBeEmptyDOMElement();
  });

  it('does nothing on the address it would send to', async () => {
    const history = UNSAFE_createMemoryHistory({ initialEntries: ['/fr/?from=mail#top'], v5Compat: true });
    const replace = vi.spyOn(history, 'replace');
    const { container } = render(
      <HistoryRouter history={history}>
        <Redirect to={{ pathname: '/fr/', search: '?from=mail', hash: '#top' }} replace />
      </HistoryRouter>,
    );
    await act(async () => {});

    expect(replace).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects once when nothing else navigates', async () => {
    const history = UNSAFE_createMemoryHistory({ initialEntries: ['/'], v5Compat: true });
    renderWith(Redirect, history);

    expect(await screen.findByText('Shown at /fr/')).toBeVisible();
    expect(history.index).toBe(0);
  });
});
