import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenTask, OpenTasksPage as OpenTasksPageData } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import { QuietModeContext } from '../QuietMode/quietMode';
import OpenTasksPage, { type OpenTasksPageProps } from './OpenTasksPage';

const services = {
  fetchPage: vi.fn(),
  setEntryTask: vi.fn(),
};

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => services,
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;

const task = (overrides: Partial<OpenTask> = {}): OpenTask => ({
  entryId: 9,
  date: '2026-10-21',
  title: 'Errands',
  line: 1,
  text: 'Call the **bank**',
  ...overrides,
});

const tasksPage = (overrides: Partial<OpenTasksPageData> = {}): OpenTasksPageData => ({
  tasks: [task(), task({ line: 3, text: 'Post the letter' }), task({ entryId: 4, date: '2026-10-19', title: null, line: 0, text: 'Book the train' })],
  total: 3,
  page: 1,
  totalPages: 1,
  nextCursor: null,
  ...overrides,
});

function renderPage(props: Partial<OpenTasksPageProps> = {}, { quiet = false } = {}) {
  const onChangePage = vi.fn();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <QuietModeContext.Provider value={quiet}>
        <MemoryRouter>
          <OpenTasksPage language="en" diaryId={null} page={1} after={null} onChangePage={onChangePage} t={t} {...props} />
        </MemoryRouter>
      </QuietModeContext.Provider>
    </QueryClientProvider>,
  );
  return { onChangePage };
}

describe('OpenTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.fetchPage.mockResolvedValue({ data: tasksPage(), error: null });
    services.setEntryTask.mockResolvedValue({ success: true });
  });

  it('lists the open tasks by entry, with each entry’s date, title and link, as labelled checkboxes', async () => {
    renderPage({ diaryId: 2 });

    const errands = await screen.findByRole('article', { name: 'October 21, 2026 · Errands' });
    expect(services.fetchPage).toHaveBeenCalledWith(1, 50, 2, null);
    expect(within(errands).getByRole('link', { name: 'openTasksOpenEntryOf October 21, 2026' })).toHaveAttribute('href', '/journal?entry=9');
    const bank = within(errands).getByRole('checkbox', { name: 'Call the bank' });
    expect(bank).not.toBeChecked();
    expect(bank).toHaveAccessibleDescription('October 21, 2026 · Errands');
    expect(within(errands).getByRole('checkbox', { name: 'Post the letter' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'October 19, 2026' })).toBeInTheDocument();
    expect(screen.getByText('openTasksCount_other 3')).toBeInTheDocument();
    // The task words blur with the privacy blur; titles stay readable, as in the journal
    expect(screen.getByText('Call the bank')).toHaveClass('privacy-text');
    expect(screen.getByText('· Errands')).not.toHaveClass('privacy-text');
  });

  it('ticks a task off in its entry, naming it by line and text, and keeps it shown as done', async () => {
    renderPage();

    const bank = await screen.findByRole('checkbox', { name: 'Call the bank' });
    fireEvent.click(bank);

    await waitFor(() => expect(services.setEntryTask).toHaveBeenCalledWith(9, 1, true, 'Call the **bank**'));
    expect(await screen.findByText('openTasksTicked Call the bank')).toBeInTheDocument();
    expect(bank).toBeChecked();
    expect(bank).toBeEnabled();
    expect(screen.getByText('openTasksCount_other 2')).toBeInTheDocument();

    // Unticking puts it back on the list
    fireEvent.click(bank);
    await waitFor(() => expect(services.setEntryTask).toHaveBeenLastCalledWith(9, 1, false, 'Call the **bank**'));
    expect(await screen.findByText('openTasksUnticked Call the bank')).toBeInTheDocument();
    expect(bank).not.toBeChecked();
  });

  it('keeps the box focusable while it saves, and lets a second change wait for the first', async () => {
    let finish: (value: { success: boolean }) => void = () => {};
    services.setEntryTask.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    renderPage();

    const bank = await screen.findByRole('checkbox', { name: 'Call the bank' });
    fireEvent.click(bank);
    fireEvent.click(bank);
    expect(bank).toBeEnabled();
    expect(services.setEntryTask).toHaveBeenCalledTimes(1);

    finish({ success: true });
    expect(await screen.findByText('openTasksTicked Call the bank')).toBeInTheDocument();
    expect(bank).toBeChecked();
  });

  it('says why a tick failed and reads the list again when the entry changed meanwhile', async () => {
    services.setEntryTask.mockResolvedValue({ success: false, error: 'apiError_ENTRY_TASK_STALE' });
    renderPage();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Book the train' }));

    expect(await screen.findByText('apiError_ENTRY_TASK_STALE')).toBeInTheDocument();
    await waitFor(() => expect(services.fetchPage).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox', { name: 'Book the train' })).not.toBeChecked();
  });

  it('falls back to a general message when a tick fails without a reason', async () => {
    services.setEntryTask.mockResolvedValue({ success: false });
    renderPage();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Book the train' }));

    expect(await screen.findByText('taskUpdateFailed')).toBeInTheDocument();
  });

  it('shows no count in quiet mode', async () => {
    renderPage({}, { quiet: true });

    await screen.findByRole('checkbox', { name: 'Call the bank' });
    expect(screen.queryByText(/openTasksCount/)).not.toBeInTheDocument();
  });

  it('says there is nothing left to do, for the journal or for one diary', async () => {
    services.fetchPage.mockResolvedValue({ data: tasksPage({ tasks: [], total: 0, totalPages: 0 }), error: null });
    renderPage();
    expect(await screen.findByText('openTasksEmpty')).toBeInTheDocument();
  });

  it('says the diary has nothing left to do', async () => {
    services.fetchPage.mockResolvedValue({ data: tasksPage({ tasks: [], total: 0, totalPages: 0 }), error: null });
    renderPage({ diaryId: 3 });
    expect(await screen.findByText('openTasksEmptyDiary')).toBeInTheDocument();
  });

  it('offers to try again when the tasks cannot be loaded', async () => {
    services.fetchPage.mockResolvedValueOnce({ data: null, error: 'openTasksLoadError' });
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('openTasksLoadError');
    fireEvent.click(within(alert).getByRole('button', { name: 'openTasksRetry' }));
    expect(await screen.findByRole('checkbox', { name: 'Call the bank' })).toBeInTheDocument();
  });

  it('goes back a page by its offset, and on to the next one after the last task shown', async () => {
    services.fetchPage.mockResolvedValue({ data: tasksPage({ total: 120, totalPages: 3, page: 2, nextCursor: '2026-10-19__1_4_0' }), error: null });
    const { onChangePage } = renderPage({ page: 2 });

    const pages = await screen.findByRole('navigation', { name: 'openTasksPagination' });
    expect(services.fetchPage).toHaveBeenCalledWith(2, 50, null, null);
    expect(pages).toHaveTextContent('openTasksPage 2 | 3');
    fireEvent.click(within(pages).getByRole('button', { name: 'openTasksPrevious' }));
    fireEvent.click(within(pages).getByRole('button', { name: 'openTasksNext' }));
    expect(onChangePage.mock.calls).toEqual([[1], [3, { after: '2026-10-19__1_4_0' }]]);
  });

  it('reads a page after its cursor and numbers it as the server counts it, with no Next on the last one', async () => {
    // A whole page was ticked before Next: the tasks before the cursor now fill one page, not two
    services.fetchPage.mockResolvedValue({ data: tasksPage({ total: 53, totalPages: 2, page: 2 }), error: null });
    const { onChangePage } = renderPage({ page: 3, after: '2026-10-22__1_12_4' });

    const pages = await screen.findByRole('navigation', { name: 'openTasksPagination' });
    expect(services.fetchPage).toHaveBeenCalledWith(3, 50, null, '2026-10-22__1_12_4');
    expect(pages).toHaveTextContent('openTasksPage 2 | 2');
    expect(within(pages).getByRole('button', { name: 'openTasksNext' })).toBeDisabled();
    fireEvent.click(within(pages).getByRole('button', { name: 'openTasksPrevious' }));
    expect(onChangePage.mock.calls).toEqual([[1]]);
  });

  it('goes back to the last page that still has tasks', async () => {
    services.fetchPage.mockResolvedValue({ data: tasksPage({ total: 3, totalPages: 1, page: 4 }), error: null });
    const { onChangePage } = renderPage({ page: 4 });

    await waitFor(() => expect(onChangePage).toHaveBeenCalledWith(1, { replace: true }));
  });
});
