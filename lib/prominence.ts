/**
 * The overview draws by fame, the list draws everything.
 *
 * Two hundred dots read at zoom 7; four hundred do not, and the file is
 * heading there (docs/plans/24-depth-per-destination.md). So the map has a
 * level of detail: at the widest zooms only the famous passes are drawn, the
 * known ones join at `PROMINENCE[1].fromZoom`, and everything is there from
 * `PROMINENCE[2].fromZoom` on. It is not a filter – the list is untouched and
 * no chip carries it – it is what a paper map does with its type sizes, and
 * the line under the map says which level is showing.
 *
 * What is selected, hovered or marked as a favourite ignores the rule: a mark
 * the visitor put there or is pointing at is never hidden by the zoom.
 *
 * The labels have their own, older ladder in `pass-map.tsx` (fame 4 from 7,
 * fame 3 from 8, fame 2 from 9.5); a dot always appears before its name.
 */
export const PROMINENCE = [
  { fromZoom: 0, minFame: 4, word: "berühmte Pässe" },
  { fromZoom: 7.5, minFame: 3, word: "bekannte Pässe" },
  { fromZoom: 8.5, minFame: 1, word: null },
] as const;

/** From which zoom on a road of this fame is drawn on the overview. */
export const minzoomOf = (fame: number): number =>
  PROMINENCE.find((p) => fame >= p.minFame)?.fromZoom ??
  PROMINENCE.at(-1)!.fromZoom;

/**
 * The legend line for a zoom: "bekannte Pässe" while the overview is thinned,
 * `null` once every road is drawn and there is nothing to say.
 */
export const prominenceWord = (zoom: number): string | null =>
  [...PROMINENCE].toReversed().find((p) => zoom >= p.fromZoom)?.word ?? null;

/**
 * A MapLibre filter that applies the rule: a top-level `step` on the zoom –
 * the one place a filter may read `["zoom"]` – with one branch per level.
 * `branch` builds the filter for one level from the fame floor it draws, or
 * from `null` where everything is drawn, so the caller adds what its layer
 * needs on top (a favourite is a star, not a dot; a selected pass is always
 * drawn) without this module knowing MapLibre's property names.
 */
export const prominenceFilter = <T>(branch: (minFame: number | null) => T) =>
  [
    "step",
    ["zoom"],
    ...PROMINENCE.flatMap((p, i) => {
      const b = branch(i === PROMINENCE.length - 1 ? null : p.minFame);
      return i === 0 ? [b] : [p.fromZoom, b];
    }),
  ] as const;
