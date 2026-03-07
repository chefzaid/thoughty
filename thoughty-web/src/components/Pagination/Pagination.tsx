import React, { Dispatch, SetStateAction, KeyboardEvent } from 'react';

interface PaginationProps {
    readonly page: number;
    readonly totalPages: number;
    readonly setPage: Dispatch<SetStateAction<number>>;
    readonly inputPage: string;
    readonly setInputPage: Dispatch<SetStateAction<string>>;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function Pagination({ page, totalPages, setPage, inputPage, setInputPage, theme, t }: PaginationProps): React.ReactElement {
    const buttonClass = `p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 ${theme === 'light'
            ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
            : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400'
        }`;

    const inputClass = `w-16 border rounded px-2 py-1 text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
            ? 'bg-gray-50 border-gray-300 text-gray-900'
            : 'bg-gray-900 border-gray-700 text-gray-100'
        }`;

    const handleInputBlur = (): void => {
        let val = Number.parseInt(inputPage, 10);
        if (Number.isNaN(val) || val < 1) val = 1;
        if (val > totalPages) val = totalPages;
        setPage(val);
        setInputPage(val.toString());
    };

    return (
        <div className="flex justify-center items-center gap-2 mt-8">
            <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className={buttonClass}
                title={t('first')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
            </button>
            <button
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
                <span className="text-gray-400 text-sm">{t('page')}</span>
                <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={inputPage}
                    onChange={(e) => setInputPage(e.target.value)}
                    onBlur={handleInputBlur}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className={inputClass}
                />
                <span className="text-gray-400 text-sm">{t('ofTotal', { total: totalPages })}</span>
            </div>
            <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={buttonClass}
                title={t('next')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
            <button
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
    );
}

export default Pagination;
