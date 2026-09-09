"use client";

import { Badge } from "@/components/ui/badge";
import { TOWN_TAG } from "@/lib/regions";
import { ICON_ATTRS, TAG_ICON } from "@/lib/tag-icons";
import type { TownTag } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Why a town is in the list, drawn rather than only spelled out: a wrench for
 * the workshops, a bed for the bike hotels, a mountain for the passes at the
 * door. The icon is what carries across the three places the labels appear –
 * the sidebar row, the detail panel and the map's hover popup – where the
 * words themselves are too long to read at a glance in a dense list.
 *
 * The glyph is decoration next to its own label, never a replacement for it,
 * so it is `aria-hidden` and the text stays.
 */
export const TownTagIcon = ({
  tag,
  className,
}: {
  tag: TownTag;
  className?: string;
}) => (
  <svg
    aria-hidden
    className={cn("size-3 shrink-0", className)}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox={ICON_ATTRS.viewBox}
  >
    {TAG_ICON[tag].map(([el, attrs]) =>
      el === "circle" ? (
        <circle key={JSON.stringify(attrs)} {...attrs} />
      ) : (
        <path key={JSON.stringify(attrs)} {...attrs} />
      ),
    )}
  </svg>
);

/** The detail panel: one badge per label, icon in front of the word. */
export const TownTagBadges = ({ tags }: { tags: TownTag[] }) => (
  <div className="flex flex-wrap gap-1">
    {tags.map((tag) => (
      <Badge key={tag} variant="secondary" className="gap-1">
        <TownTagIcon tag={tag} />
        {TOWN_TAG[tag].label}
      </Badge>
    ))}
  </div>
);

/**
 * The sidebar row: the glyphs alone. Three labels spelled out are wider than
 * a 352 px row, so the words would be cut off mid-label on every second town –
 * the strip of icons fits, stays scannable down a list of 48, and the words
 * are one click away in the panel, on the map's popup and in the scales
 * dialog. Each glyph still carries its label for a screen reader and as a
 * native tooltip.
 */
export const TownTagLine = ({
  tags,
  lead,
}: {
  tags: TownTag[];
  /** Put in front of the labels, e.g. the country code. */
  lead?: string;
}) => (
  <span className="flex items-center gap-x-1.5">
    {lead && <span>{lead} ·</span>}
    {tags.map((tag) => (
      <span key={tag} className="inline-flex" title={TOWN_TAG[tag].label}>
        <TownTagIcon tag={tag} className="size-3.5" />
        <span className="sr-only">{TOWN_TAG[tag].label}</span>
      </span>
    ))}
  </span>
);
