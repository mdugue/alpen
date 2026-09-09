import { Badge } from "@/components/ui/badge";
import { periodLabel, REASON_WORD, STATUS_LABEL } from "@/lib/status";
import type { StatusReason } from "@/lib/status";
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

/**
 * "gut", "beste Zeit", "eingeschränkt: Hitze" or "oft gesperrt": the status
 * plus the one word of the first reason, or the best window where one applies.
 */
export const statusText = (
  status: Status,
  reason?: StatusReason | null,
  best?: boolean,
): string =>
  status === "risky" && reason && reason !== "outside-window"
    ? `${STATUS_LABEL[status]}: ${REASON_WORD[reason]}`
    : status === "open" && best
      ? "beste Zeit"
      : STATUS_LABEL[status];

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
    {statusText(status, reason)}
  </span>
);

export const StatusBadge = ({
  status,
  reason,
  best,
  period,
}: {
  status: Status;
  /** The first reason of a limited status. */
  reason?: StatusReason | null;
  /** The half-month lies in the pass's best window. */
  best?: boolean;
  period?: Period;
}) => (
  <Badge variant="outline" className="gap-1.5">
    <StatusDot status={status} />
    {statusText(status, reason, best)}
    {period !== undefined && ` · ${periodLabel(period)}`}
  </Badge>
);
