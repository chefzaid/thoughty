import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation, type Language } from '../../utils/translations';
import DiaryManager, { type DiaryReminderHours } from './DiaryManager';
import { makeDiary } from '../../test/diaryFixture';

const diaries = [
    makeDiary({ id: 1, name: 'Personal', isDefault: true }),
    makeDiary({ id: 2, name: 'Work' }),
];

type Options = { language?: Language; writingReminders?: DiaryReminderHours; onSaveWritingReminder?: (diaryId: number, hour: number | null) => Promise<void> };

const renderManager = (options: Options = {}) => {
    const {
        language = 'en',
        writingReminders = 'writingReminders' in options ? undefined : { hours: { 2: 7 }, emailAvailable: true },
        onSaveWritingReminder = vi.fn().mockResolvedValue(undefined),
    } = options;
    const props = {
        diaries,
        onCreateDiary: vi.fn().mockResolvedValue(undefined),
        onUpdateDiary: vi.fn().mockResolvedValue(undefined),
        onDeleteDiary: vi.fn(),
        onSetDefault: vi.fn(),
        onReorderDiaries: vi.fn(),
        onBack: vi.fn(),
        writingReminders,
        onSaveWritingReminder,
        theme: 'light' as const,
        language,
        t: (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params),
    };
    render(<DiaryManager {...props} />);
    return props;
};

const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
const editor = () => document.querySelector('.diary-card.editing') as HTMLElement;

describe('DiaryManager writing reminders', () => {
    it.each([
        ['en', 'Writing reminder at 7:00 AM'],
        ['fr', 'Rappel d’écriture à 7:00'],
    ] as const)('names a diary’s own reminder hour in %s, and nothing for a diary that follows the Profile', (language, summary) => {
        renderManager({ language });

        expect(within(card('Work')).getByText(summary)).toBeInTheDocument();
        expect(within(card('Personal')).queryByText(/Writing reminder|Rappel d’écriture/)).not.toBeInTheDocument();
    });

    it('gives a diary its own hour on save, after the diary itself', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.click(within(card('Personal')).getByTitle('Edit'));
        const field = within(editor()).getByLabelText('Writing reminder');
        expect(field).toHaveValue('');
        expect(within(field).getByRole('option', { name: 'As in Profile' })).toBeInTheDocument();
        expect(field).toHaveAttribute('title', expect.stringContaining('replaces the Profile reminder for this diary'));
        await user.selectOptions(field, '8:00 PM');
        await user.click(within(editor()).getByRole('button', { name: 'Save' }));

        expect(props.onUpdateDiary).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Personal' }));
        expect(props.onSaveWritingReminder).toHaveBeenCalledWith(1, 20);
        expect(document.querySelector('.diary-card.editing')).toBeNull();
    });

    it('removes a diary’s own hour, and saves no reminder when the hour is unchanged', async () => {
        const user = userEvent.setup();
        const props = renderManager();

        await user.click(within(card('Work')).getByTitle('Edit'));
        expect(within(editor()).getByLabelText('Writing reminder')).toHaveValue('7');
        await user.click(within(editor()).getByRole('button', { name: 'Save' }));
        expect(props.onSaveWritingReminder).not.toHaveBeenCalled();

        await user.click(within(card('Work')).getByTitle('Edit'));
        await user.selectOptions(within(editor()).getByLabelText('Writing reminder'), '');
        await user.click(within(editor()).getByRole('button', { name: 'Save' }));
        expect(props.onSaveWritingReminder).toHaveBeenCalledWith(2, null);
    });

    it('keeps the editor open and says so when the reminder cannot be saved', async () => {
        const user = userEvent.setup();
        renderManager({ onSaveWritingReminder: vi.fn().mockRejectedValue(new Error('diaryReminderSaveFailed')) });

        await user.click(within(card('Personal')).getByTitle('Edit'));
        await user.selectOptions(within(editor()).getByLabelText('Writing reminder'), '9:00 AM');
        await user.click(within(editor()).getByRole('button', { name: 'Save' }));

        expect(screen.getByText('The diary’s writing reminder could not be saved.')).toBeInTheDocument();
        expect(editor()).not.toBeNull();
    });

    it('keeps the editor open, saying it is saving, until the reminder is saved, and sends it once', async () => {
        const user = userEvent.setup();
        let finish: () => void = () => {};
        const onSaveWritingReminder = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
        renderManager({ onSaveWritingReminder });

        await user.click(within(card('Personal')).getByTitle('Edit'));
        await user.selectOptions(within(editor()).getByLabelText('Writing reminder'), '9:00 AM');
        await user.click(within(editor()).getByRole('button', { name: 'Save' }));

        const saving = within(editor()).getByRole('button', { name: 'Saving…' });
        expect(saving).toBeDisabled();
        await user.click(saving);
        expect(onSaveWritingReminder).toHaveBeenCalledTimes(1);
        finish();
        await waitFor(() => expect(editor()).toBeNull());
    });

    it('clears the earlier failure once a retried save goes through', async () => {
        const user = userEvent.setup();
        const onSaveWritingReminder = vi.fn().mockRejectedValueOnce(new Error('diaryReminderSaveFailed')).mockResolvedValueOnce(undefined);
        renderManager({ onSaveWritingReminder });

        await user.click(within(card('Personal')).getByTitle('Edit'));
        await user.selectOptions(within(editor()).getByLabelText('Writing reminder'), '9:00 AM');
        await user.click(within(editor()).getByRole('button', { name: 'Save' }));
        expect(screen.getByText('The diary’s writing reminder could not be saved.')).toBeInTheDocument();

        await user.click(within(editor()).getByRole('button', { name: 'Save' }));
        expect(editor()).toBeNull();
        expect(screen.queryByText('The diary’s writing reminder could not be saved.')).not.toBeInTheDocument();
    });

    it('warns once an hour is picked that no email can reach the writer yet', async () => {
        const user = userEvent.setup();
        renderManager({ writingReminders: { hours: {}, emailAvailable: false } });

        await user.click(within(card('Personal')).getByTitle('Edit'));
        expect(within(editor()).queryByText(/We can’t email you yet/)).not.toBeInTheDocument();
        await user.selectOptions(within(editor()).getByLabelText('Writing reminder'), '9:00 AM');
        expect(within(editor()).getByText(/We can’t email you yet/)).toBeInTheDocument();
    });

    it('leaves the field out until the reminders are known', async () => {
        const user = userEvent.setup();
        renderManager({ writingReminders: undefined });

        await user.click(within(card('Personal')).getByTitle('Edit'));
        expect(within(editor()).queryByLabelText('Writing reminder')).not.toBeInTheDocument();
    });
});
