import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { FeedEntrySource } from '../EntriesList/entryReply';
import { COMPOSER_FOCUS_STATE, useComposerFocusRoute, writeAboutState } from './composerFocusRoute';

let goTo: ReturnType<typeof useNavigate> = () => undefined;

function Journal({ focusComposer, writeAbout }: { focusComposer: () => void; writeAbout?: (source: FeedEntrySource) => void }) {
  useComposerFocusRoute(focusComposer, writeAbout);
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

  it('fills the composer once from a feed entry, then drops the request from the history entry', () => {
    const focusComposer = vi.fn();
    const writeAbout = vi.fn();
    const state = writeAboutState({ content: 'A walk', format: 'plain', username: 'maya', extra: 'dropped' } as FeedEntrySource);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/journal', search: '?diary=2', state }]}>
        <Journal focusComposer={focusComposer} writeAbout={writeAbout} />
      </MemoryRouter>,
    );

    expect(writeAbout).toHaveBeenCalledTimes(1);
    expect(writeAbout).toHaveBeenCalledWith({ content: 'A walk', format: 'plain', username: 'maya' });
    expect(focusComposer).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/journal?diary=2|null');
  });

  it('ignores a feed entry it cannot read, or with nothing to fill the composer with', () => {
    const focusComposer = vi.fn();
    const writeAbout = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/journal', state: { writeAbout: { content: 'A walk', format: 'html', username: 'maya' } } }]}>
        <Journal focusComposer={focusComposer} writeAbout={writeAbout} />
      </MemoryRouter>,
    );
    act(() => { void goTo('/journal', { state: { writeAbout: 'A walk' } }); });
    expect(writeAbout).not.toHaveBeenCalled();
    expect(focusComposer).not.toHaveBeenCalled();
  });

  it('leaves the composer alone on a feed entry when the journal cannot write about one', () => {
    const focusComposer = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/journal', state: writeAboutState({ content: 'A walk', format: 'plain', username: 'maya' }) }]}>
        <Journal focusComposer={focusComposer} />
      </MemoryRouter>,
    );
    expect(focusComposer).not.toHaveBeenCalled();
  });
});
