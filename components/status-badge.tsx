import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, periodLabel } from "@/lib/status";
import type { Period, Status } from "@/lib/types";

export const STATUS_CSS: Record<Status, string> = {
  open: "bg-status-open",
  risky: "bg-status-risky",
  closed: "bg-status-closed",
};

/** Badge colours per status; the shadcn badge has no domain variants, so they are applied via className. */
const STATUS_BADGE_CSS: Record<Status, string> = {
  open: "bg-status-open/15 text-status-open",
  risky: "bg-status-risky/20 text-status-risky",
  closed: "bg-status-closed/15 text-status-closed",
};

export function StatusDot({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${STATUS_CSS[status]}`}
      aria-hidden
    />
  );
}

export function StatusBadge({ status, period }: { status: Status; period?: Period }) {
  return (
    <Badge variant="outline" className={STATUS_BADGE_CSS[status]}>
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
      {period !== undefined && ` · ${periodLabel(period)}`}
    </Badge>
  );
}
