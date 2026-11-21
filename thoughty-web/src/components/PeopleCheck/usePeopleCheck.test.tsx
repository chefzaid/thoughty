import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Person } from '../../services/api/peopleService';
import { getTranslation, type Language } from '../../utils/translations';
import { usePeopleCheck, type PeopleCheckRequest } from './usePeopleCheck';

const marie: Person = { id: 1, name: 'Marie Dupont', handles: ['marie'], date: null, entryCount: 1, lastMentionedOn: null, createdAt: '', updatedAt: '' };

function Harness({ request, language = 'en', theme = 'dark' }: { request: PeopleCheckRequest; language?: Language; theme?: 'light' | 'dark' }) {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
  const { check, dialog } = usePeopleCheck({ people: [marie], theme, language, t });
  return (
    <>
      <button type="button" onClick={() => check(request)}>Share</button>
      {dialog}
    </>
  );
}

function makeRequest(text: string, mode: PeopleCheckRequest['mode'] = 'editor') {
  return { texts: [{ key: 1, title: '', text }], mode, share: vi.fn(), replace: vi.fn(), cancel: vi.fn() };
}

async function openCheck(request: PeopleCheckRequest, options: { language?: Language; theme?: 'light' | 'dark' } = {}) {
  const user = userEvent.setup();
  render(<Harness request={request} {...options} />);
  await user.click(screen.getByRole('button', { name: 'Share' }));
  return user;
}

describe('usePeopleCheck', () => {
  it('shares at once when the text names no one', async () => {
    const request = makeRequest('A quiet day');
    await openCheck(request);

    expect(request.share).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the people named, with initials first, and shares on Share anyway', async () => {
    const request = makeRequest('Lunch with @marie and @newfriend, then @marie again');
    const user = await openCheck(request);

    const dialog = screen.getByRole('dialog', { name: 'People in what you share' });
    expect(dialog).toHaveTextContent('Marie Dupont2 mentions');
    expect(dialog).toHaveTextContent('@newfriend1 mention');
    expect(dialog).toHaveTextContent('Replace changes the text in the editor');
    const choice = within(dialog).getByRole('combobox', { name: 'Replace Marie Dupont with' });
    expect(choice).toHaveFocus();
    expect(within(choice).getAllByRole('option').map((option) => option.textContent)).toEqual(['Initials (M. D.)', 'a friend', 'Keep as written']);

    await user.click(within(dialog).getByRole('button', { name: 'Share anyway' }));
    expect(request.share).toHaveBeenCalledTimes(1);
    expect(request.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hands back the texts Replace changed, keeping the people kept as written', async () => {
    const request = makeRequest('Lunch with @marie and @newfriend');
    const user = await openCheck(request);

    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Replace @newfriend with' }), '');
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));

    expect(request.replace).toHaveBeenCalledWith([{ key: 1, title: '', text: 'Lunch with M. D. and @newfriend' }]);
    expect(request.share).not.toHaveBeenCalled();
  });

  it('offers no Replace while every person is kept as written', async () => {
    const request = makeRequest('Lunch with @marie', 'saved');
    const user = await openCheck(request, { theme: 'light' });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Replace saves the entry with the new words');
    await user.selectOptions(within(dialog).getByRole('combobox'), '');
    expect(within(dialog).getByRole('button', { name: 'Replace' })).toBeDisabled();
  });

  it('offers both French neutral words, and says Replace changes only an image card', async () => {
    const request = makeRequest('Avec @marie', 'card');
    const user = userEvent.setup();
    render(<Harness request={request} language="fr" />);
    await user.click(screen.getByRole('button', { name: 'Share' }));

    const dialog = screen.getByRole('dialog', { name: 'Les personnes dans ce que vous partagez' });
    expect(dialog).toHaveTextContent('Remplacer ne modifie que le texte de la carte');
    expect(within(dialog).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Initiales (M. D.)', 'une amie', 'un ami', 'Garder tel quel']);
    await user.selectOptions(within(dialog).getByRole('combobox'), 'un ami');
    await user.click(within(dialog).getByRole('button', { name: 'Remplacer' }));
    expect(request.replace).toHaveBeenCalledWith([{ key: 1, title: '', text: 'Avec un ami' }]);
  });

  it('shares nothing when cancelled, with the button or Escape', async () => {
    const request = makeRequest('Lunch with @marie');
    const user = await openCheck(request);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(request.cancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.keyboard('{Escape}');
    expect(request.cancel).toHaveBeenCalledTimes(2);
    expect(request.share).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
