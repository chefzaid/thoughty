import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import EntryForm from './EntryForm';
import TimeCapsuleField from './TimeCapsuleField';
import { getTranslation } from '../../utils/translations';
import type { TimeCapsuleDraft } from '../../utils/timeCapsule';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const tFr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

const defaultProps = {
    newEntryText: '',
    setNewEntryText: vi.fn(),
    selectedDate: new Date('2024-01-15'),
    setSelectedDate: vi.fn(),
    tags: [] as string[],
    setTags: vi.fn(),
    visibility: 'public' as const,
    setVisibility: vi.fn(),
    format: 'plain' as const,
    setFormat: vi.fn(),
    allTags: [],
    formError: '',
    onSubmit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
    theme: 'dark' as const,
    t,
};

function ControlledField({ initial = null, language = 'en' }: { initial?: TimeCapsuleDraft | null; language?: 'en' | 'fr' }) {
    const [value, setValue] = useState<TimeCapsuleDraft | null>(initial);
    return (
        <>
            <TimeCapsuleField id="composer-capsule" value={value} onChange={setValue} inputClass="" t={language === 'fr' ? tFr : t} />
            <output data-testid="capsule">{JSON.stringify(value)}</output>
        </>
    );
}

describe('TimeCapsuleField', () => {
    afterEach(() => vi.useRealTimers());

    it('offers to seal the entry, opening a year from today at 9:00 in the writer’s zone', async () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 27, 15) });
        render(<ControlledField />);

        expect(screen.queryByLabelText('Opens on')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Seal as a time capsule' }));

        const date = screen.getByLabelText('Opens on');
        expect(date).toHaveAttribute('min', '2026-10-28');
        expect(date).toHaveAttribute('max', '2076-10-27');
        expect(date).toHaveValue('2027-10-27');
        expect(screen.getByLabelText('Opens at')).toHaveValue('9');
        expect(screen.getByRole('group', { name: 'Seal as a time capsule' })).toHaveAccessibleDescription(/stays private/);
        expect(screen.getByText(/It opens at that time in your time zone/)).toBeInTheDocument();
    });

    it('changes the day and hour, and unseals when unticked', async () => {
        const user = userEvent.setup();
        render(<ControlledField initial={{ opensOn: '2030-01-01', openHour: 9 }} />);

        fireEvent.change(screen.getByLabelText('Opens on'), { target: { value: '2031-05-04' } });
        await user.selectOptions(screen.getByLabelText('Opens at'), '18');
        expect(screen.getByTestId('capsule')).toHaveTextContent('{"opensOn":"2031-05-04","openHour":18}');

        await user.click(screen.getByRole('checkbox', { name: 'Seal as a time capsule' }));
        expect(screen.getByTestId('capsule')).toHaveTextContent('null');
    });

    it('is in French', () => {
        render(<ControlledField initial={{ opensOn: '2030-01-01', openHour: 9 }} language="fr" />);

        expect(screen.getByRole('checkbox', { name: 'Sceller comme capsule temporelle' })).toBeChecked();
        expect(screen.getByLabelText('S’ouvre le')).toBeInTheDocument();
    });
});

describe('EntryForm time capsules', () => {
    it('keeps a sealed entry private and locks the visibility button', async () => {
        const setVisibility = vi.fn();
        const setTimeCapsule = vi.fn();
        const user = userEvent.setup();
        const { rerender } = render(<EntryForm {...defaultProps} setVisibility={setVisibility} timeCapsule={null} setTimeCapsule={setTimeCapsule} />);

        await user.click(screen.getByRole('checkbox', { name: 'Seal as a time capsule' }));
        expect(setTimeCapsule).toHaveBeenCalledWith(expect.objectContaining({ openHour: 9 }));
        expect(setVisibility).toHaveBeenCalledWith('private');

        rerender(<EntryForm {...defaultProps} visibility="private" setVisibility={setVisibility} timeCapsule={{ opensOn: '2030-01-01', openHour: 9 }} setTimeCapsule={setTimeCapsule} />);
        const visibilityButton = screen.getByTitle('A time capsule stays private while it is sealed');
        expect(visibilityButton).toBeDisabled();
    });

    it('offers to seal a letter to the future self when its template is chosen', async () => {
        vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 27, 15) });
        const setTimeCapsule = vi.fn();
        const templates = [
            { id: 'builtin-letter-to-future-self', name: 'Letter to my future self', content: 'Dear future me,', tags: ['future-self'], visibility: 'private' as const, format: 'plain' as const, builtIn: true, sealYears: 1 },
            { id: 'builtin-daily', name: 'Daily', content: 'Today', tags: [], visibility: 'private' as const, format: 'plain' as const, builtIn: true },
        ];
        render(<EntryForm {...defaultProps} entryTemplates={templates} timeCapsule={null} setTimeCapsule={setTimeCapsule} />);

        fireEvent.change(screen.getByLabelText('Entry template'), { target: { value: 'builtin-daily' } });
        expect(setTimeCapsule).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Entry template'), { target: { value: 'builtin-letter-to-future-self' } });
        expect(setTimeCapsule).toHaveBeenCalledWith({ opensOn: '2027-10-27', openHour: 9 });
        vi.useRealTimers();
    });
});
