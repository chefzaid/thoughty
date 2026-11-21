import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { makeDiary } from '../../test/diaryFixture';
import type { Diary } from '../../types';
import { getTranslation } from '../../utils/translations';
import WelcomePage, { type WelcomePageProps } from './WelcomePage';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const JOURNAL = makeDiary({ id: 3, name: 'My Journal', isDefault: true });

function renderPage(props: Partial<WelcomePageProps> = {}, diaries: Diary[] = [JOURNAL]) {
  const handlers = {
    onFinish: vi.fn().mockResolvedValue(true),
    onSetDiaryTemplate: vi.fn().mockResolvedValue(undefined),
    onOpenJournal: vi.fn(),
    onOpenMemoir: vi.fn(),
    onOpenImport: vi.fn(),
  };
  const view = render(<WelcomePage diaries={diaries} t={t} {...handlers} {...props} />);
  return { ...handlers, ...props, view };
}

describe('WelcomePage', () => {
  it('asks what the writer is here for, with a way to skip', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Thoughty' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'What brings you here?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A daily journal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My life story/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coming from another app.*Day One, Journey/ })).toBeInTheDocument();
  });

  it.each([
    ['My life story', 'onOpenMemoir'],
    ['Coming from another app', 'onOpenImport'],
    ['Skip and open my journal', 'onOpenJournal'],
  ] as const)('marks it done and opens the place for "%s"', async (name, handler) => {
    const user = userEvent.setup();
    const page = renderPage();

    await user.click(screen.getByRole('button', { name: new RegExp(name) }));

    expect(page.onFinish).toHaveBeenCalledTimes(1);
    expect(page[handler]).toHaveBeenCalledTimes(1);
    expect(page.onSetDiaryTemplate).not.toHaveBeenCalled();
  });

  it('offers a first template for the default diary, Daily reflection first, and saves the one picked', async () => {
    const user = userEvent.setup();
    const page = renderPage();

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));

    expect(screen.getByRole('group', { name: 'Pick a first template' })).toBeInTheDocument();
    expect(screen.getByText(/A new entry in My Journal starts from it while the composer is empty/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      'Daily reflectionWhat happened today?',
      'Gratitude journalToday I am grateful for:',
      'Morning intentionsHow I feel as I start the day:',
      'A blank pageNo template: every entry starts empty.',
    ]);
    expect(screen.getByRole('radio', { name: /Daily reflection/ })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /Morning intentions/ }));
    await user.click(screen.getByRole('button', { name: 'Start writing' }));

    expect(page.onSetDiaryTemplate).toHaveBeenCalledWith(JOURNAL, 'builtin-morning-intentions');
    expect(page.onFinish).toHaveBeenCalledTimes(1);
    expect(page.onOpenJournal).toHaveBeenCalledTimes(1);
  });

  it('offers the first templates in French to a French writer, and saves the ID', async () => {
    const user = userEvent.setup();
    const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
    const page = renderPage({ language: 'fr', t: fr });

    await user.click(screen.getByRole('button', { name: /Un journal quotidien/ }));

    expect(screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
      "Réflexion du jourQue s'est-il passé aujourd'hui ?",
      'Journal de gratitudeAujourd\'hui, je dis merci pour :',
      'Intentions du matinComment je me sens en commençant la journée :',
      expect.stringMatching(/^Une page blanche/),
    ]);
    await user.click(screen.getByRole('radio', { name: /Journal de gratitude/ }));
    await user.click(screen.getByRole('button', { name: 'Commencer à écrire' }));
    expect(page.onSetDiaryTemplate).toHaveBeenCalledWith(JOURNAL, 'builtin-gratitude');
  });

  it('starts a blank journal without touching the diary, and goes back to the choices', async () => {
    const user = userEvent.setup();
    const page = renderPage();

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('list', { name: 'What brings you here?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));
    await user.click(screen.getByRole('radio', { name: /A blank page/ }));
    await user.click(screen.getByRole('button', { name: 'Start writing' }));

    expect(page.onSetDiaryTemplate).not.toHaveBeenCalled();
    expect(page.onOpenJournal).toHaveBeenCalledTimes(1);
  });

  it('opens the journal at once when there is no default diary to give a template to', async () => {
    const user = userEvent.setup();
    const page = renderPage({}, []);

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));

    expect(page.onFinish).toHaveBeenCalledTimes(1);
    expect(page.onOpenJournal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('says why the template was not saved and stays, without marking it done', async () => {
    const user = userEvent.setup();
    const page = renderPage({ onSetDiaryTemplate: vi.fn().mockRejectedValue(new Error('diaryUpdateFailed')) });

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));
    await user.click(screen.getByRole('button', { name: 'Start writing' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('diaryUpdateFailed'));
    expect(page.onFinish).not.toHaveBeenCalled();
    expect(page.onOpenJournal).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start writing' })).toBeEnabled();
  });

  it('falls back to the generic message for an error without a code', async () => {
    const user = userEvent.setup();
    renderPage({ onSetDiaryTemplate: vi.fn().mockRejectedValue(new Error('')) });

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));
    await user.click(screen.getByRole('button', { name: 'Start writing' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t('diaryUpdateFailed'));
  });

  it('stays on the page when the settings could not be saved, so the writer can try again', async () => {
    const user = userEvent.setup();
    const page = renderPage({ onFinish: vi.fn().mockResolvedValue(false) });

    await user.click(screen.getByRole('button', { name: /My life story/ }));

    expect(page.onOpenMemoir).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /My life story/ })).toBeEnabled();
  });

  it('ignores a second choice while the first is saving', async () => {
    const user = userEvent.setup();
    let finish: (done: boolean) => void = () => undefined;
    const page = renderPage({ onFinish: vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; })) });

    await user.click(screen.getByRole('button', { name: /A daily journal/ }));
    await user.click(screen.getByRole('button', { name: 'Start writing' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Back' }));

    finish(true);
    await vi.waitFor(() => expect(page.onOpenJournal).toHaveBeenCalledTimes(1));
    expect(page.onFinish).toHaveBeenCalledTimes(1);
  });

  it('follows the light theme', () => {
    const { view } = renderPage({ theme: 'light' });

    expect(view.container.querySelector('.welcome-page.light')).toBeInTheDocument();
  });
});
