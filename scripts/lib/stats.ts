/**
 * The one statistic the calibration scripts share.
 *
 * `analyze-status.ts` and `analyze-destinations.ts` are evidence: their tables
 * are what a threshold in `lib/status.ts` or `lib/destination.ts` was chosen
 * against. They each had a `quantile` of their own, and the two disagreed by
 * one rank – which is the sort of difference that makes two sections of the
 * same argument uncomparable without anyone noticing.
 */

/**
 * The value at share `q` of a sample, by nearest rank downwards: `0` is the
 * smallest value and `1` the largest, so the ends of a distribution table are
 * the ends of the data rather than an interpolation past them. An empty sample
 * has no quantile and reads as 0.
 */
export const quantile = (values: readonly number[], q: number): number => {
  const sorted = values.toSorted((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ??
    0
  );
};
