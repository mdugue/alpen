import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, periodLabel } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Period, Status } from "@/lib/types";

export const STATUS_CSS: Record<Status, string> = {
  open: "bg-status-open",
  risky: "bg-status-risky",
  closed: "bg-status-closed",
};

const STATUS_RING: Record<Status, string> = {
  open: "ring-status-open",
  risky: "ring-status-risky",
  closed: "ring-status-closed",
};

/** Filled by default; `hollow` mirrors the map's "not shown" state. */
export function StatusDot({ status, hollow, className }: { status: Status; hollow?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        hollow ? cn("ring-2 ring-inset", STATUS_RING[status]) : STATUS_CSS[status],
        className,
      )}
      aria-hidden
    />
  );
}

/** Dot plus label; the colour is carried by the dot only so the text keeps its contrast in both themes. */
export function StatusLabel({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatusBadge({ status, period }: { status: Status; period?: Period }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
      {period !== undefined && ` · ${periodLabel(period)}`}
    </Badge>
  );
}
