import type { Selection } from "@/lib/app-state";
import type { LatLon } from "@/lib/types";

/**
 * What the detail panel can ask the explorer for – one value, because every
 * part of the panel gets the same one.
 *
 * The four kind modules take their model and this, and nothing else. Passing
 * the callbacks singly is what made the panel's `Props` grow to nineteen
 * fields and be spread into blocks that read ten of them
 * (docs/plans/31-panel-model.md).
 */
export interface PanelActions {
  onHover: (sel: Selection | null) => void;
  onSelect: (sel: Selection) => void;
  /** Close the panel, or go back to the list it was opened from. */
  onBack: () => void;
  onToggleFavorite: () => void;
  /** Road point under the profile cursor, drawn on the map; `null` clears it. */
  onProfileCursor: (point: LatLon | null) => void;
  /** Click on the profile: fly the map there to look at the hairpins. */
  onProfileZoom: (point: LatLon) => void;
}
