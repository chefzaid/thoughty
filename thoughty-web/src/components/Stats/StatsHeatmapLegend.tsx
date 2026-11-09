import type { HeatmapGoal } from './heatmapDayDetails';

interface StatsHeatmapLegendProps {
    readonly goal?: HeatmapGoal;
    readonly themeClass: 'light' | 'dark';
    readonly t: (key: string) => string;
}

/**
 * The key under the heatmap, as on a contribution graph: the goal's mark on the left, the shades from
 * less to more on the right. Below the map, a day's details (drawn above the day) never hide it.
 */
export default function StatsHeatmapLegend({ goal, themeClass, t }: Readonly<StatsHeatmapLegendProps>) {
    return (
        <div className="heatmap-legend">
            {goal && (
                <span className="heatmap-legend-goal">
                    {goal.period === 'day'
                        ? <span className={`heatmap-cell ${themeClass} level-2 goal-met`} aria-hidden="true" />
                        : <span className="heatmap-goal-week" aria-hidden="true">✓</span>}
                    {t(goal.period === 'day' ? 'statsHeatmapGoalLegendDay' : 'statsHeatmapGoalLegendWeek')}
                </span>
            )}
            <span className="heatmap-legend-shades">
                <span>{t('lessActivity')}</span>
                <span className="heatmap-legend-scale" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((level) => (
                        <span key={level} className={`heatmap-cell ${themeClass} level-${level}`} />
                    ))}
                </span>
                <span>{t('moreActivity')}</span>
            </span>
        </div>
    );
}
