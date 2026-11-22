import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import EntryForm from './EntryForm';
import { MentionPeopleContext } from '../People/PeopleContext';
import type { Person } from '../../services/api';
import { peopleByHandle } from '../../utils/mentions';
import { getTranslation } from '../../utils/translations';

const marie: Person = { id: 12, name: 'Marie', handles: ['marie'], entryCount: 3, lastMentionedOn: null, date: null, reachOutDays: null, lastContactOn: null, notes: null, createdAt: '', updatedAt: '' };

function Composer({ language, format = 'plain' }: { language?: string; format?: 'plain' | 'markdown' }) {
    const [text, setText] = useState('');
    return (
        <MentionPeopleContext.Provider value={{ people: [marie], byHandle: peopleByHandle([marie]) }}>
            <EntryForm
                newEntryText={text}
                setNewEntryText={setText}
                selectedDate={new Date('2024-01-15')}
                setSelectedDate={vi.fn()}
                tags={[]}
                setTags={vi.fn()}
                visibility="private"
                setVisibility={vi.fn()}
                format={format}
                setFormat={vi.fn()}
                allTags={[]}
                formError=""
                onSubmit={vi.fn()}
                theme="light"
                language={language}
                t={(key, params) => getTranslation(language === 'fr' ? 'fr' : 'en', key, params)}
            />
        </MentionPeopleContext.Provider>
    );
}

describe('EntryForm mentions', () => {
    it('suggests the writer’s people after @ and writes the one chosen', () => {
        render(<Composer />);
        const field = screen.getByPlaceholderText(/What's on your mind/i) as HTMLTextAreaElement;
        expect(field).toHaveAttribute('aria-autocomplete', 'list');

        fireEvent.change(field, { target: { value: 'Lunch with @ma' } });
        field.setSelectionRange(14, 14);
        fireEvent.select(field);
        expect(screen.getByRole('option', { name: /Marie/ })).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(field, { key: 'Enter' });
        expect(field).toHaveValue('Lunch with @Marie ');
    });

    it('speaks French', () => {
        render(<Composer language="fr" />);
        const field = screen.getByRole('textbox', { name: /mentionnez quelqu'un/ }) as HTMLTextAreaElement;

        fireEvent.change(field, { target: { value: '@m' } });
        field.setSelectionRange(2, 2);
        fireEvent.select(field);
        expect(screen.getByRole('listbox', { name: 'Personnes à mentionner' })).toHaveTextContent('3 entrées');
    });

    it('suggests people in the plain field shown while the Markdown editor loads, and keeps them as the editor takes over', async () => {
        render(<Composer format="markdown" />);
        // The editor is loaded on first use; until then a plain field takes its place
        const fallback = screen.getByPlaceholderText(/What's on your mind/i) as HTMLTextAreaElement;
        expect(screen.queryByTestId('md-editor')).toBeNull();
        fallback.focus();
        fireEvent.change(fallback, { target: { value: 'Lunch with @ma' } });
        fallback.setSelectionRange(14, 14);
        fireEvent.select(fallback);
        expect(screen.getByRole('option', { name: /Marie/ })).toBeInTheDocument();

        const editor = await screen.findByTestId('md-editor');
        const field = editor.querySelector('textarea') as HTMLTextAreaElement;
        expect(document.activeElement).toBe(field);
        expect(field.selectionStart).toBe(14);
        await waitFor(() => expect(screen.getByRole('option', { name: /Marie/ })).toBeInTheDocument());
    });
});
