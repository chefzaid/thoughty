import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Person } from '../../services/api/peopleService';
import { createTestQueryClient } from '../../test/queryClient';
import type { Entry } from '../../types';
import { getTranslation } from '../../utils/translations';
import { useJournalPeopleCheck } from './useJournalPeopleCheck';

const service = vi.hoisted(() => ({ updateEntry: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const marie: Person = { id: 1, name: 'Marie', handles: ['marie'], date: null, reachOutDays: null, lastContactOn: null, notes: null, groups: [], entryCount: 1, lastMentionedOn: null, createdAt: '', updatedAt: '' };

const entry = (id: number, content: string, visibility: Entry['visibility'] = 'private'): Entry => ({
  id, content, title: null, tags: ['life'], date: '2026-11-20T00:00:00.000Z', index: 1, visibility, format: 'plain',
} as Entry);

function makeProps(overrides: { visibility?: 'public' | 'private'; editingEntry?: Entry | null; editText?: string; editVisibility?: 'public' | 'private'; entries?: Entry[] } = {}) {
  return {
    entryForm: {
      newEntryText: 'Dinner with @marie',
      setNewEntryText: vi.fn(),
      title: 'Marie',
      setTitle: vi.fn(),
      visibility: overrides.visibility ?? 'public',
      onSubmit: vi.fn(),
    },
    entriesList: {
      entries: overrides.entries ?? [],
      selectedIds: new Set((overrides.entries ?? []).map((item) => item.id)),
      onToggleVisibility: vi.fn(),
      onBulkAction: vi.fn(),
      onSaveEdit: vi.fn(),
      editingEntry: overrides.editingEntry ?? null,
      editText: overrides.editText ?? '',
      setEditText: vi.fn(),
      editTitle: '',
      setEditTitle: vi.fn(),
      editVisibility: overrides.editVisibility ?? 'private',
    },
  };
}

type Props = ReturnType<typeof makeProps>;
let checked: ReturnType<typeof useJournalPeopleCheck<Props['entryForm'], Props['entriesList']>>;

function Harness({ props, onNotify }: { props: Props; onNotify: (message: string) => void }) {
  checked = useJournalPeopleCheck({ people: [marie], ...props, onNotify, theme: 'dark', language: 'en', t });
  return <>{checked.dialog}</>;
}

function renderCheck(props: Props) {
  const onNotify = vi.fn();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <Harness props={props} onNotify={onNotify} />
    </QueryClientProvider>,
  );
  return { onNotify, user: userEvent.setup() };
}

const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as Parameters<Props['entryForm']['onSubmit']>[0];

describe('useJournalPeopleCheck', () => {
  beforeEach(() => {
    service.updateEntry.mockReset().mockResolvedValue(true);
  });

  it('saves a private new entry without a check', () => {
    const props = makeProps({ visibility: 'private' });
    renderCheck(props);
    const event = submitEvent();
    checked.entryForm.onSubmit(event);
    expect(props.entryForm.onSubmit).toHaveBeenCalledWith(event);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('checks a public new entry, whose Replace changes the composer’s words without saving', async () => {
    const props = makeProps();
    const { user } = renderCheck(props);
    const event = submitEvent();
    checked.entryForm.onSubmit(event);

    const dialog = await screen.findByRole('dialog');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(dialog).toHaveTextContent('Marie2 mentions');
    await user.selectOptions(within(dialog).getByRole('combobox'), 'a friend');
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));

    expect(props.entryForm.setNewEntryText).toHaveBeenCalledWith('Dinner with a friend');
    expect(props.entryForm.setTitle).toHaveBeenCalledWith('A friend');
    expect(props.entryForm.onSubmit).not.toHaveBeenCalled();
  });

  it('saves a public new entry on Share anyway', async () => {
    const props = makeProps();
    const { user } = renderCheck(props);
    checked.entryForm.onSubmit(submitEvent());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Share anyway' }));
    expect(props.entryForm.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('checks the entry editor only when its save shares new words', async () => {
    const saved = entry(5, 'With @marie', 'public');
    const unchanged = makeProps({ editingEntry: saved, editText: saved.content, editVisibility: 'public' });
    renderCheck(unchanged);
    checked.entriesList.onSaveEdit();
    expect(unchanged.entriesList.onSaveEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('checks an entry the editor makes public, whose Replace changes the editor’s words', async () => {
    const props = makeProps({ editingEntry: entry(5, 'With @marie'), editText: 'With @marie today', editVisibility: 'public' });
    const { user } = renderCheck(props);
    checked.entriesList.onSaveEdit();

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace' }));
    expect(props.entriesList.setEditText).toHaveBeenCalledWith('With M. today');
    expect(props.entriesList.setEditTitle).toHaveBeenCalledWith('');
    expect(props.entriesList.onSaveEdit).not.toHaveBeenCalled();
  });

  it('makes an entry private at once, and checks one made public from its card', async () => {
    const props = makeProps();
    const { user } = renderCheck(props);
    const shared = entry(6, 'Paul only', 'public');
    checked.entriesList.onToggleVisibility(shared);
    expect(props.entriesList.onToggleVisibility).toHaveBeenCalledWith(shared);

    const named = entry(7, 'Tea with Marie');
    checked.entriesList.onToggleVisibility(named);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Share anyway' }));
    expect(props.entriesList.onToggleVisibility).toHaveBeenLastCalledWith(named);
  });

  it('saves the new words of an entry made public from its card on Replace, and says to read it again', async () => {
    const props = makeProps();
    const { user, onNotify } = renderCheck(props);
    checked.entriesList.onToggleVisibility(entry(7, 'Tea with Marie'));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('Names replaced in 1 entry. Read it again before sharing it.'));
    expect(service.updateEntry).toHaveBeenCalledWith(7, {
      text: 'Tea with M.', title: null, tags: ['life'], date: '2026-11-20', visibility: 'private', format: 'plain',
    });
    expect(props.entriesList.onToggleVisibility).not.toHaveBeenCalled();
  });

  it('checks the private entries a bulk Make public shares, and says when some could not be rewritten', async () => {
    const entries = [entry(8, 'With @marie'), entry(9, 'Marie again'), entry(10, 'Shared already @marie', 'public')];
    const props = makeProps({ entries });
    const { user, onNotify } = renderCheck(props);
    service.updateEntry.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    checked.entriesList.onBulkAction?.('visibility', { visibility: 'public' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Marie2 mentions');
    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('The names could not be replaced in every entry. Please try again.'));
    expect(service.updateEntry).toHaveBeenCalledTimes(2);
    expect(props.entriesList.onBulkAction).not.toHaveBeenCalled();
  });

  it('runs the other bulk actions, and a bulk Make public on Share anyway', async () => {
    const props = makeProps({ entries: [entry(8, 'With @marie')] });
    const { user } = renderCheck(props);
    checked.entriesList.onBulkAction?.('visibility', { visibility: 'private' });
    expect(props.entriesList.onBulkAction).toHaveBeenCalledWith('visibility', { visibility: 'private' });

    checked.entriesList.onBulkAction?.('visibility', { visibility: 'public' });
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Share anyway' }));
    expect(props.entriesList.onBulkAction).toHaveBeenLastCalledWith('visibility', { visibility: 'public' });
  });
});
