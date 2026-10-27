import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LifeEra } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import LifeErasSection from './LifeErasSection';

const service = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const era = (overrides: Partial<LifeEra> = {}): LifeEra => ({
  id: 3,
  name: 'University',
  startDate: '2010-09-01',
  endDate: '2014-06-30',
  color: '#2A9D8F',
  emoji: '🎓',
  note: 'Lyon',
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
  ...overrides,
});
const listOf = (lifeEras: LifeEra[], limit = 100) => ({ data: { lifeEras, limit }, error: null });

function renderSection(isDark = true) {
  const client = createTestQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><LifeErasSection isDark={isDark} language="en" t={t} /></QueryClientProvider>);
  return { invalidate };
}


describe('LifeErasSection', () => {
  beforeEach(() => {
    service.list.mockResolvedValue(listOf([era(), era({ id: 4, name: 'Paris', emoji: null, color: null, note: null, startDate: '2015-01-01', endDate: null })]));
    service.create.mockImplementation(async (draft) => ({ data: era({ id: 9, ...draft }), error: null }));
    service.update.mockImplementation(async (id, changes) => ({ data: era({ id, ...changes }), error: null }));
    service.remove.mockResolvedValue({ data: { success: true }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.location.hash = '';
  });

  it('lists the eras by start date with their dates, note and count', async () => {
    renderSection();

    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]!).getByText('🎓 University')).toBeInTheDocument();
    expect(within(items[0]!).getByText(/2010 – .*2014/)).toBeInTheDocument();
    expect(within(items[0]!).getByText('Lyon')).toBeInTheDocument();
    expect(within(items[1]!).getByText(/^Since .*2015$/)).toBeInTheDocument();
    expect(screen.getByText('2 of 100 eras')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Life eras' })).toHaveAttribute('id', 'life-eras');
  });

  it('says so when there are no eras yet, or when they cannot be loaded', async () => {
    service.list.mockResolvedValueOnce(listOf([]));
    renderSection(false);
    expect(await screen.findByText('No life eras yet. Add the first one below.')).toBeInTheDocument();
  });

  it('reports a list that cannot be loaded', async () => {
    service.list.mockResolvedValueOnce({ data: null, error: 'lifeErasLoadFailed' });
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent('Life eras could not be loaded.');
    expect(screen.queryByRole('group', { name: 'Add a life era' })).not.toBeInTheDocument();
  });

  it('adds an era, ongoing without an end date, and reloads the eras only', async () => {
    const { invalidate } = renderSection();
    const form = await screen.findByRole('group', { name: 'Add a life era' });

    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: '  The Paris years ' } });
    fireEvent.change(within(form).getByLabelText('Start date'), { target: { value: '2015-01-01' } });
    fireEvent.change(within(form).getByLabelText('Emoji'), { target: { value: '🗼' } });
    fireEvent.click(within(form).getByLabelText('Give it a colour'));
    fireEvent.change(within(form).getByLabelText('Colour'), { target: { value: '#aabbcc' } });
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: ' Montmartre ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add era' }));

    await waitFor(() => expect(service.create).toHaveBeenCalledWith({
      name: 'The Paris years', startDate: '2015-01-01', endDate: null, emoji: '🗼', color: '#AABBCC', note: 'Montmartre',
    }));
    expect(await screen.findByText('Added “The Paris years”.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Name')).toHaveValue('');
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([['lifeEras']]);
  });

  it('asks for a name, a start date and an end on or after the start before saving', async () => {
    renderSection();
    const form = await screen.findByRole('group', { name: 'Add a life era' });
    const add = within(form).getByRole('button', { name: 'Add era' });

    fireEvent.click(add);
    expect(await within(form).findByRole('alert')).toHaveTextContent('Enter a name for this era.');
    expect(within(form).getByLabelText('Name')).toHaveFocus();
    expect(within(form).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Uni' } });
    fireEvent.click(add);
    expect(await within(form).findByText('Enter the date this era starts.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Start date')).toHaveFocus();

    fireEvent.change(within(form).getByLabelText('Start date'), { target: { value: '2014-01-01' } });
    fireEvent.change(within(form).getByLabelText('End date'), { target: { value: '2013-01-01' } });
    fireEvent.click(add);
    expect(await within(form).findByText('The end date must be on or after the start date.')).toBeInTheDocument();
    expect(within(form).getByLabelText('End date')).toHaveFocus();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('shows the API’s reason when an era cannot be added', async () => {
    service.create.mockResolvedValueOnce({ data: null, error: 'apiError_LIFE_ERA_NAME_TAKEN' });
    renderSection();
    const form = await screen.findByRole('group', { name: 'Add a life era' });

    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'University' } });
    fireEvent.change(within(form).getByLabelText('Start date'), { target: { value: '2001-01-01' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add era' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('You already have a life era with this name.');
    expect(within(form).getByLabelText('Name')).toHaveValue('University');
  });

  it('edits an era in place, clearing its colour, and reloads the journal and saved searches', async () => {
    const { invalidate } = renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit University' }));
    const form = screen.getByRole('group', { name: 'Edit “University”' });

    expect(within(form).getByLabelText('Start date')).toHaveValue('2010-09-01');
    fireEvent.change(within(form).getByLabelText('End date'), { target: { value: '' } });
    fireEvent.click(within(form).getByLabelText('Give it a colour'));
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(service.update).toHaveBeenCalledWith(3, {
      name: 'University', startDate: '2010-09-01', endDate: null, emoji: '🎓', color: null, note: 'Lyon',
    }));
    expect(await screen.findByText('Saved “University”.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Edit “University”' })).not.toBeInTheDocument();
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(expect.arrayContaining([
      ['lifeEras'], ['savedSearches'], ['app', 'entries'],
    ]));
  });

  it('keeps editing when a change is refused, and cancels back to the summary', async () => {
    service.update.mockResolvedValueOnce({ data: null, error: null });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Paris' }));
    const form = screen.getByRole('group', { name: 'Edit “Paris”' });

    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('The life era could not be saved. Try again.');

    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit Paris' })).toBeInTheDocument();
  });

  it('deletes an era once confirmed, and says when it could not', async () => {
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete University' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('saved searches filtered by it will show every date');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(service.remove).toHaveBeenCalledWith(3));
    expect(await screen.findByText('Deleted “University”.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Life eras' })).toHaveFocus();

    service.remove.mockResolvedValueOnce({ data: null, error: 'apiError_LIFE_ERA_NOT_FOUND' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Paris' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('This life era no longer exists.')).toBeInTheDocument();
  });

  it('offers no form once the limit is reached', async () => {
    service.list.mockResolvedValueOnce(listOf([era()], 1));
    renderSection();

    expect(await screen.findByText('You have reached the limit of 1 life eras. Delete one to add another.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Add a life era' })).not.toBeInTheDocument();
  });

  it('brings itself into view when the address names it', async () => {
    globalThis.location.hash = '#life-eras';
    renderSection();

    expect(screen.getByRole('heading', { name: 'Life eras' })).toHaveFocus();
    await screen.findAllByRole('listitem');
  });
});
