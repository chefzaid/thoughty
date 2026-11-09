import TagBadge from '../TagBadge/TagBadge';
import type { TagMetadataMap } from '../../utils/tagMetadata';
import StatsPagination from './StatsPagination';

export interface YearTagData {
    readonly year: string;
    readonly topTags: readonly [string, number][];
}

interface StatsTagsByYearProps {
    /** The years on this page, newest first, each with its top tags and their counts. */
    readonly rows: readonly YearTagData[];
    readonly page: number;
    readonly totalPages: number;
    readonly onPageChange: (page: number) => void;
    readonly theme?: 'light' | 'dark';
    readonly themeClass: 'light' | 'dark';
    readonly tagMetadata?: TagMetadataMap;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** The five tags used most each year, a page of years at a time. */
function StatsTagsByYear({ rows, page, totalPages, onPageChange, theme, themeClass, tagMetadata, t }: StatsTagsByYearProps) {
    return (
        <div className={`chart-card ${themeClass}`}>
            <div className="chart-header">
                <h2>{t('topTagsByYear')}</h2>
                <StatsPagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    themeClass={themeClass}
                    previousLabel={t('newerYears')}
                    nextLabel={t('olderYears')}
                />
            </div>
            <div className="tag-breakdown">
                <table className="tag-table">
                    <thead>
                        <tr>
                            <th>{t('year')}</th>
                            <th>{t('topTags')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ year, topTags }) => (
                            <tr key={year}>
                                <td>{year}</td>
                                <td>
                                    {topTags.map(([tag, count]) => (
                                        <TagBadge
                                            key={tag}
                                            tag={tag}
                                            metadata={tagMetadata}
                                            theme={theme}
                                            showHash={false}
                                            size="xs"
                                            suffix={` (${count})`}
                                            className="mr-2"
                                        />
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default StatsTagsByYear;
