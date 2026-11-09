interface Size {
    readonly width: number;
    readonly height: number;
}

export interface HeatmapTooltipPlacement {
    readonly top: number;
    readonly left: number;
    readonly below: boolean;
}

/** Room kept between the tooltip and the window's edges, and between the tooltip and its day. */
const EDGE = 8;
const OFFSET = 8;

/**
 * Where the tooltip goes: centred above its day, or below when there is no room above, and moved
 * sideways (or up) to stay inside the window near its edges.
 */
export function placeHeatmapTooltip(anchor: DOMRect, tooltip: Size, viewport: Size): HeatmapTooltipPlacement {
    const maxLeft = Math.max(EDGE, viewport.width - tooltip.width - EDGE);
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - tooltip.width / 2, EDGE), maxLeft);
    const above = anchor.top - tooltip.height - OFFSET;
    if (above >= EDGE) return { top: above, left, below: false };
    const maxTop = Math.max(EDGE, viewport.height - tooltip.height - EDGE);
    return { top: Math.min(anchor.bottom + OFFSET, maxTop), left, below: true };
}
