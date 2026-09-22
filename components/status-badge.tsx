import { Badge } from "@/components/ui/badge";
import { periodLabel } from "@/lib/period";
import { badgeWord, statusWord } from "@/lib/status";
import type { StatusReason, YearCell } from "@/lib/status";
import type { Period, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STATUS_CSS: Record<Status, string> = {
  closed: "bg-status-closed",
  open: "bg-status-open",
  risky: "bg-status-risky",
};

const STATUS_RING: Record<Status, string> = {
  closed: "ring-status-closed",
  open: "ring-status-open",
  risky: "ring-status-risky",
};

/** Filled by default; `hollow` mirrors the map's "not shown" state. */
export const StatusDot = ({
  status,
  hollow,
  className,
}: {
  status: Status;
  hollow?: boolean;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-block size-2.5 shrink-0 rounded-full",
      hollow
        ? cn("ring-2 ring-inset", STATUS_RING[status])
        : STATUS_CSS[status],
      className,
    )}
    aria-hidden
  />
);

/** Dot plus label; the colour is carried by the dot only so the text keeps its contrast in both themes. */
export const StatusLabel = ({
  status,
  reason,
  className,
}: {
  status: Status;
  reason?: StatusReason | null;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap",
      className,
    )}
  >
    <StatusDot status={status} />
    {statusWord(status, reason)}
  </span>
);

/**
 * The badge reads one cell rather than a status, a reason and a "best" flag
 * handed to it separately: those three always describe the same half-month of
 * the same entity, and three props are three chances to pass a set that never
 * occurs.
 */
export const StatusBadge = ({
  cell,
  period,
}: {
  cell: YearCell;
  period?: Period;
}) => (
  <Badge variant="outline" className="gap-1.5">
    <StatusDot status={cell.status} />
    {badgeWord(cell)}
    {period !== undefined && ` · ${periodLabel(period)}`}
  </Badge>
);
