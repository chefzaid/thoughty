import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { COMPOSER_FOCUS_STATE, useComposerFocusRoute } from './composerFocusRoute';

let goTo: ReturnType<typeof useNavigate> = () => undefined;

function Journal({ focusComposer }: { focusComposer: () => void }) {
  useComposerFocusRoute(focusComposer);
  goTo = useNavigate();
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}|${JSON.stringify(location.state)}`}</p>;
}

describe('useComposerFocusRoute', () => {
  it('focuses the composer once when asked, then drops the request from the history entry', () => {
    const focusComposer = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/journal', search: '?diary=2', state: COMPOSER_FOCUS_STATE }]}>
        <Journal focusComposer={focusComposer} />
      </MemoryRouter>,
    );

    expect(focusComposer).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/journal?diary=2|null');

    // Asked again on the same page (quick capture's Open in full while in the journal)
    act(() => { void goTo({ pathname: '/journal', search: '?diary=2' }, { state: COMPOSER_FOCUS_STATE }); });
    expect(focusComposer).toHaveBeenCalledTimes(2);
  });

  it('leaves focus alone on any other visit', () => {
    const focusComposer = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/journal', state: { from: 'elsewhere' } }]}>
        <Journal focusComposer={focusComposer} />
      </MemoryRouter>,
    );
    act(() => { void goTo('/journal?page=2'); });
    expect(focusComposer).not.toHaveBeenCalled();
  });
});
