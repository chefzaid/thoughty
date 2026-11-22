import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation } from '../../utils/translations';
import TagPicker from './TagPicker';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

/** A picker that keeps what it picks, as its users do. */
function StatefulPicker({ initial = [] as string[], allowNew = true }) {
    const [tags, setTags] = useState<string[]>(initial);
    return (
        <TagPicker availableTags={['work', 'walks', 'ideas']} selectedTags={tags} onChange={setTags} allowNew={allowNew} placeholder="Select tags..." t={t} />
    );
}

const field = () => screen.getByRole('combobox', { name: 'Select tags...' });
const list = () => screen.queryByRole('listbox', { name: 'Tag suggestions' });
const optionNames = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('TagPicker list and keyboard', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
        Element.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
        scrollIntoView.mockClear();
        delete (Element.prototype as Partial<Element>).scrollIntoView;
    });

    it('closes the list after a tag is picked with Enter, and opens it again on typing', async () => {
        const user = userEvent.setup();
        render(<StatefulPicker />);

        await user.type(field(), 'work{Enter}');
        expect(screen.getByRole('button', { name: 'Remove work tag' })).toBeInTheDocument();
        expect(list()).not.toBeInTheDocument();
        expect(field()).toHaveAttribute('aria-expanded', 'false');
        expect(field()).not.toHaveAttribute('aria-controls');
        expect(field()).toHaveFocus();

        await user.type(field(), 'wa');
        expect(optionNames()).toEqual(['walks', 'Create "wa"']);
        expect(field()).toHaveAttribute('aria-expanded', 'true');
        expect(field()).toHaveAttribute('aria-controls', list()!.id);
    });

    it('closes the list after a click on a suggestion, keeps focus in the field, and a click there opens it again', async () => {
        const user = userEvent.setup();
        render(<StatefulPicker />);

        await user.click(field());
        await user.click(screen.getByRole('option', { name: 'ideas' }));
        expect(screen.getByRole('button', { name: 'Remove ideas tag' })).toBeInTheDocument();
        expect(list()).not.toBeInTheDocument();
        expect(field()).toHaveFocus();

        await user.click(field());
        expect(optionNames()).toEqual(['walks', 'work']);
    });

    it('moves through the suggestions with the arrows, announcing the highlighted one, and Enter picks it', async () => {
        const user = userEvent.setup();
        render(<StatefulPicker />);
        field().focus();
        await user.keyboard('{Escape}');
        expect(list()).not.toBeInTheDocument();

        // Down opens the list on its first row
        await user.keyboard('{ArrowDown}');
        const options = screen.getAllByRole('option');
        expect(field()).toHaveAttribute('aria-activedescendant', options[0]!.id);
        expect(options[0]).toHaveAttribute('aria-selected', 'true');
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

        await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
        expect(field()).toHaveAttribute('aria-activedescendant', options[0]!.id);
        await user.keyboard('{ArrowUp}');
        expect(field()).toHaveAttribute('aria-activedescendant', options[2]!.id);
        expect(options[2]).toHaveAttribute('aria-selected', 'true');
        expect(options[0]).toHaveAttribute('aria-selected', 'false');

        await user.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: 'Remove work tag' })).toBeInTheDocument();
        expect(field()).not.toHaveAttribute('aria-activedescendant');

        // Up on a closed list opens it on its last row; typing drops the highlight
        await user.keyboard('{ArrowUp}');
        expect(field()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1]!.id);
        await user.keyboard('i');
        expect(field()).not.toHaveAttribute('aria-activedescendant');
    });

    it('creates the typed tag from its highlighted row, and leaves an already chosen one alone', async () => {
        const user = userEvent.setup();
        render(<StatefulPicker initial={['garden']} />);

        await user.type(field(), 'garden');
        await user.keyboard('{ArrowDown}{Enter}');
        expect(screen.getAllByRole('button', { name: 'Remove garden tag' })).toHaveLength(1);
        expect(field()).toHaveValue('');

        await user.type(field(), 'w');
        await user.hover(screen.getByRole('option', { name: 'Create "w"' }));
        await user.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: 'Remove w tag' })).toBeInTheDocument();
    });

    it('does nothing with arrows when nothing is left to offer, or with Enter on spaces', async () => {
        const user = userEvent.setup();
        render(<StatefulPicker initial={['work', 'walks', 'ideas']} allowNew={false} />);

        field().focus();
        await user.keyboard('{ArrowDown}');
        expect(list()).not.toBeInTheDocument();
        await user.keyboard('   {Enter}');
        expect(field()).toHaveValue('   ');
        expect(optionNames()).toEqual(['No tags found']);
        expect(screen.getByRole('option', { name: 'No tags found' })).toHaveAttribute('aria-disabled', 'true');
        await user.keyboard('{ArrowDown}');
        expect(field()).not.toHaveAttribute('aria-activedescendant');
    });

    it('closes the list on Escape without letting the key reach the popover around it; a second Escape does', async () => {
        const user = userEvent.setup();
        const parentKeys = vi.fn();
        const documentKeys = vi.fn();
        const onDocumentKey = (event: KeyboardEvent) => documentKeys(event.key);
        document.addEventListener('keydown', onDocumentKey);
        render(
            <div onKeyDown={(event) => parentKeys(event.key)}>
                <StatefulPicker />
            </div>
        );

        await user.type(field(), 'wo');
        expect(list()).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(list()).not.toBeInTheDocument();
        expect(field()).toHaveValue('wo');
        expect(field()).toHaveFocus();
        expect(parentKeys).not.toHaveBeenCalledWith('Escape');
        expect(documentKeys).not.toHaveBeenCalledWith('Escape');

        await user.keyboard('{Escape}');
        expect(parentKeys).toHaveBeenCalledWith('Escape');
        expect(documentKeys).toHaveBeenCalledWith('Escape');
        document.removeEventListener('keydown', onDocumentKey);
    });

    it('closes the list when focus leaves the field', async () => {
        const user = userEvent.setup();
        render(
            <>
                <StatefulPicker />
                <button type="button">Apply</button>
            </>
        );

        await user.click(field());
        expect(list()).toBeInTheDocument();
        await user.tab();
        expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus();
        expect(list()).not.toBeInTheDocument();
        expect(field()).toHaveAttribute('aria-expanded', 'false');
    });
});
