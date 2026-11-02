import { useId, type Dispatch, type SetStateAction, type KeyboardEvent } from 'react';

import { ENTRIES_PER_PAGE_OPTIONS, entriesPerPageChoices } from '../../types/config';
import { mutedTextClass } from '../../utils/tintedText';

interface PaginationProps {
    readonly page: number;
    readonly totalPages: number;
    readonly setPage: Dispatch<SetStateAction<number>>;
    readonly inputPage: string;
    readonly setInputPage: Dispatch<SetStateAction<string>>;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    /** Entries per page; with `onPageSizeChange`, a select beside the page buttons changes it. */
    readonly pageSize?: number;
    readonly onPageSizeChange?: (pageSize: number) => void;
    /** Entries on this page: on a single page the size select stays while a smaller size would split them. */
    readonly pageEntryCount?: number;
}

function Pagination({
    page, totalPages, setPage, inputPage, setInputPage, theme, t, pageSize, onPageSizeChange, pageEntryCount = 0,
}: PaginationProps) {
    const inputId = useId();
    const pageSizeId = useId();
    const showPages = totalPages > 1;
    const showPageSize = Boolean(onPageSizeChange && pageSize)
        && (showPages || pageEntryCount > ENTRIES_PER_PAGE_OPTIONS[0]);
    if (!showPages && !showPageSize) {
        return null;
    }

    const buttonClass = `p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 ${theme === 'light'
            ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
            : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'
        }`;

    const labelClass = `text-sm ${mutedTextClass(theme !== 'light')}`;

    const fieldColorClass = theme === 'light'
        ? 'bg-gray-50 border-gray-300 text-gray-900'
        : 'bg-gray-900 border-gray-700 text-gray-100';
    const inputClass = `w-16 border rounded px-2 py-1 text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none ${fieldColorClass}`;
    const selectClass = `border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${fieldColorClass}`;

    const handleInputBlur = (): void => {
        let val = Number.parseInt(inputPage, 10);
        if (Number.isNaN(val) || val < 1) val = 1;
        if (val > totalPages) val = totalPages;
        setPage(val);
        setInputPage(val.toString());
    };

    return (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {showPages && (
                <div className="flex items-center gap-2">
                    <button type="button"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className={buttonClass}
                        title={t('first')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                    <button type="button"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={buttonClass}
                        title={t('previous')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2">
                        <label htmlFor={inputId} className={labelClass}>{t('page')}</label>
                        <input
                            id={inputId}
                            type="number"
                            min="1"
                            max={totalPages}
                            value={inputPage}
                            onChange={(e) => setInputPage(e.target.value)}
                            onBlur={handleInputBlur}
                            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className={inputClass}
                        />
                        <span className={labelClass}>{t('ofTotal', { total: totalPages })}</span>
                    </div>
                    <button type="button"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className={buttonClass}
                        title={t('next')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <button type="button"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className={buttonClass}
                        title={t('last')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
            {showPageSize && (
                <div className="flex items-center gap-2">
                    <label htmlFor={pageSizeId} className={labelClass}>{t('entriesPerPage')}</label>
                    <select
                        id={pageSizeId}
                        value={pageSize}
                        onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
                        className={selectClass}
                    >
                        {entriesPerPageChoices(pageSize ?? 0).map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

export default Pagination;
