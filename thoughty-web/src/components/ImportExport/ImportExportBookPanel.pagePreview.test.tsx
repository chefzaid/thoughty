import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getTranslation, type Language } from '../../utils/translations';
import { ImportExportBookPanel } from './ImportExportBookPanel';

const openBookPdf = vi.hoisted(() => vi.fn());
vi.mock('../BookPreview/bookPdf', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../BookPreview/bookPdf')>()),
    openBookPdf,
}));

const pdfFile = { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob;

function renderPanel(language: Language = 'en', isLight = false) {
    openBookPdf.mockResolvedValue({
        pageCount: 3,
        chapters: [{ title: 'Chapter 1: travel', pageNumber: 3 }],
        pageSize: async () => ({ width: 794, height: 1123 }),
        renderPage: () => ({ done: Promise.resolve(), cancel: () => undefined }),
        pageText: async () => 'Personal',
        destroy: async () => undefined,
    });
    const authFetch = vi.fn(async (url: string) => (url.startsWith('/api/books/export')
        ? {
            ok: true,
            headers: new Headers({ 'Content-Disposition': 'attachment; filename="book.pdf"' }),
            blob: async () => pdfFile,
        }
        : { ok: true, json: async () => [] }) as unknown as Response);
    render(
        <ImportExportBookPanel
            activeSection="book"
            authFetch={authFetch}
            connectedProviders={[]}
            diaryId={1}
            diaryName="Personal"
            isLight={isLight}
            language={language}
            sectionRef={{ current: null }}
            showMessage={vi.fn()}
            t={(key, params) => getTranslation(language, key, params)}
        />,
    );
    return authFetch;
}

describe('ImportExportBookPanel page preview', () => {
    it('warns that the preview spends AI tokens only while AI writing is on', () => {
        renderPanel();
        const preview = screen.getByRole('button', { name: 'Preview Book' });

        expect(preview).toHaveAccessibleDescription(/uses AI tokens/);
        fireEvent.click(screen.getByLabelText('Weave thoughts into flowing prose with AI'));
        expect(preview).not.toHaveAccessibleDescription(/uses AI tokens/);
        fireEvent.click(screen.getByLabelText('Add AI chapter introductions and summaries'));
        expect(preview).toHaveAccessibleDescription(/uses AI tokens/);
    });

    it('opens the generated PDF page by page and returns focus when closed', async () => {
        const authFetch = renderPanel();
        const preview = screen.getByRole('button', { name: 'Preview Book' });
        preview.focus();
        fireEvent.click(preview);

        const dialog = await screen.findByRole('dialog', { name: 'Book preview' });
        expect(dialog.parentElement).toHaveClass('book-reader--dark');
        expect(await screen.findByRole('toolbar', { name: 'Page controls' })).toHaveTextContent('Page 1 of 3');
        expect(screen.queryByText(/The preview shows the PDF edition/)).not.toBeInTheDocument();
        expect(authFetch).toHaveBeenCalledWith('/api/books/export?diaryId=1', expect.objectContaining({ signal: expect.any(AbortSignal) }));

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(preview).toHaveFocus();
    });

    it('says in French that another format downloads separately', async () => {
        renderPanel('fr', true);
        fireEvent.change(screen.getByLabelText('Format du livre'), { target: { value: 'epub' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aperçu du livre' }));

        const dialog = await screen.findByRole('dialog', { name: 'Aperçu du livre' });
        expect(dialog.parentElement).toHaveClass('book-reader--light');
        expect(screen.getByText(/L'aperçu montre l'édition PDF.*l'édition EPUB \(\.epub\)/)).toBeInTheDocument();
        expect(await screen.findByRole('toolbar', { name: 'Commandes des pages' })).toHaveTextContent('Page 1 sur 3');
        expect(screen.getByRole('button', { name: 'Télécharger le PDF' })).toBeEnabled();
    });
});
