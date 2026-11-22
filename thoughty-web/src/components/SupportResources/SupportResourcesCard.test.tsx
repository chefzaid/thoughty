import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import type { SavedEntry } from '../ComfortReads/comfortReadsState';
import SupportAfterSave from './SupportAfterSave';
import SupportResourcesCard from './SupportResourcesCard';

const en = (key: string) => getTranslation('en', key);
const fr = (key: string) => getTranslation('fr', key);

describe('SupportResourcesCard', () => {
  it('lists the crisis lines as links that call them, and the directory as a link that opens it', () => {
    render(<SupportResourcesCard onClose={vi.fn()} theme="dark" t={en} />);

    const card = screen.getByRole('region', { name: "You don't have to face this alone" });
    expect(screen.getByRole('heading', { level: 2, name: "You don't have to face this alone" })).toBeInTheDocument();
    const lines = within(card).getAllByRole('listitem');
    expect(lines.map((line) => line.textContent)).toEqual([
      'Emergency: 112, in Europe, or your local emergency number',
      'France: 3114, national suicide prevention line, free, day and night',
      'UK and Ireland: 116 123, Samaritans, free, day and night',
      'United States and Canada: 988, call or text the Suicide and Crisis Lifeline',
      'Anywhere else: findahelpline.com, free helplines in your country',
    ]);
    expect(within(card).getByRole('link', { name: '3114' })).toHaveAttribute('href', 'tel:3114');
    expect(within(card).getByRole('link', { name: '116 123' })).toHaveAttribute('href', 'tel:116123');
    expect(within(card).getByRole('link', { name: '112' })).not.toHaveAttribute('target');
    const directory = within(card).getByRole('link', { name: 'findahelpline.com' });
    expect(directory).toHaveAttribute('href', 'https://findahelpline.com');
    expect(directory).toHaveAttribute('target', '_blank');
    expect(directory).toHaveAttribute('rel', 'noreferrer');
    expect(card).toHaveTextContent('not a replacement for a doctor');
    expect(screen.getByRole('status')).toHaveTextContent("You don't have to face this alone If you are thinking about suicide");
  });

  it('speaks French, takes the heading level it is given, and closes from its button or Escape', async () => {
    const onClose = vi.fn();
    render(<SupportResourcesCard onClose={onClose} theme="light" t={fr} headingLevel={4} />);

    expect(screen.getByRole('heading', { level: 4, name: "De l'aide est là pour vous" })).toBeInTheDocument();
    expect(screen.getByText('Royaume-Uni et Irlande')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledOnce();

    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    fireEvent.keyDown(screen.getByRole('link', { name: '3114' }), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('link', { name: '3114' }), { key: 'Tab' });
    document.removeEventListener('keydown', outside);
    expect(onClose).toHaveBeenCalledTimes(2);
    // Escape stays the card's own, so a dialog around it does not close too
    expect(outside).toHaveBeenCalledOnce();
  });
});

describe('SupportAfterSave', () => {
  const renderAfter = (saved: SavedEntry | null) => {
    const view = render(<SupportAfterSave saved={saved} theme="dark" t={en} />);
    return { ...view, rerenderWith: (next: SavedEntry | null) => view.rerender(<SupportAfterSave saved={next} theme="dark" t={en} />) };
  };
  const card = () => screen.queryByRole('region', { name: "You don't have to face this alone" });

  it.each([
    ['before any save', null],
    ['after a save without a sign of crisis', { id: 1, mood: 1, crisisSignal: false }],
    ['after a save that says nothing of it', { id: 1, mood: null }],
  ])('shows nothing %s', (_label, saved) => {
    renderAfter(saved);
    expect(card()).not.toBeInTheDocument();
  });

  it('shows the card after a save that carries a sign of crisis, until closed, and again after the next one', async () => {
    const first = { id: 1, mood: null, crisisSignal: true };
    const { rerenderWith } = renderAfter(first);
    expect(card()).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(card()).not.toBeInTheDocument();
    rerenderWith(first);
    expect(card()).not.toBeInTheDocument();

    rerenderWith({ id: 2, mood: null, crisisSignal: true });
    expect(card()).toBeInTheDocument();
    rerenderWith({ id: 3, mood: 4, crisisSignal: false });
    expect(card()).not.toBeInTheDocument();
  });
});
