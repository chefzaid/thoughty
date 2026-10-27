import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import EntryContentRenderer from './EntryContentRenderer';
import { defaultProps } from './EntryContentRenderer.test-helpers';
import { MentionPeopleContext } from '../People/PeopleContext';
import type { Person } from '../../services/api';
import { peopleByHandle } from '../../utils/mentions';

const marie: Person = { id: 12, name: 'Marie Curie', handles: ['marie', 'mariec'], entryCount: 3, lastMentionedOn: null, createdAt: '', updatedAt: '' };
const people = { people: [marie], byHandle: peopleByHandle([marie]) };

function Location() {
    const location = useLocation();
    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/** The renderer inside the writer's journal, where their people are known. */
function inJournal(node: ReactNode) {
    return (
        <MemoryRouter initialEntries={['/journal']}>
            <MentionPeopleContext.Provider value={people}>
                <Routes><Route path="*" element={<>{node}<Location /></>} /></Routes>
            </MentionPeopleContext.Provider>
        </MemoryRouter>
    );
}

describe('EntryContentRenderer mentions', () => {
    it('links the mentions of known people in plain text to the entries about them', () => {
        render(inJournal(<EntryContentRenderer {...defaultProps} content="Tea with @Marie, @MarieC and @Paul; mail marie@example.com" />));

        const links = screen.getAllByRole('link', { name: /@marie/i });
        expect(links.map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('title')])).toEqual([
            ['@Marie', '/journal?diary=all&person=12', 'Entries that mention Marie Curie'],
            ['@MarieC', '/journal?diary=all&person=12', 'Entries that mention Marie Curie'],
        ]);
        expect(screen.queryByRole('link', { name: '@Paul' })).not.toBeInTheDocument();
        expect(screen.getByText(/and @Paul; mail marie@example.com/)).toBeInTheDocument();

        fireEvent.click(links[0]!);
        expect(screen.getByTestId('location')).toHaveTextContent('/journal?diary=all&person=12');
    });

    it('keeps search highlights inside and around a mention, and cross-references beside it', () => {
        const { container } = render(inJournal(
            <EntryContentRenderer {...defaultProps} content="Walked with @Marie, see [[2024-01-02]]" searchTerm="marie walked" searchMatches={['Walked', 'Marie']} />,
        ));

        expect(container.querySelector('a.entry-mention-link')?.innerHTML).toBe('@<mark class="search-highlight rounded-sm px-0.5">Marie</mark>');
        expect([...container.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['Walked', 'Marie']);
        expect(screen.getByRole('button', { name: '[[2024-01-02]]' })).toBeInTheDocument();
    });

    it('links mentions in Markdown, but not inside code or links', async () => {
        render(inJournal(
            <EntryContentRenderer {...defaultProps} format="markdown" content={'**@marie** and `@marie` and [@marie](https://example.com)\n\n- [ ] call @mariec'} />,
        ));

        const links = await screen.findAllByRole('link', { name: /@marie/i });
        expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
            ['@marie', '/journal?diary=all&person=12'],
            ['@marie', 'https://example.com'],
            ['@mariec', '/journal?diary=all&person=12'],
        ]);
        expect(links[0]!.closest('strong')).not.toBeNull();
        expect(links[0]).toHaveAttribute('title', 'Entries that mention Marie Curie');
        expect(screen.getByText('@marie', { selector: 'code' })).toBeInTheDocument();
    });

    it('leaves mentions as text where the writer’s people are not known, as in the public feed', async () => {
        const { rerender } = render(<EntryContentRenderer {...defaultProps} content="Tea with @Marie" />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Tea with @Marie')).toBeInTheDocument();

        rerender(<EntryContentRenderer {...defaultProps} format="markdown" content="Tea with **@Marie**" />);
        expect(await screen.findByText('@Marie')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('gives no hover text without translations', () => {
        render(inJournal(<EntryContentRenderer content="Hi @marie" />));

        expect(screen.getByRole('link', { name: '@marie' })).not.toHaveAttribute('title');
    });
});
