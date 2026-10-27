import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import MentionSuggestions from './MentionSuggestions';
import { MentionPeopleContext } from './PeopleContext';
import { useMentionAutocomplete } from './useMentionAutocomplete';
import type { Person } from '../../services/api';
import { peopleByHandle } from '../../utils/mentions';
import { getTranslation } from '../../utils/translations';

const person = (id: number, name: string, handles: string[], entryCount: number): Person => ({
  id, name, handles, entryCount, lastMentionedOn: null, createdAt: '', updatedAt: '',
});
const people = [person(1, 'Marie', ['marie'], 4), person(2, 'Martin Dupont', ['martin'], 1), person(3, 'Zoë', ['zoe'], 2)];
const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

function Field({ initial = '', onOuterKeyDown = vi.fn() }: { initial?: string; onOuterKeyDown?: () => void }) {
  const [text, setText] = useState(initial);
  const clear = () => setText('');
  const mentions = useMentionAutocomplete(text, setText);
  return (
    // The Markdown editor listens on the field itself; the wrapper's capture comes first
    <div onKeyDown={onOuterKeyDown}>
      <div {...mentions.wrapperProps} className="relative">
        <textarea aria-label="Text" value={text} onChange={(event) => setText(event.target.value)} {...mentions.fieldProps} />
        <MentionSuggestions suggestions={mentions.suggestions} theme="light" language="en" t={t} />
      </div>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clear}>Clear</button>
    </div>
  );
}

function renderField(props: Parameters<typeof Field>[0] = {}) {
  render(
    <MentionPeopleContext.Provider value={{ people, byHandle: peopleByHandle(people) }}>
      <Field {...props} />
    </MentionPeopleContext.Provider>,
  );
  return screen.getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement;
}

/** Types the text with the caret at its end, as the browser reports it. */
function type(field: HTMLTextAreaElement, text: string) {
  fireEvent.change(field, { target: { value: text } });
  field.setSelectionRange(text.length, text.length);
  fireEvent.select(field);
}

describe('useMentionAutocomplete', () => {
  it('offers people after @, the most mentioned first, and points the field at the highlighted one', () => {
    const field = renderField();
    expect(field).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    type(field, 'Tea with @ma');

    const list = screen.getByRole('listbox', { name: 'People to mention' });
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Marie@marie4 entries', 'Martin Dupont@martin1 entry']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(field).toHaveAttribute('aria-controls', list.id);
    expect(field).toHaveAttribute('aria-activedescendant', options[0]!.id);
    expect(screen.getByRole('status')).toHaveTextContent('2 people to mention.');

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1]!.id);
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('writes the chosen person with Enter, keeping the keys from the field’s own handlers, and puts the caret after it', () => {
    vi.useFakeTimers();
    const onOuterKeyDown = vi.fn();
    const field = renderField({ onOuterKeyDown });

    type(field, 'Tea with @mar and cake');
    field.setSelectionRange(13, 13);
    fireEvent.select(field);
    fireEvent.keyDown(field, { key: 'Enter' });
    act(() => { vi.runAllTimers(); });

    expect(field).toHaveValue('Tea with @Marie and cake');
    expect(field.selectionStart).toBe(15);
    expect(onOuterKeyDown).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('writes a person by their handle when the name is not one, with Tab or a click, adding a space', () => {
    const field = renderField();

    type(field, '@dup');
    fireEvent.keyDown(field, { key: 'Tab' });
    expect(field).toHaveValue('@martin ');

    type(field, '@martin and @z');
    fireEvent.mouseDown(screen.getByRole('option'));
    fireEvent.click(screen.getByRole('option', { name: /Zoë/ }));
    expect(field).toHaveValue('@martin and @zoe ');
  });

  it('closes with Escape until the caret leaves the handle, and on blur', () => {
    const onOuterKeyDown = vi.fn();
    const field = renderField({ onOuterKeyDown });

    type(field, 'Hi @m');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onOuterKeyDown).not.toHaveBeenCalled();
    type(field, 'Hi @ma');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    type(field, 'Hi @ma and @z');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole('option'));
    fireEvent.blur(field);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes when the text is replaced from elsewhere', () => {
    const field = renderField();

    type(field, 'Hi @ma');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(field).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('lets other keys, modified keys and a selection through, and offers no one who does not match', () => {
    const onOuterKeyDown = vi.fn();
    const field = renderField({ onOuterKeyDown });

    type(field, '@m');
    fireEvent.keyDown(field, { key: 'a' });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(onOuterKeyDown).toHaveBeenCalledTimes(2);

    field.setSelectionRange(0, 2);
    fireEvent.select(field);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    type(field, '@nobody');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onOuterKeyDown).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
