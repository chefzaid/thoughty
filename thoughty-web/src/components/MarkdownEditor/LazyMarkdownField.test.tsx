import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import LazyMarkdownField from './LazyMarkdownField';

// The editor's chunk arrives only when the test lets it, as it does over a slow connection
const chunk = vi.hoisted(() => {
    let release: () => void = () => {};
    const loaded = new Promise<void>((resolve) => { release = resolve; });
    return { loaded, release: () => release() };
});
vi.mock('./MarkdownEditor', async () => {
    await chunk.loaded;
    return {
        default: ({ value }: { value?: string }) => <textarea aria-label="editor" value={value} readOnly />,
    };
});

const t = (key: string) => key;

function Field({ text }: { readonly text: string }) {
    return (
        <LazyMarkdownField
            fallback={<textarea aria-label="fallback" value={text} readOnly />}
            suggestions={<ul aria-label="People to mention" />}
            value={text}
            t={t}
        />
    );
}

async function loadEditor(): Promise<HTMLTextAreaElement> {
    await act(async () => chunk.release());
    return screen.findByLabelText<HTMLTextAreaElement>('editor');
}

describe('LazyMarkdownField', () => {
    beforeEach(() => {
        document.body.focus();
    });

    it('keeps the writer typing in the editor once it loads, focus and selection where they were in the fallback', async () => {
        const { unmount } = render(<Field text="- call @pa" />);
        const fallback = screen.getByLabelText<HTMLTextAreaElement>('fallback');
        // The suggestions and the help are there while the editor loads
        expect(screen.getByRole('list', { name: 'People to mention' })).toBeInTheDocument();
        expect(screen.getByText('markdownHelpSummary')).toBeInTheDocument();
        fallback.focus();
        fallback.setSelectionRange(2, 10, 'backward');

        const editor = await loadEditor();

        expect(screen.queryByLabelText('fallback')).toBeNull();
        expect(document.activeElement).toBe(editor);
        expect([editor.selectionStart, editor.selectionEnd, editor.selectionDirection]).toEqual([2, 10, 'backward']);
        expect(screen.getByRole('list', { name: 'People to mention' })).toBeInTheDocument();
        unmount();
    });

    it('leaves the focus alone when the writer was not in the fallback, and once the editor has loaded', async () => {
        const { unmount } = render(<Field text="Notes" />);
        const editor = await loadEditor();
        expect(document.activeElement).not.toBe(editor);
        unmount();

        // Loaded already, the editor shows at once and takes no focus of its own
        render(<Field text="Notes" />);
        expect(screen.queryByLabelText('fallback')).toBeNull();
        expect(document.activeElement).not.toBe(screen.getByLabelText('editor'));
    });
});
