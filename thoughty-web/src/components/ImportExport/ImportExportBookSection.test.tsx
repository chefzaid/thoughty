import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExport from './ImportExport';

vi.mock('../../contexts/AuthContext', () => {
    const authFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    return {
        useAuth: () => ({ authFetch }),
    };
});

const mockCloudSyncService = {
    getStatus: vi.fn(),
    getSchedules: vi.fn(),
    uploadExport: vi.fn(),
    setSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    triggerSync: vi.fn(),
    listFiles: vi.fn(),
    downloadFile: vi.fn(),
};

vi.mock('../../hooks/useAppState', () => ({
    useApiServices: () => ({ cloudSyncService: mockCloudSyncService }),
}));

const mockT = (key: string): string => key;
const mockFormatConfig = {
    entrySeparator: '----',
    sameDaySeparator: '****',
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ',',
};

const mockBookPreview = {
    title: 'Personal',
    author: 'jane',
    chapterCount: 2,
    entryCount: 5,
    chapters: [
        { title: 'travel', entryCount: 3, firstDate: '2024-01-10', lastDate: '2024-03-01' },
        { title: 'food', entryCount: 2, firstDate: '2024-01-15', lastDate: '2024-02-20' },
    ],
};

function createDeferredResponse() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((promiseResolve) => {
        resolve = promiseResolve;
    });

    return { promise, resolve };
}

async function renderBookSection(): Promise<void> {
    render(<ImportExport theme="dark" t={mockT} diaryId={1} diaryName="Personal" />);

    await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'book' })).toBeInTheDocument();
    });
}

describe('ImportExport book section', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockFormatConfig });
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
        globalThis.URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        mockCloudSyncService.getStatus.mockResolvedValue({});
        mockCloudSyncService.getSchedules.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the book section with its options', async () => {
        await renderBookSection();

        expect(screen.getByLabelText('bookTitleLabel')).toBeInTheDocument();
        expect(screen.getByLabelText('bookAuthorLabel')).toBeInTheDocument();
        expect(screen.getByLabelText('bookChapterMode')).toBeInTheDocument();
        expect(screen.getByLabelText('bookChapterOrder')).toBeInTheDocument();
        expect(screen.getByLabelText('bookTagScope')).toBeInTheDocument();
        expect(screen.getByLabelText('bookWeavingMode')).toBeInTheDocument();
        expect(screen.getByText('bookIncludeUntagged')).toBeInTheDocument();
        expect(screen.getByText('bookChapterFraming')).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'bookCoverTheme' })).toBeInTheDocument();
        expect(screen.getByLabelText('bookCoverChooseImage')).toBeInTheDocument();
        expect(screen.getByText('previewBook')).toBeInTheDocument();
        expect(screen.getByText('downloadBook')).toBeInTheDocument();
        expect(screen.getByLabelText('bookCloudProvider')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'uploadBook' })).toBeDisabled();
        expect(screen.getByText('bookCloudConnectHint')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'book' })).toBeInTheDocument();
    });

    it('previews the book outline with the selected options', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => mockBookPreview });

        await renderBookSection();

        fireEvent.change(screen.getByLabelText('bookTitleLabel'), { target: { value: 'My Year' } });
        fireEvent.change(screen.getByLabelText('bookChapterOrder'), { target: { value: 'entries' } });
        fireEvent.click(screen.getByText('previewBook'));

        await waitFor(() => {
            expect(screen.getByText('bookOutline')).toBeInTheDocument();
            expect(screen.getByText('travel')).toBeInTheDocument();
            expect(screen.getByText('food')).toBeInTheDocument();
        });

        const previewCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/books/preview'));
        expect(previewCall).toBeTruthy();
        expect((previewCall as [string])[0]).toContain('diaryId=1');
        expect((previewCall as [string])[0]).toContain('title=My+Year');
        expect((previewCall as [string])[0]).toContain('chapterOrder=entries');
    });

    it('previews a yearbook outline with calendar chapters', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ...mockBookPreview, chapters: [{ title: '2024', entryCount: 5, firstDate: '2024-01-10', lastDate: '2024-03-01' }] }),
        });

        await renderBookSection();

        fireEvent.change(screen.getByLabelText('bookChapterMode'), { target: { value: 'year' } });
        fireEvent.click(screen.getByText('previewBook'));

        await screen.findByText('2024');

        const previewCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/books/preview'));
        expect((previewCall as [string])[0]).toContain('chapterMode=year');
        expect(screen.getByLabelText('bookChapterOrder')).toBeDisabled();
        expect(screen.getByLabelText('bookTagScope')).toBeDisabled();
    });

    it('shows a hint when no chapters could be built', async () => {
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ...mockBookPreview, chapterCount: 0, entryCount: 0, chapters: [] }),
        });

        await renderBookSection();

        fireEvent.click(screen.getByText('previewBook'));

        await screen.findByText('bookNoChapters');
    });

    it('downloads the book with the selected format and options', async () => {
        const mockBlob = new Blob(['%PDF-'], { type: 'application/pdf' });
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            blob: async () => mockBlob,
            headers: new Headers({ 'Content-Disposition': 'attachment; filename="thoughty_book.html"' }),
        });

        await renderBookSection();

        fireEvent.change(screen.getByLabelText('exportFormat'), { target: { value: 'html' } });
        fireEvent.change(screen.getByLabelText('bookTagScope'), { target: { value: 'first' } });
        fireEvent.click(screen.getByText('bookIncludeToc'));
        fireEvent.click(screen.getByText('downloadBook'));

        await screen.findByText('bookExportSuccess');

        const exportCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/books/export'));
        expect(exportCall).toBeTruthy();
        expect((exportCall as [string])[0]).toContain('format=html');
        expect((exportCall as [string])[0]).toContain('tagScope=first');
        expect((exportCall as [string])[0]).toContain('includeToc=false');
        // AI narrative is on by default, so no override parameter is sent
        expect((exportCall as [string])[0]).not.toContain('narrative=');
        expect((exportCall as [string])[0]).not.toContain('weavingMode=');
    });

    it('downloads the book with the selected AI weaving mode', async () => {
        const mockBlob = new Blob(['# Book'], { type: 'text/markdown' });
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            blob: async () => mockBlob,
            headers: new Headers(),
        });

        await renderBookSection();

        fireEvent.change(screen.getByLabelText('bookWeavingMode'), { target: { value: 'creative' } });
        fireEvent.click(screen.getByText('downloadBook'));

        await screen.findByText('bookExportSuccess');

        const exportCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/books/export'));
        expect((exportCall as [string])[0]).toContain('weavingMode=creative');
    });

    it('posts a validated custom cover image with the selected theme', async () => {
        const mockBlob = new Blob(['<html>'], { type: 'text/html' });
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            blob: async () => mockBlob,
            headers: new Headers(),
        });
        const cover = new File(['image bytes'], 'cover.png', { type: 'image/png' });

        await renderBookSection();

        fireEvent.click(screen.getByText('bookCoverThemeOcean'));
        fireEvent.change(screen.getByLabelText('bookCoverChooseImage'), {
            target: { files: [cover] },
        });
        await screen.findByAltText('bookCoverPreview');
        fireEvent.click(screen.getByText('downloadBook'));

        await screen.findByText('bookExportSuccess');
        const exportCall = (globalThis.fetch as Mock).mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('/api/books/export'),
        ) as [string, RequestInit];
        expect(exportCall[0]).toContain('coverTheme=ocean');
        expect(exportCall[1].method).toBe('POST');
        expect(exportCall[1].body).toBeInstanceOf(FormData);
        expect((exportCall[1].body as FormData).get('coverImage')).toBe(cover);
    });

    it('rejects an invalid cover image and allows removing a selected image', async () => {
        await renderBookSection();

        const input = screen.getByLabelText('bookCoverChooseImage');
        fireEvent.change(input, {
            target: { files: [new File(['text'], 'cover.txt', { type: 'text/plain' })] },
        });
        expect(screen.getByRole('alert')).toHaveTextContent('bookCoverImageInvalid');
        expect(screen.queryByAltText('bookCoverPreview')).not.toBeInTheDocument();

        fireEvent.change(input, {
            target: { files: [new File(['image'], 'cover.jpg', { type: 'image/jpeg' })] },
        });
        await screen.findByAltText('bookCoverPreview');
        fireEvent.click(screen.getByRole('button', { name: 'bookCoverRemoveImage' }));
        expect(screen.queryByAltText('bookCoverPreview')).not.toBeInTheDocument();
    });

    it('uploads the generated book to a connected cloud provider', async () => {
        mockCloudSyncService.getStatus.mockResolvedValue({
            google_drive: { connected: true },
            dropbox: { connected: true },
            onedrive: { connected: false },
        });
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                id: 'cloud-book-1',
                name: 'thoughty_book_My_Year.epub',
                size: 2048,
                modifiedAt: '2026-07-23',
            }),
        });

        await renderBookSection();

        await waitFor(() => expect(screen.getByLabelText('bookCloudProvider')).toHaveValue('google_drive'));
        fireEvent.change(screen.getByLabelText('bookTitleLabel'), { target: { value: 'My Year' } });
        fireEvent.change(screen.getByLabelText('exportFormat'), { target: { value: 'epub' } });
        fireEvent.change(screen.getByLabelText('bookCloudProvider'), { target: { value: 'dropbox' } });
        fireEvent.click(screen.getByRole('button', { name: 'uploadBook' }));

        await screen.findByText('bookCloudUploadSuccess');

        const uploadCall = (globalThis.fetch as Mock).mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('/api/books/upload'),
        );
        expect(uploadCall).toBeTruthy();
        expect((uploadCall as [string, RequestInit])[0]).toContain('provider=dropbox');
        expect((uploadCall as [string, RequestInit])[0]).toContain('format=epub');
        expect((uploadCall as [string, RequestInit])[0]).toContain('title=My+Year');
        expect((uploadCall as [string, RequestInit])[1]).toMatchObject({ method: 'POST' });
    });

    it('shows book generation progress while a download is running', async () => {
        const deferred = createDeferredResponse();
        const mockBlob = new Blob(['%PDF-'], { type: 'application/pdf' });
        (globalThis.fetch as Mock).mockReturnValueOnce(deferred.promise);

        await renderBookSection();

        fireEvent.click(screen.getByText('downloadBook'));

        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'generatingBook');
        expect(screen.getByRole('button', { name: 'generatingBook' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'previewBook' })).toBeDisabled();

        deferred.resolve({
            ok: true,
            blob: async () => mockBlob,
            headers: new Headers(),
        } as Response);

        await screen.findByText('bookExportSuccess');
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('requests a plain book when the AI narrative option is unchecked', async () => {
        const mockBlob = new Blob(['%PDF-'], { type: 'application/pdf' });
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            blob: async () => mockBlob,
            headers: new Headers(),
        });

        await renderBookSection();

        fireEvent.click(screen.getByText('bookNarrative'));
        fireEvent.click(screen.getByText('downloadBook'));

        await screen.findByText('bookExportSuccess');

        const exportCall = (globalThis.fetch as Mock).mock.calls.find((call: unknown[]) => (call[0] as string).includes('/api/books/export'));
        expect((exportCall as [string])[0]).toContain('narrative=false');
    });

    it('requests AI chapter introductions and summaries independently of narrative weaving', async () => {
        const mockBlob = new Blob(['# Book'], { type: 'text/markdown' });
        (globalThis.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            blob: async () => mockBlob,
            headers: new Headers(),
        });

        await renderBookSection();

        fireEvent.click(screen.getByText('bookNarrative'));
        fireEvent.click(screen.getByText('bookChapterFraming'));
        fireEvent.click(screen.getByText('downloadBook'));

        await screen.findByText('bookExportSuccess');

        const exportCall = (globalThis.fetch as Mock).mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('/api/books/export'),
        );
        expect((exportCall as [string])[0]).toContain('narrative=false');
        expect((exportCall as [string])[0]).toContain('chapterFraming=true');
    });

    it('shows errors when preview and download fail', async () => {
        const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        (globalThis.fetch as Mock)
            .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
            .mockRejectedValueOnce(new Error('boom'));

        await renderBookSection();

        fireEvent.click(screen.getByText('previewBook'));
        await screen.findByText('bookPreviewError');

        fireEvent.click(screen.getByText('downloadBook'));
        await screen.findByText('bookExportError');
        expect(mockConsoleError).toHaveBeenCalled();
    });
});
