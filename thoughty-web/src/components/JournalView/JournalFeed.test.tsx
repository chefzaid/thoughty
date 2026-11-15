import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

import JournalFeed, { type JournalFeedState } from './JournalFeed';
import type { Entry } from '../../types';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const entry = (id: number): Entry => ({ id, date: '2024-03-01', index: 1, content: `Entry ${id}`, tags: [], visibility: 'private' }) as Entry;

/** Observers created by the feed, so a test can bring a marker into view. */
let observers: Array<{ callback: IntersectionObserverCallback; element: Element | null; disconnected: boolean }> = [];

function feedState(overrides: Partial<JournalFeedState> = {}): JournalFeedState {
  return {
    total: 60,
    hasOlder: true,
    hasNewer: false,
    loadingOlder: false,
    loadingNewer: false,
    loadError: false,
    loadOlder: vi.fn(),
    loadNewer: vi.fn(),
    ...overrides,
  };
}

function Feed(props: Partial<ComponentProps<typeof JournalFeed>> & { ids?: number[] }) {
  const { ids = [1, 2, 3], ...rest } = props;
  const entries = ids.map(entry);
  return (
    <JournalFeed feed={feedState()} entries={entries} reloading={false} autoLoadNewer language="en" theme="dark" t={t} {...rest}>
      <div role="feed" aria-label="Journal entries">
        {entries.map((item) => <article key={item.id} data-entry-id={item.id} tabIndex={-1} aria-label={`Entry ${item.id}`}>Entry {item.id}</article>)}
      </div>
    </JournalFeed>
  );
}

const article = (id: number) => screen.getByRole('article', { name: `Entry ${id}` });

describe('JournalFeed', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('IntersectionObserver', class {
      private readonly record: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, element: null, disconnected: false };
        observers.push(this.record);
      }
      observe(element: Element) { this.record.element = element; }
      disconnect() { this.record.disconnected = true; }
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const bringIntoView = (index: number) => act(() => {
    const live = observers.filter((observer) => !observer.disconnected);
    const observer = live[index]!;
    observer.callback([{ isIntersecting: true, target: observer.element } as IntersectionObserverEntry], {} as IntersectionObserver);
  });

  it('loads the next entries as the end of the list comes near, and newer ones only when allowed', () => {
    const feed = feedState({ hasNewer: true });
    const { rerender } = render(<Feed feed={feed} autoLoadNewer={false} />);

    expect(observers.filter((observer) => !observer.disconnected)).toHaveLength(1);
    bringIntoView(0);
    expect(feed.loadOlder).toHaveBeenCalledTimes(1);
    expect(feed.loadNewer).not.toHaveBeenCalled();

    rerender(<Feed feed={feed} autoLoadNewer />);
    const live = observers.filter((observer) => !observer.disconnected);
    expect(live).toHaveLength(2);
    bringIntoView(1);
    expect(feed.loadNewer).toHaveBeenCalledTimes(1);
  });

  it('waits while the list is read again or a batch failed, and offers the buttons instead', () => {
    const feed = feedState({ hasNewer: true, loadError: true });
    render(<Feed feed={feed} />);

    expect(observers.filter((observer) => !observer.disconnected)).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('The entries could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Load more entries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show newer entries' }));
    expect(feed.loadOlder).toHaveBeenCalledTimes(1);
    expect(feed.loadNewer).toHaveBeenCalledTimes(1);
  });

  it('keeps the button in place while a batch loads, says so and announces what came', () => {
    const feed = feedState();
    const { rerender } = render(<Feed feed={feed} />);
    const button = screen.getByRole('button', { name: 'Load more entries' });
    button.focus();
    fireEvent.click(button);

    rerender(<Feed feed={{ ...feed, loadingOlder: true }} />);
    const busy = screen.getByRole('button', { name: 'Loading more entries…' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(busy);
    expect(feed.loadOlder).toHaveBeenCalledTimes(1);

    rerender(<Feed feed={feed} ids={[1, 2, 3, 4, 5]} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 more entries loaded, 5 of 60 shown.');
    expect(screen.getByRole('button', { name: 'Load more entries' })).toHaveFocus();
  });

  it('hands focus to the first entry a batch brought when its button goes away', () => {
    const feed = feedState();
    const { rerender } = render(<Feed feed={feed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more entries' }));
    rerender(<Feed feed={{ ...feed, loadingOlder: true }} />);

    rerender(<Feed feed={{ ...feed, hasOlder: false }} ids={[1, 2, 3, 4]} />);

    expect(article(4)).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Load more entries' })).not.toBeInTheDocument();
  });

  it('counts a newer batch from the entry that was first, after the oldest batch was let go of', () => {
    const feed = feedState({ hasNewer: true });
    const { rerender } = render(<Feed feed={feed} ids={[3, 4, 5]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show newer entries' }));
    rerender(<Feed feed={{ ...feed, loadingNewer: true }} ids={[3, 4, 5]} />);

    rerender(<Feed feed={{ ...feed, hasNewer: false }} ids={[1, 2, 3, 4]} />);

    expect(screen.getByRole('status')).toHaveTextContent('2 more entries loaded, 4 of 60 shown.');
    expect(article(1)).toHaveFocus();
  });

  it('says when every entry has been loaded, once there were more than a batch', () => {
    const { rerender } = render(<Feed feed={feedState({ hasOlder: false, total: 3 })} />);
    expect(screen.queryByText('No more entries to load.')).not.toBeInTheDocument();

    rerender(<Feed feed={feedState({ hasOlder: false, total: 45 })} />);
    expect(screen.getByText('No more entries to load.')).toBeInTheDocument();
  });

  describe('arrow keys', () => {
    it('moves to the next and previous entry, from the one focused or the first on screen', () => {
      render(<Feed />);

      fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      expect(article(1)).toHaveFocus();
      fireEvent.keyDown(article(1), { key: 'ArrowRight' });
      expect(article(2)).toHaveFocus();
      fireEvent.keyDown(article(2), { key: 'PageDown' });
      expect(article(3)).toHaveFocus();
      fireEvent.keyDown(article(3), { key: 'ArrowLeft' });
      fireEvent.keyDown(article(2), { key: 'PageUp' });
      expect(article(1)).toHaveFocus();
    });

    it('loads the next batch at the end and moves on once it has come', () => {
      const feed = feedState({ hasNewer: true });
      const { rerender } = render(<Feed feed={feed} />);
      article(3).focus();

      fireEvent.keyDown(article(3), { key: 'ArrowRight' });
      expect(feed.loadOlder).toHaveBeenCalledTimes(1);
      rerender(<Feed feed={feed} ids={[1, 2, 3, 4]} />);
      expect(article(4)).toHaveFocus();

      article(1).focus();
      fireEvent.keyDown(article(1), { key: 'ArrowLeft' });
      expect(feed.loadNewer).toHaveBeenCalledTimes(1);
      rerender(<Feed feed={feed} ids={[0, 1, 2, 3, 4]} />);
      expect(article(0)).toHaveFocus();
    });

    it('gives up a move when nothing more is left that way', () => {
      const feed = feedState({ hasOlder: false });
      render(<Feed feed={feed} />);
      article(3).focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      article(3).dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(feed.loadOlder).not.toHaveBeenCalled();
      expect(article(3)).toHaveFocus();
    });

    it('leaves the keys to fields, widgets that use them, modifiers and Page keys outside the list', () => {
      render(
        <>
          <input aria-label="Text" />
          <div role="dialog" aria-label="Dialog"><button type="button">Inside</button></div>
          <Feed />
        </>,
      );

      fireEvent.keyDown(screen.getByLabelText('Text'), { key: 'ArrowRight' });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Inside' }), { key: 'ArrowRight' });
      fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
      fireEvent.keyDown(document.body, { key: 'PageDown' });
      const handled = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      handled.preventDefault();
      document.body.dispatchEvent(handled);

      expect(document.activeElement).toBe(document.body);
    });
  });
});
