import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BulkActionBar, EditForm, EntryReorderControls } from './EntriesList.helpers';
import { extractDate, getEntryCardStyle, getVisibilityButtonClass } from './EntriesList.utils';
import { mockEntries } from './EntriesList.test-utils';

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
    const t = (key: string, params?: Record<string, number>) => params?.count ? `${key}:${params.count}` : key;

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
        fireEvent.pointerEnter(buttons[0]);
        fireEvent.pointerUp(buttons[0]);
        fireEvent.pointerDown(buttons[1]);
        fireEvent.keyDown(buttons[1], { key: 'Enter' });

        expect(onTargetPointerEnter).toHaveBeenCalledTimes(1);
        expect(onTargetPointerUp).toHaveBeenCalledTimes(1);
        expect(onHandlePointerDown).toHaveBeenCalledTimes(1);
        expect(onHandleKeyDown).toHaveBeenCalledTimes(1);
        expect(screen.getAllByText('dropHere')).toHaveLength(1);
        expect(screen.getAllByText('dragToReorder')).toHaveLength(1);
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

        fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Updated text' } });
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
    });

    it('hides the bulk action bar when nothing is selected', () => {
        const { container } = render(
            <BulkActionBar
                selectedCount={0}
                allTags={[]}
                tagMetadata={{}}
                diaries={[]}
                isDark={true}
                onBulkAction={vi.fn()}
                onClearSelection={vi.fn()}
                t={t}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('handles bulk action buttons, tag picker, move picker, and clear selection', () => {
        const onBulkAction = vi.fn();
        const onClearSelection = vi.fn();

        render(
            <BulkActionBar
                selectedCount={2}
                allTags={['alpha', 'beta']}
                tagMetadata={{}}
                diaries={[
                    { id: 1, name: 'Home', icon: 'H' },
                    { id: 2, name: 'Work', icon: 'W' },
                ] as never}
                isDark={false}
                onBulkAction={onBulkAction}
                onClearSelection={onClearSelection}
                t={t}
            />,
        );

        fireEvent.click(screen.getByText('bulkDelete'));
        fireEvent.click(screen.getByText('bulkMakePublic'));
        fireEvent.click(screen.getByText('bulkMakePrivate'));
        fireEvent.click(screen.getByText('bulkArchive'));
        fireEvent.click(screen.getByText('bulkUnarchive'));

        fireEvent.click(screen.getByText('bulkAddTags'));
        fireEvent.click(screen.getByTestId('tag-picker'));
        fireEvent.click(screen.getByText('apply'));

        fireEvent.click(screen.getByText('bulkMove'));
        fireEvent.click(screen.getByText('W Work'));

        fireEvent.click(screen.getByText('bulkClearSelection'));

        expect(screen.getByText('bulkSelected:2')).toBeInTheDocument();
        expect(onBulkAction).toHaveBeenCalledWith('delete', undefined);
        expect(onBulkAction).toHaveBeenCalledWith('visibility', { visibility: 'public' });
        expect(onBulkAction).toHaveBeenCalledWith('visibility', { visibility: 'private' });
        expect(onBulkAction).toHaveBeenCalledWith('archive', { isArchived: true });
        expect(onBulkAction).toHaveBeenCalledWith('archive', { isArchived: false });
        expect(onBulkAction).toHaveBeenCalledWith('tags', { tags: ['alpha', 'beta'] });
        expect(onBulkAction).toHaveBeenCalledWith('move', { diaryId: 2 });
        expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('resets the tag picker when cancelling tag selection', () => {
        render(
            <BulkActionBar
                selectedCount={1}
                allTags={['alpha', 'beta']}
                tagMetadata={{}}
                diaries={[{ id: 1, name: 'Solo', icon: 'S' }] as never}
                isDark={true}
                onBulkAction={vi.fn()}
                onClearSelection={vi.fn()}
                t={t}
            />,
        );

        fireEvent.click(screen.getByText('bulkAddTags'));
        fireEvent.click(screen.getByTestId('tag-picker'));
        fireEvent.click(screen.getByText('cancel'));
        fireEvent.click(screen.getByText('bulkAddTags'));

        expect(screen.getByText('selectTags:')).toBeInTheDocument();
    });
});
