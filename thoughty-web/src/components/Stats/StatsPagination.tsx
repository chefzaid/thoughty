interface StatsPaginationProps {
    readonly page: number;
    readonly totalPages: number;
    readonly onPageChange: (page: number) => void;
    readonly themeClass: 'light' | 'dark';
    readonly previousLabel: string;
    readonly nextLabel: string;
}

/** The previous and next buttons of a paged chart, shown when it has more than one page. */
export default function StatsPagination({ page, totalPages, onPageChange, themeClass, previousLabel, nextLabel }: StatsPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="pagination-controls">
            <button type="button"
                className={`pagination-btn ${themeClass}`}
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                title={previousLabel}
            >
                ←
            </button>
            <span className="pagination-info">
                {page + 1} / {totalPages}
            </span>
            <button type="button"
                className={`pagination-btn ${themeClass}`}
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                title={nextLabel}
            >
                →
            </button>
        </div>
    );
}
