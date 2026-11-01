import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import ComfortReadsCard from './ComfortReadsCard';
import { markOfferedOn, wasOfferedOn, type SavedEntry } from './comfortReadsState';
import type { ComfortRead } from '../../services/api/comfortReadsService';
import { getTranslation, type Language } from '../../utils/translations';

const comfortService = vi.hoisted(() => ({ pick: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 7 } as { id: number } | null }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => comfortService }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));

const READS: ComfortRead[] = [
  { id: 11, date: '2025-06-14', index: 1, title: 'The lake', excerpt: 'We swam before anyone else was up.' },
  { id: 12, date: '2024-12-24', index: 1, title: null, excerpt: 'Soup from Lea, still warm.' },
];
const TODAY = '2026-10-27';

function renderCard(saved: SavedEntry | null, props: { enabled?: boolean; language?: Language } = {}) {
  const onOpenEntry = vi.fn();
  const language = props.language ?? 'en';
  const card = (next: SavedEntry | null, enabled = props.enabled ?? true) => (
    <ComfortReadsCard
      saved={next}
      enabled={enabled}
      onOpenEntry={onOpenEntry}
      language={language}
      theme="light"
      t={(key, params) => getTranslation(language, key, params)}
    />
  );
  const view = render(card(saved));
  return { ...view, onOpenEntry, rerenderWith: (next: SavedEntry | null, enabled?: boolean) => view.rerender(card(next, enabled)) };
}

const region = () => screen.queryByRole('region', { name: 'A few pages you once held close' });

describe('ComfortReadsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    auth.user = { id: 7 };
    comfortService.pick.mockResolvedValue({ data: { entries: READS }, error: null });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 21, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers the picks after an entry saved with a very low mood, announced politely, without taking focus', async () => {
    const before = document.activeElement;
    renderCard({ id: 30, mood: 1 });

    expect(await screen.findByRole('region', { name: 'A few pages you once held close' })).toBeInTheDocument();
    expect(comfortService.pick).toHaveBeenCalledWith(30);
    expect(screen.getByRole('status')).toHaveTextContent(
      "A few pages you once held close If you'd like, here are entries you kept as favorites or wrote with gratitude.",
    );
    expect(screen.getByRole('button', { name: /June 14, 2025 · The lake/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /December 24, 2024 · Untitled entry/ })).toBeInTheDocument();
    // The excerpts blur with the privacy blur; the titles never do
    expect(screen.getByText('We swam before anyone else was up.')).toHaveClass('privacy-text');
    expect(screen.getByText(/The lake/)).not.toHaveClass('privacy-text');
    expect(document.activeElement).toBe(before);
    expect(wasOfferedOn(7, TODAY)).toBe(true);
  });

  it('opens an entry in the reader among the entries offered', async () => {
    const { onOpenEntry } = renderCard({ id: 30, mood: 1 });

    fireEvent.click(await screen.findByRole('button', { name: /Untitled entry/ }));
    expect(onOpenEntry).toHaveBeenCalledWith(12, [11, 12]);
    // The card stays, so the reader gives focus back to it
    expect(region()).toBeInTheDocument();
  });

  it.each([
    ['another mood', { id: 30, mood: 2 }, true],
    ['no mood', { id: 30, mood: null }, true],
    ['no save yet', null, true],
    ['the setting turned off', { id: 30, mood: 1 }, false],
  ])('asks for nothing after %s', async (_case, saved, enabled) => {
    renderCard(saved, { enabled });
    await act(async () => {});

    expect(comfortService.pick).not.toHaveBeenCalled();
    expect(region()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('shows nothing at all when there is nothing to offer, or the request fails, and keeps the day open', async () => {
    comfortService.pick.mockResolvedValueOnce({ data: { entries: [] }, error: null });
    const { rerenderWith } = renderCard({ id: 30, mood: 1 });
    await waitFor(() => expect(comfortService.pick).toHaveBeenCalledTimes(1));
    expect(region()).toBeNull();

    comfortService.pick.mockResolvedValueOnce({ data: null, error: 'comfortReadsLoadFailed' });
    rerenderWith({ id: 31, mood: 1 });
    await waitFor(() => expect(comfortService.pick).toHaveBeenCalledTimes(2));
    expect(region()).toBeNull();
    expect(wasOfferedOn(7, TODAY)).toBe(false);
  });

  it('offers once a day: not again after another very low entry, but again the next day', async () => {
    markOfferedOn(7, TODAY);
    const { rerenderWith } = renderCard({ id: 30, mood: 1 });
    await act(async () => {});
    expect(comfortService.pick).not.toHaveBeenCalled();

    vi.setSystemTime(new Date(2026, 9, 28, 8, 0));
    rerenderWith({ id: 31, mood: 1 });
    expect(await screen.findByRole('region', { name: 'A few pages you once held close' })).toBeInTheDocument();
  });

  it('counts the day for the writer signed in only, and waits for one', async () => {
    markOfferedOn(8, TODAY);
    auth.user = null;
    const { rerenderWith } = renderCard({ id: 30, mood: 1 });
    await act(async () => {});
    expect(comfortService.pick).not.toHaveBeenCalled();

    auth.user = { id: 7 };
    rerenderWith({ id: 31, mood: 1 });
    expect(await screen.findByRole('region', { name: 'A few pages you once held close' })).toBeInTheDocument();
  });

  it('goes away with "Not now", and with a later save', async () => {
    const { rerenderWith } = renderCard({ id: 30, mood: 1 });
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(region()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');

    vi.setSystemTime(new Date(2026, 9, 28, 8, 0));
    rerenderWith({ id: 31, mood: 1 });
    await screen.findByRole('region', { name: 'A few pages you once held close' });
    rerenderWith({ id: 32, mood: 4 });
    expect(region()).toBeNull();
  });

  it('goes away with Escape on the page or in the card, but not in a field or a dialog', async () => {
    const { rerenderWith } = renderCard({ id: 30, mood: 1 });
    await screen.findByRole('region', { name: 'A few pages you once held close' });

    const field = document.createElement('input');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const insideDialog = document.createElement('button');
    dialog.append(insideDialog);
    document.body.append(field, dialog);
    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.keyDown(insideDialog, { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(region()).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(region()).toBeNull();
    field.remove();
    dialog.remove();

    vi.setSystemTime(new Date(2026, 9, 28, 8, 0));
    rerenderWith({ id: 31, mood: 1 });
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Not now' }), { key: 'Escape' });
    expect(region()).toBeNull();
  });

  it('drops an answer that comes after a newer save', async () => {
    let answer: (value: unknown) => void = () => {};
    comfortService.pick.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const { rerenderWith } = renderCard({ id: 30, mood: 1 });
    rerenderWith({ id: 31, mood: 3 });
    await act(async () => answer({ data: { entries: READS }, error: null }));

    expect(region()).toBeNull();
    expect(wasOfferedOn(7, TODAY)).toBe(false);
  });

  it('speaks French', async () => {
    renderCard({ id: 30, mood: 1 }, { language: 'fr' });

    expect(await screen.findByRole('region', { name: 'Quelques pages qui vous sont chères' })).toHaveTextContent(
      'Si le cœur vous en dit, voici des entrées que vous avez gardées en favori ou écrites avec gratitude.',
    );
    expect(screen.getByRole('button', { name: /24 décembre 2024 · Entrée sans titre/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pas maintenant' })).toBeInTheDocument();
  });
});
