import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import { ContentLockContext, type ContentLockApi } from '../ContentLock/contentLockContext';

const lockApi = (): ContentLockApi => ({
    pinSet: true,
    hasLockedContent: true,
    unlocked: false,
    requestUnlock: vi.fn(async () => true),
    unblur: vi.fn(async () => undefined),
    lock: vi.fn(async () => undefined),
    ensurePin: vi.fn(async () => true),
    refresh: vi.fn(async () => undefined),
    setEntryLocked: vi.fn(async () => true),
    setDiaryLocked: vi.fn(async () => true),
});

const renderWithLock = (api: ContentLockApi, overrides: Partial<Parameters<typeof createEntryViewModeProps>[0]>) =>
    render(<ContentLockContext.Provider value={api}><EntryViewMode {...createEntryViewModeProps(overrides)} /></ContentLockContext.Provider>);

describe('EntryViewMode with the PIN lock', () => {
    it('shows a withheld entry as its locked placeholder, with none of its actions', () => {
        renderWithLock(lockApi(), { entry: { ...mockEntries[0], content: '', tags: [], withheld: true, is_locked: true, title: 'The keeper' } });

        expect(screen.getByRole('region', { name: 'lockedEntryLabel' })).toHaveTextContent('The keeper');
        expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'lockedEntryUnblur' })).toBeInTheDocument();
    });

    it('locks an entry from its More actions menu after a confirmation', async () => {
        const user = userEvent.setup();
        const api = lockApi();
        renderWithLock(api, { entry: { ...mockEntries[0], is_locked: false, diary_locked: false } });

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'entryLockAction' }));
        await user.click(screen.getByRole('button', { name: 'entryLockConfirm' }));
        expect(api.setEntryLocked).toHaveBeenCalledWith(mockEntries[0]!.id, true);
    });
});
