import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { HeatmapDayDetails } from './heatmapDayDetails';
import { placeHeatmapTooltip, type HeatmapTooltipPlacement } from './heatmapTooltipPlacement';

interface StatsHeatmapTooltipProps {
    /** The id of the day it describes. */
    readonly anchorId: string;
    readonly details: HeatmapDayDetails;
    /** A last line, such as how to open the day on a touch screen. */
    readonly hint?: string;
    readonly themeClass: 'light' | 'dark';
}

/**
 * The details of one day of the heatmap, beside it. It is drawn over the page (the heatmap scrolls
 * inside its card, which would clip it) and hidden from screen readers, which hear the same details
 * in the day's accessible name.
 */
export default function StatsHeatmapTooltip({ anchorId, details, hint, themeClass }: Readonly<StatsHeatmapTooltipProps>) {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [placement, setPlacement] = useState<HeatmapTooltipPlacement | null>(null);

    useLayoutEffect(() => {
        const place = () => {
            const anchor = document.getElementById(anchorId);
            const tooltip = tooltipRef.current;
            if (!anchor || !tooltip) return;
            setPlacement(placeHeatmapTooltip(
                anchor.getBoundingClientRect(),
                { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
                { width: document.documentElement.clientWidth, height: window.innerHeight },
            ));
        };
        place();
        // Follow the day when the page or the heatmap scrolls, or the window changes size
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [anchorId, details, hint]);

    return createPortal(
        <div
            ref={tooltipRef}
            className={`heatmap-tooltip ${themeClass}${placement?.below ? ' below' : ''}`}
            data-testid="heatmap-tooltip"
            aria-hidden="true"
            style={placement
                ? { top: placement.top, left: placement.left }
                : { top: 0, left: 0, visibility: 'hidden' }}
        >
            <p className="heatmap-tooltip-date">{details.date}</p>
            <p>{details.entries}</p>
            {details.words && <p className="heatmap-tooltip-words">{details.words}</p>}
            {details.goal && (
                <p className={`heatmap-tooltip-goal${details.goalMet ? ' met' : ''}`}>
                    {details.goalMet && <span aria-hidden="true">✓ </span>}
                    {details.goal}
                </p>
            )}
            {hint && <p className="heatmap-tooltip-hint">{hint}</p>}
        </div>,
        document.body,
    );
}
