/**
 * The climate chart's height, shared with the placeholder that stands in for
 * it while its chunk is on the way – a copy could end up a different height,
 * and then the block below it would jump when the chart arrives.
 *
 * A module of its own, because the placeholder lives in `detail-panel.tsx`:
 * importing it from the chart itself would pull recharts into the first load,
 * which is the one thing `next/dynamic` is there to prevent.
 */
export const CHART_HEIGHT = "h-44";
