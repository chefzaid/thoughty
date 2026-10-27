import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditForm, EntryReorderControls } from './EntriesList.helpers';
import { extractDate, getEntryCardStyle, getVisibilityButtonClass } from './EntriesList.utils';
import { mockEntries } from './EntriesList.test-utils';
import { getTranslation } from '../../utils/translations';
import { MentionPeopleContext } from '../People/PeopleContext';
import { peopleByHandle } from '../../utils/mentions';

vi.mock('../TagPicker/TagPicker', () => ({
    default: ({ onChange, placeholder, selectedTags }: { onChange: (tags: string[]) => void; placeholder: string; selectedTags: string[] }) => (
        <button type="button" data-testid="tag-picker" onClick={() => onChange(['alpha', 'beta'])}>
            {placeholder}:{selectedTags.join(',')}
        </button>
    ),
}));

vi.mock('../AttachmentUpload/AttachmentUpload', () => ({
    default: ({ onAddFile, onRemovePendingFile, onRemoveUploadedAttachment }: {
        onAddFile?: (file: File) => void;
        onRemovePendingFile?: (index: number) => void;
        onRemoveUploadedAttachment?: (id: number) => void;
    }) => (
        <div data-testid="attachment-upload">
            <button type="button" onClick={() => onAddFile?.(new File(['x'], 'extra.txt'))}>add-file</button>
            <button type="button" onClick={() => onRemovePendingFile?.(0)}>remove-pending</button>
            <button type="button" onClick={() => onRemoveUploadedAttachment?.(3)}>remove-uploaded</button>
        </div>
    ),
}));

vi.mock('../TypedDatePicker/TypedDatePicker', () => ({
    default: ({ onChange }: { onChange: (date: Date | null) => void }) => (
        <input
            data-testid="date-picker"
            onChange={(event) => onChange(new Date((event.target as HTMLInputElement).value))}
        />
    ),
}));

vi.mock('../VisibilityIcon/VisibilityIcon', () => ({
    default: ({ visibility }: { visibility: string }) => <span data-testid="visibility-icon">{visibility}</span>,
}));

vi.mock('@uiw/react-md-editor/nohighlight', () => ({
    default: ({ onChange }: { onChange?: (value?: string) => void }) => (
        <button type="button" data-testid="md-editor" onClick={() => onChange?.('markdown edit')}>
            md-editor
        </button>
    ),
}));

describe('EntriesList.helpers', () => {
    const t = (key: string, params?: Record<string, string | number>) => params?.count ? `${key}:${params.count}` : key;

    it('extractDate strips the time portion from ISO datetimes', () => {
        expect(extractDate('2024-01-15T18:30:00.000Z')).toBe('2024-01-15');
        expect(extractDate('2024-01-15')).toBe('2024-01-15');
    });

    it('getEntryCardStyle returns a diary accent style when diary data exists', () => {
        expect(getEntryCardStyle(mockEntries[0])).toMatchObject({
            borderLeftWidth: '5px',
            borderLeftStyle: 'solid',
            borderLeftColor: '#2A9D8F',
        });
    });

    it('getVisibilityButtonClass uses the public state styling', () => {
        expect(getVisibilityButtonClass('public', 'dark')).toContain('border-green-500');
        expect(getVisibilityButtonClass('private', 'light')).toContain('border-gray-300');
    });

    it('renders reorder controls as spacer or interactive controls depending on draggable state', () => {
        const { rerender, container } = render(
            <EntryReorderControls
                isDraggable={false}
                reserveSpace={true}
                isDraggedEntry={false}
                isDropTarget={false}
                isDark={true}
                dragDateMatches={false}
                dragToReorderLabel="dragToReorder"
                dropHereLabel="dropHere"
                onHandlePointerDown={vi.fn()}
                onHandleKeyDown={vi.fn()}
                onTargetPointerEnter={vi.fn()}
                onTargetPointerUp={vi.fn()}
            />,
        );

        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();

        rerender(
            <EntryReorderControls
                isDraggable={false}
                reserveSpace={false}
                isDraggedEntry={false}
                isDropTarget={false}
                isDark={true}
                dragDateMatches={false}
                dragToReorderLabel="dragToReorder"
                dropHereLabel="dropHere"
                onHandlePointerDown={vi.fn()}
                onHandleKeyDown={vi.fn()}
                onTargetPointerEnter={vi.fn()}
                onTargetPointerUp={vi.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('handles reorder drag interactions and renders drag badges', () => {
        const onHandlePointerDown = vi.fn();
        const onHandleKeyDown = vi.fn();
        const onTargetPointerEnter = vi.fn();
        const onTargetPointerUp = vi.fn();

        render(
            <EntryReorderControls
                isDraggable={true}
                reserveSpace={false}
                isDraggedEntry={true}
                isDropTarget={true}
                isDark={false}
                dragDateMatches={true}
                dragToReorderLabel="dragToReorder"
                dropHereLabel="dropHere"
                onHandlePointerDown={onHandlePointerDown}
                onHandleKeyDown={onHandleKeyDown}
                onTargetPointerEnter={onTargetPointerEnter}
                onTargetPointerUp={onTargetPointerUp}
            />,
        );

        const buttons = screen.getAllByRole('button', { name: 'dragToReorder' });
        const dropTargetButton = buttons.at(0);
        const dragHandleButton = buttons.at(1);

        if (!dropTargetButton || !dragHandleButton) {
            throw new Error('Expected reorder buttons to render');
        }

        fireEvent.pointerEnter(dropTargetButton);
        fireEvent.pointerUp(dropTargetButton);
        fireEvent.pointerDown(dragHandleButton);
        fireEvent.keyDown(dragHandleButton, { key: 'Enter' });

        expect(onTargetPointerEnter).toHaveBeenCalledTimes(1);
        expect(onTargetPointerUp).toHaveBeenCalledTimes(1);
        expect(onHandlePointerDown).toHaveBeenCalledTimes(1);
        expect(onHandleKeyDown).toHaveBeenCalledTimes(1);
        expect(screen.getAllByText('dropHere')).toHaveLength(1);
        expect(screen.getAllByText('dragToReorder')).toHaveLength(1);
    });

    it('suggests the writer’s people after @ while editing', () => {
        const marie = { id: 12, name: 'Marie', handles: ['marie'], entryCount: 1, lastMentionedOn: null, createdAt: '', updatedAt: '' };
        const setEditText = vi.fn();
        render(
            <MentionPeopleContext.Provider value={{ people: [marie], byHandle: peopleByHandle([marie]) }}>
                <EditForm
                    config={{ theme: 'light', language: 'en' } as never}
                    editText="Hi @ma"
                    setEditText={setEditText}
                    editDate={new Date('2024-01-15')}
                    setEditDate={vi.fn()}
                    allTags={[]}
                    tagMetadata={{}}
                    editTags={[]}
                    setEditTags={vi.fn()}
                    editVisibility="private"
                    setEditVisibility={vi.fn()}
                    editFormat="plain"
                    setEditFormat={vi.fn()}
                    onSaveEdit={vi.fn()}
                    onCancelEdit={vi.fn()}
                    t={t}
                />
            </MentionPeopleContext.Provider>,
        );

        const field = screen.getByDisplayValue('Hi @ma') as HTMLTextAreaElement;
        field.setSelectionRange(6, 6);
        fireEvent.select(field);
        fireEvent.keyDown(field, { key: 'Tab' });
        expect(setEditText).toHaveBeenCalledWith('Hi @Marie ');
    });

    it('renders the edit form and wires text, date, tag, attachment, format, visibility, save, and cancel handlers', () => {
        const setEditText = vi.fn();
        const setEditDate = vi.fn();
        const setEditTags = vi.fn();
        const setEditVisibility = vi.fn();
        const setEditFormat = vi.fn();
        const onAddEditFile = vi.fn();
        const onRemoveEditPendingFile = vi.fn();
        const onRemoveEditAttachment = vi.fn();
        const onSaveEdit = vi.fn();
        const onCancelEdit = vi.fn();

        render(
            <EditForm
                config={{ theme: 'dark' } as never}
                editText="Current text"
                setEditText={setEditText}
                editDate={new Date('2024-01-15')}
                setEditDate={setEditDate}
                allTags={['alpha', 'beta']}
                tagMetadata={{}}
                editTags={['alpha']}
                setEditTags={setEditTags}
                editVisibility="private"
                setEditVisibility={setEditVisibility}
                editFormat="plain"
                setEditFormat={setEditFormat}
                editPendingFiles={[]}
                editExistingAttachments={[]}
                onAddEditFile={onAddEditFile}
                onRemoveEditPendingFile={onRemoveEditPendingFile}
                onRemoveEditAttachment={onRemoveEditAttachment}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                t={t}
            />,
        );

        fireEvent.change(screen.getByDisplayValue('Current text'), { target: { value: 'Updated text' } });
        fireEvent.change(screen.getByTestId('date-picker'), { target: { value: '2024-03-01' } });
        fireEvent.click(screen.getByTestId('tag-picker'));
        fireEvent.click(screen.getByText('MD').closest('button') as HTMLElement);
        fireEvent.click(screen.getByTitle('private'));
        fireEvent.click(screen.getByText('add-file'));
        fireEvent.click(screen.getByText('remove-pending'));
        fireEvent.click(screen.getByText('remove-uploaded'));
        fireEvent.click(screen.getByText('save'));
        fireEvent.click(screen.getByText('cancel'));

        expect(setEditText).toHaveBeenCalledWith('Updated text');
        expect(setEditDate).toHaveBeenCalledWith(expect.any(Date));
        expect(setEditTags).toHaveBeenCalledWith(['alpha', 'beta']);
        expect(setEditFormat).toHaveBeenCalled();
        expect(setEditVisibility).toHaveBeenCalled();
        expect(onAddEditFile).toHaveBeenCalled();
        expect(onRemoveEditPendingFile).toHaveBeenCalledWith(0);
        expect(onRemoveEditAttachment).toHaveBeenCalledWith(3);
        expect(onSaveEdit).toHaveBeenCalledTimes(1);
        expect(onCancelEdit).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('attachment-upload')).toBeInTheDocument();
        expect(screen.getByTestId('visibility-icon')).toHaveTextContent('private');
    });

    it('renders the markdown edit form branch', async () => {
        const setEditText = vi.fn();

        render(
            <EditForm
                config={{ theme: 'light' } as never}
                editText="Markdown text"
                setEditText={setEditText}
                editDate={new Date('2024-01-15')}
                setEditDate={vi.fn()}
                allTags={[]}
                tagMetadata={{}}
                editTags={[]}
                setEditTags={vi.fn()}
                editVisibility="public"
                setEditVisibility={vi.fn()}
                editFormat="markdown"
                setEditFormat={vi.fn()}
                onSaveEdit={vi.fn()}
                onCancelEdit={vi.fn()}
                t={t}
            />,
        );

        fireEvent.click(await screen.findByTestId('md-editor'));
        expect(setEditText).toHaveBeenCalledWith('markdown edit');
        expect(screen.getByText('markdownHelpSummary')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'focusModeOpen' }));
        expect(screen.getByRole('textbox', { name: 'focusModeTextLabel' })).toHaveValue('Markdown text');
    });

    it.each([
        ['en', 'tags...'],
        ['fr', 'tags...'],
    ] as const)('gives the edit tag picker its own placeholder in %s, not the filter one', (language, placeholder) => {
        render(
            <EditForm
                config={{ theme: 'dark', language } as never}
                editText="Text"
                setEditText={vi.fn()}
                editDate={new Date('2024-01-15')}
                setEditDate={vi.fn()}
                allTags={[]}
                tagMetadata={{}}
                editTags={[]}
                setEditTags={vi.fn()}
                editVisibility="private"
                setEditVisibility={vi.fn()}
                editFormat="plain"
                setEditFormat={vi.fn()}
                onSaveEdit={vi.fn()}
                onCancelEdit={vi.fn()}
                t={(key, params) => getTranslation(language, key, params)}
            />,
        );

        expect(screen.getByTestId('tag-picker')).toHaveTextContent(`${placeholder}:`);
        expect(screen.getByTestId('tag-picker')).not.toHaveTextContent(/Filter|Filtrer/);
    });
});
