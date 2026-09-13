"use client";

import { Badge } from "@/components/ui/badge";
import { TAG_LABEL } from "@/lib/regions";
import { ICON_ATTRS, TAG_ICON } from "@/lib/tag-icons";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The editorial labels of both vocabularies, drawn rather than only spelled
 * out: a wrench for a town's workshops, a dam for a road built for a
 * reservoir, a torch for the tunnels to plan for. The icon is what carries
 * across the three places the labels appear – the sidebar row, the detail
 * panel and the map's hover popup – where the words themselves are too long
 * to read at a glance in a dense list.
 *
 * One component pair over both vocabularies, because a tag is a tag wherever
 * it is drawn; which list a name belongs to is the business of `TOWN_TAGS`
 * and `ROAD_TAGS`, and only the filter panel and the scales dialog care.
 *
 * The glyph is decoration next to its own label, never a replacement for it,
 * so it is `aria-hidden` and the text stays.
 */
export const TagIcon = ({
  tag,
  className,
}: {
  tag: Tag;
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
export const TagBadges = ({ tags }: { tags: Tag[] }) => (
  <div className="flex flex-wrap gap-1">
    {tags.map((tag) => (
      <Badge key={tag} variant="secondary" className="gap-1">
        <TagIcon tag={tag} />
        {TAG_LABEL[tag].label}
      </Badge>
    ))}
  </div>
);

/**
 * The sidebar row: the glyphs alone. Three labels spelled out are wider than
 * a 352 px row, so the words would be cut off mid-label on every second row –
 * the strip of icons fits, stays scannable down a list of 92, and the words
 * are one click away in the panel, on the map's popup and in the scales
 * dialog. Each glyph still carries its label for a screen reader and as a
 * native tooltip.
 */
export const TagLine = ({
  tags,
  lead,
}: {
  tags: Tag[];
  /** Put in front of the labels, e.g. the country code or the road type. */
  lead?: string;
}) => (
  <span className="flex items-center gap-x-1.5">
    {lead && (
      <span className="truncate">{tags.length ? `${lead} ·` : lead}</span>
    )}
    {tags.map((tag) => (
      <span key={tag} className="inline-flex" title={TAG_LABEL[tag].label}>
        <TagIcon tag={tag} className="size-3.5" />
        <span className="sr-only">{TAG_LABEL[tag].label}</span>
      </span>
    ))}
  </span>
);
