import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, periodLabel } from "@/lib/status";
import type { Period, Status } from "@/lib/types";

export const STATUS_CSS: Record<Status, string> = {
  open: "bg-status-open",
  risky: "bg-status-risky",
  closed: "bg-status-closed",
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
    <Badge variant={status}>
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
      {period !== undefined && ` · ${periodLabel(period)}`}
    </Badge>
  );
}
