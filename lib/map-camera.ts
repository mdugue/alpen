/**
 * The arithmetic behind the map's padding, kept out of `pass-map.tsx` so it can
 * be read and tested without a WebGL context.
 *
 * MapLibre draws the camera centre in the middle of the *padded* box, so the
 * padding is not a passive margin: changing it moves the picture. The panels in
 * front of the map change it often – the detail sheet on a phone takes more
 * than half the screen – and `Map.setPadding` is a `jumpTo`, which is why the
 * app never calls it after the first frame. A padding change either rides along
 * with the camera move that caused it or eases on its own; both need the numbers
 * below.
 */

/** Padding on all four edges in pixels, every side filled in. */
export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSET: Inset = { bottom: 0, left: 0, right: 0, top: 0 };

/** MapLibre's `getPadding()` may leave sides out; here they are all numbers. */
export const toInset = (p?: Partial<Inset>): Inset => ({
  bottom: p?.bottom ?? 0,
  left: p?.left ?? 0,
  right: p?.right ?? 0,
  top: p?.top ?? 0,
});

export const sameInset = (a: Inset, b: Inset): boolean =>
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom &&
  a.left === b.left;

/**
 * The padding to hand `cameraForBounds` when the flight that follows re-pads
 * the map as it moves.
 *
 * `cameraForBounds` measures the free space against the padding the map has
 * *now* (`now`) and adds the padding it is given, but the camera lands under
 * `next`. Folding the growth of an axis into the fit padding puts the frame
 * right where the camera arrives: the sum of the two sides is what takes space
 * away from the box, so half of it per side leaves the difference of the sides
 * – and with it the centring, which the transform itself applies once the
 * flight has finished – untouched. `extra` is the breathing room around the
 * frame and is kept on every edge.
 */
export const fitInset = (now: Inset, next: Inset, extra: number): Inset => {
  const x = (next.left + next.right - now.left - now.right) / 2;
  const y = (next.top + next.bottom - now.top - now.bottom) / 2;
  return {
    bottom: extra + y,
    left: extra + x,
    right: extra + x,
    top: extra + y,
  };
};

/**
 * Where the map's own corner controls (scale bar, attribution) and the season
 * band stand: the first free pixel at the map's bottom-left. On a phone the
 * band is a bar along the bottom edge and nothing stands left of it. On
 * desktop the floating panels take the left (`panels`, their widths and gaps,
 * `0` when none is open) and the band is a card `gap` px above the edge –
 * beside the panels, or at the same gap from the edge when there are none.
 */
export const shellEdge = (
  mobile: boolean,
  barHeight: number,
  panels: number,
  gap: number,
): { bottom: number; left: number } =>
  mobile
    ? { bottom: barHeight, left: 0 }
    : { bottom: barHeight + gap, left: panels || gap };
