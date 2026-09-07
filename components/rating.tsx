import { cn } from "@/lib/utils";

/** Editorial 1–5 scale as bars; explained in the scales dialog. */
export function Rating({
  value,
  muted,
  className,
}: {
  value: number;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex gap-0.5 align-middle", className)} title={`${value} von 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-1.5 rounded-[2px]",
            i <= value ? (muted ? "bg-muted-foreground" : "bg-primary") : "bg-border",
          )}
        />
      ))}
    </span>
  );
}
