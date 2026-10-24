import { CLASSIC_FAME, PEARL_BEAUTY } from "@/lib/regions";
import type { Pass, RoadType } from "@/lib/types";

/**
 * How loud a road is on the map – never whether it is there.
 *
 * Which roads the map draws is the filters' business and nobody else's: the
 * app opens on the classics (`CLASSIC_FAME`), every chip says what it leaves,
 * and what it leaves out stays as a grey shadow. The zoom never adds or
 * removes a road; it only changes how the ones that are drawn read. A dot's
 * size and weight follow its fame, and its name joins at the zoom its rank
 * earns (`PASS_LABELS` in `lib/layer-ids.ts`: rank 4 from 7, rank 3 from 8,
 * rank 2 from 9.5), because two hundred names do not fit on an overview where
 * two hundred dots do.
 *
 * The label ladder reads a road's `rankOf`, not its fame alone: a road that
 * does not cross anything – a spur up to a reservoir, a valley, a balcony –
 * counts one step lower than a pass of the same fame, because a dead end is a
 * detour from a base and not what a region is chosen for; a pearl (beauty 5)
 * counts one step higher, because it is. The classics (fame 4 and 5) are
 * never moved.
 */

/** The road types that end rather than cross: one step lower on the ladder. */
export const STEPS_DOWN: readonly RoadType[] = [
  "spur",
  "valley",
  "balcony",
  "plateau",
];

/**
 * Where a road stands on the label ladder: its fame, a step lower for a dead
 * end and a step higher for a pearl (`PEARL_BEAUTY`) – a road few people know
 * but everybody who rides it remembers is what a region is chosen for. A
 * classic keeps its fame whatever it is.
 */
export const rankOf = (pass: Pick<Pass, "beauty" | "fame" | "type">): number =>
  pass.fame >= CLASSIC_FAME
    ? pass.fame
    : pass.fame -
      (STEPS_DOWN.includes(pass.type) ? 1 : 0) +
      (pass.beauty >= PEARL_BEAUTY ? 1 : 0);

/**
 * Where the destination outlines step back: once the map is close enough for
 * the roads to be the picture. Past it an area keeps only a trace of its fill
 * and a hairline edge – it stays, because an area that vanished while zooming
 * into it read as a bug.
 */
export const DESTINATION_MAX_ZOOM = 9;

/** The two zooms a dot's size is given at; between and beyond, it is interpolated. */
export const SIZE_ZOOMS = { far: 6, near: 12 } as const;
