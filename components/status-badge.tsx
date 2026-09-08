import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, periodLabel } from "@/lib/status";
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
  className,
}: {
  status: Status;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap",
      className,
    )}
  >
    <StatusDot status={status} />
    {STATUS_LABEL[status]}
  </span>
);

export const StatusBadge = ({
  status,
  period,
}: {
  status: Status;
  period?: Period;
}) => (
  <Badge variant="outline" className="gap-1.5">
    <StatusDot status={status} />
    {STATUS_LABEL[status]}
    {period !== undefined && ` · ${periodLabel(period)}`}
  </Badge>
);
